"""
backfill_plan_pdf.py
====================
Extracts the 4 structured fields (problema, objetivo, indicador, meta)
from JNE plan de gobierno PDFs and saves them to Supabase.

Uses pdfplumber to parse the 4-column table found in JNE PDFs.
Falls back to raw-text extraction if no valid tables are found
(which triggers the simple title+description layout in the UI).

Usage:
    pip install pdfplumber
    python backfill_plan_pdf.py                          # all parties
    python backfill_plan_pdf.py --partido-id <uuid>      # single party
"""

from __future__ import annotations

import io
import os
import re
import sys
import time

import httpx
import pdfplumber
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

REQUEST_DELAY = 1.0

# ── Dimension detection ───────────────────────────────────────────────────────

DIMENSION_PATTERNS: list[tuple[str, str]] = [
    ("social",          "social"),
    ("economica",       "economico"),
    ("económica",       "economico"),
    ("ambiental",       "ambiental"),
    ("territorial",     "ambiental"),
    ("institucional",   "institucional"),
    ("salud",           "salud"),
    ("educacion",       "educacion_eje"),
    ("educación",       "educacion_eje"),
    ("seguridad",       "seguridad"),
    ("infraestructura", "infraestructura"),
]


def _normalize(text: str) -> str:
    text = text.lower().strip()
    for src, dst in [("á","a"),("é","e"),("í","i"),("ó","o"),("ú","u"),("ñ","n")]:
        text = text.replace(src, dst)
    return text


def detect_eje(text: str) -> str | None:
    """Return the eje key if text looks like a dimension header, else None."""
    n = _normalize(text)
    if "dimension" not in n:
        return None
    for keyword, eje in DIMENSION_PATTERNS:
        if keyword in n:
            return eje
    return None


def clean_cell(text: str | None) -> str | None:
    if not text:
        return None
    text = text.replace("\x00", "").strip()
    text = re.sub(r"\s+", " ", text)
    return text if text else None


# ── PDF parsing ───────────────────────────────────────────────────────────────

# Typical JNE table column header keywords — rows matching these are skipped
_HEADER_KEYWORDS = {"problema", "objetivo", "indicador", "meta", "metas", "estrategico", "estratégico"}


def parse_pdf(pdf_bytes: bytes) -> list[dict]:
    """
    Parse a JNE plan de gobierno PDF.

    Returns rows with: eje, problema, objetivo, indicador, meta,
                       titulo, descripcion, orden
    Returns empty list if fewer than 3 data rows are found
    (caller should then use the raw-text fallback).
    """
    rows: list[dict] = []
    current_eje = "otro"
    orden = 0

    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            for page in pdf.pages:
                # Scan full-page text first to catch dimension headers that sit
                # outside a table (e.g. as a bold paragraph above the table).
                page_text = page.extract_text() or ""
                for line in page_text.split("\n"):
                    eje = detect_eje(line)
                    if eje:
                        current_eje = eje

                tables = page.extract_tables()
                if not tables:
                    continue

                for table in tables:
                    if not table:
                        continue

                    for row in table:
                        if not row:
                            continue

                        cleaned = [clean_cell(c) for c in row]
                        non_empty = [c for c in cleaned if c]

                        # Merged dimension-header row (1–2 non-empty cells)
                        joined_lower = " ".join(c or "" for c in row).lower()
                        eje = detect_eje(joined_lower)
                        if eje:
                            current_eje = eje
                            if len(non_empty) <= 2:
                                continue  # pure header row, no data

                        # Skip column-header rows
                        if len(non_empty) <= 2:
                            continue
                        words = set(_normalize(joined_lower).split())
                        if words & _HEADER_KEYWORDS and len(non_empty) <= 5:
                            # Looks like a column title row — skip unless it also
                            # has long text (meaning it's a real proposal row that
                            # happens to contain one of those words)
                            max_len = max((len(c) for c in non_empty), default=0)
                            if max_len < 40:
                                continue

                        # Handle 8-column tables (JNE PDFs where each logical
                        # column is rendered as 2 PDF cells).
                        # Header rows use even indices (0,2,4,6);
                        # data rows use 0,1,4,5 — take whichever is non-null.
                        if len(cleaned) >= 8:
                            problema  = cleaned[0]
                            objetivo  = cleaned[1] or cleaned[2]
                            indicador = cleaned[4]
                            meta      = cleaned[5] or cleaned[6]
                        else:
                            # Pad / trim to exactly 4 columns
                            while len(cleaned) < 4:
                                cleaned.append(None)
                            problema, objetivo, indicador, meta = (
                                cleaned[0], cleaned[1], cleaned[2], cleaned[3]
                            )

                        titulo = ((objetivo or problema) or "")[:120] or "Propuesta"
                        rows.append({
                            "eje":        current_eje,
                            "problema":   problema,
                            "objetivo":   objetivo,
                            "indicador":  indicador,
                            "meta":       meta,
                            "titulo":     titulo,
                            "descripcion": problema,  # fallback for simple UI layout
                            "orden":      orden,
                        })
                        orden += 1

    except Exception as e:
        print(f"    [pdfplumber error] {e}")
        return []

    # ── Merge page-break continuations ────────────────────────────────────────
    # When a table row spans a page boundary, pdfplumber emits two partial rows.
    # A continuation row is one where at least one structured cell starts with a
    # lowercase letter (mid-sentence) or ALL structured cells are None (orphan
    # text that only filled titulo/descripcion from carry-over text).
    def _is_continuation(row: dict) -> bool:
        fields = [row.get("problema"), row.get("objetivo"),
                  row.get("indicador"), row.get("meta")]
        non_null = [f for f in fields if f]
        if not non_null:
            return False  # fully-None row — not a continuation, just empty
        return any(f[0].islower() for f in non_null if f)

    merged: list[dict] = []
    for row in rows:
        if merged and _is_continuation(row):
            prev = merged[-1]
            for field in ("problema", "objetivo", "indicador", "meta"):
                if row.get(field):
                    prev[field] = ((prev.get(field) or "") + " " + row[field]).strip()
            # Refresh titulo from updated objetivo/problema
            prev["titulo"] = ((prev.get("objetivo") or prev.get("problema") or "")[:120]) or "Propuesta"
            prev["descripcion"] = prev.get("problema")
        else:
            merged.append(row)
    # Re-number orden after merging
    for i, row in enumerate(merged):
        row["orden"] = i

    return merged


