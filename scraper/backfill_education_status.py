"""
backfill_education_status.py
=============================
Re-scrapes education data ONLY for candidates who already have records
in the education table, in order to fix incorrect/null `status` values
caused by the original scraper writing to the wrong column name ("estado"
instead of "status").

Uses the same upsert_education logic as backfill_education_missing.py.

Usage:
    cd scraper
    python3 backfill_education_status.py                     # all
    python3 backfill_education_status.py --cargo congresista
    python3 backfill_education_status.py --cargo senador
"""

from __future__ import annotations

import sys
import time
import httpx

from utils import make_supabase, get_hv, to_int, REQUEST_DELAY

# ── CLI args ──────────────────────────────────────────────────────────────────

CARGO_FILTER: str | None = None
for i, a in enumerate(sys.argv[1:], 1):
    if a == "--cargo" and i < len(sys.argv):
        CARGO_FILTER = sys.argv[i + 1]


# ── Education upsert (same as backfill_education_missing.py) ──────────────────

def parse_int(val) -> int | None:
    try:
        v = int(str(val))
        return v if v != 0 else None
    except (TypeError, ValueError):
        return None


def upsert_education(supabase, data: dict, uuid: str) -> int:
    """Re-insert education records for a candidate. Returns count inserted."""
    records = []

    edu_basica = data.get("oEduBasica") or {}
    if edu_basica.get("strEduPrimaria") == "1":
        records.append({
            "candidate_id": uuid, "nivel": "primaria",
            "institucion": "No especificado",
            "estado": "completo" if edu_basica.get("strConcluidoEduPrimaria") == "1" else "incompleto",
        })
    if edu_basica.get("strEduSecundaria") == "1":
        records.append({
            "candidate_id": uuid, "nivel": "secundaria",
            "institucion": "No especificado",
            "estado": "completo" if edu_basica.get("strConcluidoEduSecundaria") == "1" else "incompleto",
        })

    edu_tec = data.get("oEduTecnico") or {}
    if edu_tec.get("strTengoEduTecnico") == "1":
        records.append({
            "candidate_id": uuid, "nivel": "tecnico",
            "titulo":      (edu_tec.get("strCarreraTecnico") or "").title() or None,
            "institucion": (edu_tec.get("strInstitutoTecnico") or "No especificado").title(),
            "year_inicio": parse_int(edu_tec.get("strAnioInicioTecnico")),
            "year_fin":    parse_int(edu_tec.get("strAnioFinTecnico")),
            "estado": "completo" if edu_tec.get("strConcluidoEduTecnico") == "1" else "incompleto",
        })

    no_univ = data.get("oEduNoUniversitaria") or {}
    institucion_nu = (
        no_univ.get("strInstitucion") or no_univ.get("strCentroEstudios") or
        no_univ.get("strCenEstudio") or no_univ.get("strInstituto")
    )
    if institucion_nu:
        titulo_nu = no_univ.get("strTitulo") or no_univ.get("strGrado") or no_univ.get("strCarrera")
        concluido = no_univ.get("strConcluido") or no_univ.get("strConcluidoEdu")
        records.append({
            "candidate_id": uuid, "nivel": "tecnico",
            "titulo":      titulo_nu.strip().title() if titulo_nu else None,
            "institucion": institucion_nu.strip().title(),
            "year_inicio": parse_int(no_univ.get("nroAnioInicio") or no_univ.get("strAnioInicio")),
            "year_fin":    parse_int(no_univ.get("nroAnioFin") or no_univ.get("nroAnioEgreso") or no_univ.get("strAnioFin")),
            "estado": "completo" if concluido == "1" else "incompleto",
        })

    for edu in data.get("lEduUniversitaria") or []:
        records.append({
            "candidate_id": uuid, "nivel": "universitario",
            "titulo":      (edu.get("strCarreraUni") or "").title() or None,
            "institucion": (edu.get("strUniversidad") or "No especificado").title(),
            "year_fin":    parse_int(edu.get("strAnioTitulo")) or parse_int(edu.get("strAnioBachiller")),
            "estado": "completo" if (edu.get("strTituloUni") == "1" or edu.get("strBachillerEduUni") == "1" or edu.get("strAnioTitulo") or edu.get("strAnioBachiller")) else "incompleto",
        })

    for edu in (data.get("lEduPosgrado") or []) + (data.get("lEduPosgradoOtro") or []):
        inst = (
            edu.get("strCenEstudioPosgrado") or
            edu.get("strInstitucionPosgrado") or
            edu.get("strUniversidadPosgrado") or
            "No especificado"
        )
        records.append({
            "candidate_id": uuid, "nivel": "posgrado",
            "titulo":      (edu.get("strEspecialidadPosgrado") or edu.get("strCarreraPosgrado") or edu.get("strGradoPosgrado") or "").title() or None,
            "institucion": inst.strip().title(),
            "year_fin":    parse_int(edu.get("strAnioPosgrado") or edu.get("strAnioFinPosgrado")),
            "estado": "completo",
        })

    if not records:
        return 0

    supabase.table("education").delete().eq("candidate_id", uuid).execute()
    supabase.table("education").insert(records).execute()
    return len(records)


# ── Fetch candidates that already have education records ──────────────────────

def fetch_candidates_with_education(supabase, cargo: str | None) -> list[dict]:
    """Returns candidates that already have at least one education record."""
    print("Fetching candidate IDs that already have education records…")
    PAGE = 1000
    edu_ids: set[str] = set()
    offset = 0
    while True:
        batch = (
            supabase.table("education")
            .select("candidate_id")
            .range(offset, offset + PAGE - 1)
            .execute()
            .data
        )
        for row in batch:
            edu_ids.add(row["candidate_id"])
        if len(batch) < PAGE:
            break
        offset += PAGE
    print(f"  {len(edu_ids)} candidates have education records")

    print("Fetching matching candidates with a DNI…")
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

    with_edu = [c for c in all_candidates if c["id"] in edu_ids]
    print(f"  {len(with_edu)} candidates to re-scrape\n")
    return with_edu


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    supabase = make_supabase()

    cargo_label = CARGO_FILTER or "all cargos"
    print("=" * 60)
    print(f"Backfill Education Status Fix ({cargo_label})")
    print("=" * 60)

    candidates = fetch_candidates_with_education(supabase, CARGO_FILTER)
    total = len(candidates)

    inserted_total = 0
    skipped_no_data = 0
    errors = 0

    with httpx.Client() as client:
        for i, row in enumerate(candidates, 1):
            uuid   = row["id"]
            dni    = row.get("dni") or ""
            nombre = f"{row.get('nombres', '')} {row.get('apellidos', '')}".strip()
            jne_partido_id = (row.get("partido") or {}).get("jne_partido_id") or ""

            sys.stdout.write(f"\r  [{i}/{total}] {nombre[:45]:<45}")
            sys.stdout.flush()

            if not dni:
                continue

            try:
                data = get_hv(client, dni, jne_partido_id)
                time.sleep(REQUEST_DELAY)

                if not data:
                    skipped_no_data += 1
                    continue

                n = upsert_education(supabase, data, uuid)
                inserted_total += n

            except Exception as e:
                errors += 1
                print(f"\r  [{i}/{total}] ERROR {nombre}: {e}          ")

    print(f"\n{'=' * 60}")
    print(f"Done.")
    print(f"  Education records re-inserted : {inserted_total}")
    print(f"  No data from API              : {skipped_no_data}")
    print(f"  Errors                        : {errors}")


if __name__ == "__main__":
    main()
