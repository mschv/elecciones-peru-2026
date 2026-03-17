"""
backfill_anotaciones.py — Populate anotaciones_jne from lAnotacionMarginal.

lAnotacionMarginal contains JNE administrative corrections to candidate
filings — corrections to declared data (DATO FALSO, DATO ERRÓNEO, etc.).
These are civic information separate from criminal sentences.

Field mapping (confirmed from raw API data):
  strTipoAnotacion  → tipo_anotacion  (DATO FALSO, DATO ERRÓNEO, COMPLEMENTARIO)
  strSeccionHV      → seccion_hv      (which HV section was wrong)
  strDice           → dice            (what was declared — HTML stripped)
  strDebeDecir      → debe_decir      (corrected version — HTML stripped)
  strNroExpediente  → nro_expediente  (JNE case number)
  strNroDocumento   → nro_documento   (JNE resolution)
  strNroAnotacion   → nro_anotacion   (official annotation number)
  strFeAnotacion    → fecha           (date of correction)

Requires the anotaciones_jne table (run migration first):

  CREATE TABLE IF NOT EXISTS anotaciones_jne (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id    UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    tipo_anotacion  TEXT,        -- "DATO FALSO", "DATO ERRÓNEO", "COMPLEMENTARIO"
    seccion_hv      TEXT,        -- which HV section was corrected
    nro_anotacion   TEXT,        -- official annotation number
    nro_expediente  TEXT,        -- JNE case number
    nro_documento   TEXT,        -- JNE resolution document
    dice            TEXT,        -- what candidate declared (HTML stripped)
    debe_decir      TEXT,        -- corrected version (HTML stripped)
    fecha           TEXT,        -- annotation date
    raw_data        JSONB,       -- full raw object
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  ALTER TABLE anotaciones_jne ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "public read anotaciones" ON anotaciones_jne FOR SELECT USING (true);

Usage:
    cd scraper
    python3 backfill_anotaciones.py

    # Preview first 5 candidates without writing:
    python3 backfill_anotaciones.py --preview
"""

from __future__ import annotations

import re
import sys
import time
import json
import httpx

from utils import make_supabase, fetch_all_candidates, get_hv, REQUEST_DELAY

PREVIEW = "--preview" in sys.argv
PREVIEW_LIMIT = 5


def strip_html(text: str | None) -> str | None:
    if not text:
        return None
    clean = re.sub(r"<[^>]+>", " ", text)
    clean = re.sub(r"\s+", " ", clean).strip()
    clean = (clean
             .replace("&amp;", "&")
             .replace("&lt;", "<")
             .replace("&gt;", ">")
             .replace("&nbsp;", " ")
             .replace("&#39;", "'"))
    return clean or None


def parse_anotaciones(data: dict, uuid: str) -> list[dict]:
    anotaciones = data.get("lAnotacionMarginal") or []
    records = []
    for a in anotaciones:
        records.append({
            "candidate_id":   uuid,
            "tipo_anotacion": a.get("strTipoAnotacion"),
            "seccion_hv":     a.get("strSeccionHV"),
            "nro_anotacion":  a.get("strNroAnotacion"),
            "nro_expediente": a.get("strNroExpediente"),
            "nro_documento":  a.get("strNroDocumento"),
            "dice":           strip_html(a.get("strDice")),
            "debe_decir":     strip_html(a.get("strDebeDecir")),
            "fecha":          a.get("strFeAnotacion"),
            "raw_data":       a,
        })
    return records


def main() -> None:
    supabase = make_supabase()

    print("Fetching all candidates with DNI…")
    candidates = fetch_all_candidates(supabase)
    total = len(candidates)
    print(f"  {total} candidates to process")
    if PREVIEW:
        candidates = candidates[:PREVIEW_LIMIT]
        print(f"  [PREVIEW] Processing first {PREVIEW_LIMIT} only\n")

    found = 0
    skipped_api = 0
    previewed: list[dict] = []

    with httpx.Client() as client:
        for i, row in enumerate(candidates, 1):
            uuid           = row["id"]
            dni            = row["dni"]
            nombre         = f"{row.get('nombres','')} {row.get('apellidos','')}".strip()
            jne_partido_id = (row.get("partido") or {}).get("jne_partido_id") or ""

            sys.stdout.write(f"\r  [{i}/{total}] {nombre[:40]:<40}")
            sys.stdout.flush()

            data = get_hv(client, dni, jne_partido_id)
            time.sleep(REQUEST_DELAY)

            if data is None:
                skipped_api += 1
                continue

            records = parse_anotaciones(data, uuid)
            if not records:
                continue

            found += 1
            print(f"\r  [{i}/{total}] {nombre} → {len(records)} anotacion(es)          ")

            if PREVIEW:
                previewed.append({"candidate": nombre, "records": records})
            else:
                supabase.table("anotaciones_jne").delete().eq("candidate_id", uuid).execute()
                supabase.table("anotaciones_jne").insert(records).execute()

    print(f"\nDone. {found}/{total} candidates had anotaciones JNE.")
    if skipped_api:
        print(f"  Skipped (API error / 400): {skipped_api} candidates")

    if PREVIEW and previewed:
        print("\n" + "="*60)
        print("PREVIEW — parsed anotaciones data:")
        print("="*60)
        print(json.dumps(previewed, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