def parse_pdf_fallback(pdf_bytes: bytes) -> list[dict]:
    """
    Raw-text fallback: one record per page with all text in descripcion.
    Leaves the 4 structured fields as None, triggering the simple card layout.
    """
    rows: list[dict] = []
    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            for i, page in enumerate(pdf.pages):
                text = (page.extract_text() or "").strip()
                if text:
                    rows.append({
                        "eje":        "otro",
                        "problema":   None,
                        "objetivo":   None,
                        "indicador":  None,
                        "meta":       None,
                        "titulo":     f"Página {i + 1}",
                        "descripcion": text,
                        "orden":      i,
                    })
    except Exception as e:
        print(f"    [fallback error] {e}")
    return rows


# ── Supabase helpers ──────────────────────────────────────────────────────────

def get_parties_with_pdfs(partido_id: str | None = None) -> list[dict]:
    q = (
        supabase.table("plan_gobierno_docs")
        .select("partido_id, url")
        .eq("tipo", "resumen")
    )
    if partido_id:
        q = q.eq("partido_id", partido_id)
    return q.execute().data or []


def upsert_plan_rows(partido_id: str, rows: list[dict]) -> None:
    supabase.table("plan_gobierno").delete().eq("partido_id", partido_id).execute()
    records = [{**r, "partido_id": partido_id} for r in rows]
    # Insert in batches of 100 to stay under Supabase payload limits
    for i in range(0, len(records), 100):
        supabase.table("plan_gobierno").insert(records[i : i + 100]).execute()


# ── Per-party processor ───────────────────────────────────────────────────────

def process_party(client: httpx.Client, partido_id: str, pdf_url: str) -> None:
    print(f"  PDF: {pdf_url[:80]}…")
    try:
        r = client.get(pdf_url, timeout=60, follow_redirects=True)
        r.raise_for_status()
        pdf_bytes = r.content
    except Exception as e:
        print(f"    [download error] {e}")
        return

    rows = parse_pdf(pdf_bytes)

    if len(rows) < 3:
        print(f"    {len(rows)} table rows found — using raw-text fallback")
        rows = parse_pdf_fallback(pdf_bytes)

    if not rows:
        print(f"    No content extracted. Skipping.")
        return

    print(f"    {len(rows)} rows extracted → saving…")
    upsert_plan_rows(partido_id, rows)
    print(f"    Saved.")


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    args = sys.argv[1:]
    partido_id_arg: str | None = None
    for i, a in enumerate(args):
        if a == "--partido-id" and i + 1 < len(args):
            partido_id_arg = args[i + 1]

    print("=" * 60)
    print("Backfill Plan de Gobierno — PDF extraction")
    print("=" * 60)

    parties = get_parties_with_pdfs(partido_id_arg)
    print(f"Found {len(parties)} parties with resumen PDF\n")

    with httpx.Client() as client:
        for i, row in enumerate(parties, 1):
            pid = row["partido_id"]
            url = row["url"]
            print(f"[{i}/{len(parties)}] partido_id={pid}")
            process_party(client, pid, url)
            time.sleep(REQUEST_DELAY)

    print("\n" + "=" * 60)
    print("Done.")


if __name__ == "__main__":
    main()
