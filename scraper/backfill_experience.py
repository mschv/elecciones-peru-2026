"""
backfill_experience.py
======================
Re-scrapes work experience for deputies (congresistas) and optionally senators,
with an improved sector detection function that catches more public-sector
organisations (schools, hospitals, regional governments, courts, universities, etc.)

Run this after the main scraper to ensure experience data is complete and
sector assignments are accurate.

Usage:
    cd scraper
    python3 backfill_experience.py                      # all congresistas
    python3 backfill_experience.py --cargo senador      # senators only
    python3 backfill_experience.py --cargo all          # everyone
    python3 backfill_experience.py --missing-only       # skip those that already have records
"""

from __future__ import annotations

import sys
import time
import httpx

from utils import make_supabase, get_hv, to_int, db_retry, REQUEST_DELAY

# ── CLI args ──────────────────────────────────────────────────────────────────

CARGO_FILTER: str | None = "congresista"
MISSING_ONLY = "--missing-only" in sys.argv

for i, a in enumerate(sys.argv[1:], 1):
    if a == "--cargo" and i < len(sys.argv):
        v = sys.argv[i + 1]
        CARGO_FILTER = None if v == "all" else v

# ── Improved sector detection ─────────────────────────────────────────────────

_PUBLIC_KEYWORDS = [
    # Ministries / central government
    "ministerio", "gobierno", "estado", "nacional", "republic",
    # Sub-national
    "municipalidad", "municipio", "alcaldia", "gobierno regional",
    "gobierno local", "mancomunidad", "region ",
    # Education — schools and institutes
    "institución educativa", "institucion educativa",
    "i.e.p", "i.e.i", "i.e.", "iestp", "i.s.t.", "iest ",
    "colegio nacional", "colegio estatal", "ugel", "dre ",
    "ministerio de educacion", "minedu",
    "universidad nacional", "unmsm", "unac", "unfv", "uns ", "unc ",
    "uncp", "unsch", "unas", "unaj", "unu ", "unsm", "unjbg",
    # Health
    "hospital", "puesto de salud", "centro de salud", "essalud",
    "posta medica", "clinica del estado", "minsa", "diresa", "geresa",
    "red de salud",
    # Justice / courts
    "poder judicial", "juzgado", "sala ", "corte ", "fiscalia",
    "ministerio publico", "tribunal", "consejo de estado",
    # Security / military
    "policia", "pnp", "ffaa", "ejercito", "marina", "fuerza aerea",
    "serenazgo", "bomberos",
    # State companies / agencies
    "petroperu", "sedapal", "electroperu", "cofide", "fonafe",
    "provias", "sunarp", "sunat", "aduanas", "onpe", "jne", "reniec",
    "osinergmin", "osiptel", "oefa", "sernanp", "ana ", "senamhi",
    "serpost", "minedu", "minsa", "mimp", "minjus", "mincetur",
    "produce", "midagri", "minam", "mtc", "mvcs", "minem",
    "indeci", "inpe", "devida", "inia", "senasa", "iiap", "imarpe",
    "conam", "conadis", "concytec", "promperu", "proinversion",
    # Legislative
    "congreso", "senado", "parlamento",
    # Other
    "gobernacion", "prefectura", "subprefectura",
]

_PUBLIC_KW_LOWER = [k.lower() for k in _PUBLIC_KEYWORDS]


def detect_sector(centro: str) -> str:
    low = centro.lower()
    return "publico" if any(k in low for k in _PUBLIC_KW_LOWER) else "privado"


# ── Experience upsert ─────────────────────────────────────────────────────────

