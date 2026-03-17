"""
backfill_education_fix.py — Fix two education gaps without full re-scrape.

Gap 1 — Posgrado institution names:
  The scraper looked for strInstitucionPosgrado / strUniversidadPosgrado
  but the JNE API returns strCenEstudioPosgrado. All posgrado records
  currently have institucion = 'No especificado'. This script corrects them.

Gap 2 — oEduNoUniversitaria:
  The scraper ignored this section entirely. It covers pedagogical
  institutes and other non-university technical education — common for
  teacher candidates. This script inserts those missing records.

Usage:
    cd scraper
    python3 backfill_education_fix.py

    # Only fix posgrado institutions:
    python3 backfill_education_fix.py --only-posgrado

    # Only add missing no-universitaria records:
    python3 backfill_education_fix.py --only-no-univ
"""

from __future__ import annotations

import sys
import time
import httpx

from utils import make_supabase, fetch_all_candidates, get_hv, to_int, REQUEST_DELAY

ONLY_POSGRADO = "--only-posgrado" in sys.argv
ONLY_NO_UNIV  = "--only-no-univ"  in sys.argv
DO_POSGRADO   = not ONLY_NO_UNIV
DO_NO_UNIV    = not ONLY_POSGRADO


def fix_posgrado(supabase, data: dict, uuid: str) -> int:
    """Update existing posgrado records with the correct institution name."""
    fixed = 0
    for edu in (data.get("lEduPosgrado") or []) + (data.get("lEduPosgradoOtro") or []):
        institucion = (
            edu.get("strCenEstudioPosgrado") or   # ← correct field
            edu.get("strInstitucionPosgrado") or  # fallback
            edu.get("strUniversidadPosgrado")     # fallback
        )
        if not institucion or institucion.strip().lower() == "no especificado":
            continue

        titulo = (
            edu.get("strEspecialidadPosgrado") or
            edu.get("strCarreraPosgrado") or
            edu.get("strGradoPosgrado") or
            edu.get("strTituloPosgrado")
        )
        if not titulo:
            continue

        titulo_fmt      = titulo.strip().title()
        institucion_fmt = institucion.strip().title()

        # Update the matching record for this candidate
        res = (
            supabase.table("education")
            .update({"institucion": institucion_fmt})
            .eq("candidate_id", uuid)
            .eq("nivel", "posgrado")
            .ilike("titulo", titulo_fmt)
            .execute()
        )
        if res.data:
            fixed += 1

    return fixed


def add_no_univ(supabase, data: dict, uuid: str) -> int:
    """Insert oEduNoUniversitaria records into education if not already present."""
    no_univ = data.get("oEduNoUniversitaria") or {}

    institucion = (
        no_univ.get("strInstitucion") or
        no_univ.get("strCentroEstudios") or
        no_univ.get("strCenEstudio") or
        no_univ.get("strInstituto")
    )
    if not institucion:
        return 0

    titulo = (
        no_univ.get("strTitulo") or
        no_univ.get("strGrado") or
        no_univ.get("strCarrera")
    )
    year_inicio = to_int(
        no_univ.get("nroAnioInicio") or
        no_univ.get("strAnioInicio")
    )
    year_fin = to_int(
        no_univ.get("nroAnioFin") or
        no_univ.get("nroAnioEgreso") or
        no_univ.get("strAnioFin")
    )
    concluido = no_univ.get("strConcluido") or no_univ.get("strConcluidoEdu")
    estado = "completo" if concluido == "1" else "incompleto"

    # Upsert using candidate_id + nivel + institucion as identity
    supabase.table("education").upsert(
        {
            "candidate_id": uuid,
            "nivel":        "tecnico",
            "titulo":       titulo.strip().title() if titulo else None,
            "institucion":  institucion.strip().title(),
            "year_inicio":  year_inicio,
            "year_fin":     year_fin,
            "estado":       estado,
        },
        on_conflict="candidate_id,nivel,institucion",
    ).execute()
    return 1


def main() -> None:
    supabase = make_supabase()

    print("Fetching all candidates with DNI…")
    candidates = fetch_all_candidates(supabase)
    total = len(candidates)
    print(f"  {total} candidates to process")
    print(f"  Fix posgrado: {DO_POSGRADO}  |  Add no-univ: {DO_NO_UNIV}\n")

    posgrado_fixed = 0
    no_univ_added  = 0

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

            if not data:
                continue

            if DO_POSGRADO:
                n = fix_posgrado(supabase, data, uuid)
                if n:
                    posgrado_fixed += n
                    print(f"\r  [{i}/{total}] {nombre} → {n} posgrado(s) fixed          ")

            if DO_NO_UNIV:
                n = add_no_univ(supabase, data, uuid)
                if n:
                    no_univ_added += n
                    print(f"\r  [{i}/{total}] {nombre} → no-univ added          ")

    print(f"\nDone.")
    if DO_POSGRADO:
        print(f"  Posgrado institutions fixed: {posgrado_fixed}")
    if DO_NO_UNIV:
        print(f"  No-universitaria records added: {no_univ_added}")


if __name__ == "__main__":
    main()