def upsert_experience(supabase, data: dict, uuid: str) -> int:
    """Re-insert experience records for a candidate. Returns count inserted."""
    exp_list = data.get("lExperienciaLaboral") or []
    if not exp_list:
        return 0

    records = []
    for exp in exp_list:
        centro    = (exp.get("strCentroTrabajo") or "").title().strip()
        ocupacion = (exp.get("strOcupacionProfesion") or "").title().strip()
        comentario = (exp.get("strComentario") or "").strip() or None

        records.append({
            "candidate_id": uuid,
            "cargo":        ocupacion or "No especificado",
            "organizacion": centro or "No especificado",
            "sector":       detect_sector(centro),
            "year_inicio":  to_int(exp.get("strAnioTrabajoDesde")),
            "year_fin":     to_int(exp.get("strAnioTrabajoHasta")),
            "descripcion":  comentario,
        })

    db_retry(lambda: supabase.table("experience").delete().eq("candidate_id", uuid).execute())
    db_retry(lambda: supabase.table("experience").insert(records).execute())
    return len(records)


# ── Fetch candidates ──────────────────────────────────────────────────────────

def fetch_candidates(supabase, cargo: str | None, missing_only: bool) -> list[dict]:
    PAGE = 1000

    existing_ids: set[str] = set()
    if missing_only:
        print("Fetching candidates that already have experience records…")
        offset = 0
        while True:
            batch = (
                supabase.table("experience")
                .select("candidate_id")
                .range(offset, offset + PAGE - 1)
                .execute()
                .data
            )
            for row in batch:
                existing_ids.add(row["candidate_id"])
            if len(batch) < PAGE:
                break
            offset += PAGE
        print(f"  {len(existing_ids)} candidates already have experience records")

    print("Fetching candidates with a DNI…")
    all_candidates: list[dict] = []
    offset = 0
    while True:
        q = (
            supabase.table("candidates")
            .select("id, nombres, apellidos, dni, cargo, partido:partido_id(jne_partido_id)")
            .not_.is_("dni", "null")
        )
        if cargo:
            q = q.eq("cargo", cargo)
        batch = q.range(offset, offset + PAGE - 1).execute().data
        all_candidates.extend(batch)
        if len(batch) < PAGE:
            break
        offset += PAGE

    if missing_only:
        result = [c for c in all_candidates if c["id"] not in existing_ids]
        print(f"  {len(result)} candidates without experience records\n")
    else:
        result = all_candidates
        print(f"  {len(result)} candidates to process\n")

    return result


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    supabase = make_supabase()

    cargo_label = CARGO_FILTER or "all"
    print("=" * 60)
    print(f"Backfill Experience ({cargo_label}{'  [missing only]' if MISSING_ONLY else ''})")
    print("=" * 60)

    candidates = fetch_candidates(supabase, CARGO_FILTER, MISSING_ONLY)
    total = len(candidates)

    inserted_total = 0
    skipped_no_data = 0
    errors = 0

    with httpx.Client() as client:
        for i, row in enumerate(candidates, 1):
            uuid           = row["id"]
            dni            = row.get("dni") or ""
            nombre         = f"{row.get('nombres', '')} {row.get('apellidos', '')}".strip()
            jne_partido_id = (row.get("partido") or {}).get("jne_partido_id") or ""

            sys.stdout.write(f"\r  [{i}/{total}] {nombre[:50]:<50}")
            sys.stdout.flush()

            if not dni:
                continue

            try:
                data = get_hv(client, dni, jne_partido_id)
                time.sleep(REQUEST_DELAY)

                if not data:
                    skipped_no_data += 1
                    continue

                n = upsert_experience(supabase, data, uuid)
                inserted_total += n
                if n:
                    print(f"\r  [{i}/{total}] {nombre} → {n} exp records          ")

            except Exception as e:
                errors += 1
                print(f"\r  [{i}/{total}] ERROR {nombre}: {e}          ")

    print(f"\n{'=' * 60}")
    print(f"Done.")
    print(f"  Experience records inserted : {inserted_total}")
    print(f"  No data from API            : {skipped_no_data}")
    print(f"  Errors                      : {errors}")


if __name__ == "__main__":
    main()
