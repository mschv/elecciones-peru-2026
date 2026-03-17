"""
backfill_education_estado.py

Re-scrapes lEduUniversitaria for all candidates and fixes the `estado` field.
The original scraper missed `strConcluidoEduUni` as a completion indicator,
causing many university records to be stored as "incompleto" incorrectly.

Usage:
    cd scraper
    python3 backfill_education_estado.py
"""

from __future__ import annotations
import sys, time
import httpx
from utils import make_supabase, db_retry, BASE_URL, ID_PROCESO, HEADERS, REQUEST_DELAY


def parse_int(v) -> int | None:
    try:
        return int(v) if v else None
    except (ValueError, TypeError):
        return None


def fix_edu_for_candidate(supabase, client: httpx.Client, candidate: dict) -> int:
    dni       = candidate.get("dni") or ""
    org_id    = candidate.get("_org_id") or ""
    uuid      = candidate["id"]
    if not dni or not org_id:
        return 0

    try:
        r = client.post(
            f"{BASE_URL}/HVConsolidado",
            json={"idProcesoElectoral": ID_PROCESO, "strDocumentoIdentidad": dni, "idOrganizacionPolitica": org_id},
            headers=HEADERS,
            timeout=30,
        )
        r.raise_for_status()
        hv_raw = r.json()
    except Exception as e:
        print(f"\n  [API error] {e}")
        return 0

    data = hv_raw.get("data") or (hv_raw if isinstance(hv_raw, dict) and "lEduUniversitaria" in hv_raw else None)
    if not data:
        return 0

    uni_list = data.get("lEduUniversitaria") or []
    if not uni_list:
        return 0

    fixed = 0
    for edu in uni_list:
        titulo    = (edu.get("strCarreraUni") or "").title() or None
        institucion = (edu.get("strUniversidad") or "No especificado").title()
        year_fin  = parse_int(edu.get("strAnioTitulo")) or parse_int(edu.get("strAnioBachiller"))
        estado    = "completo" if (
            edu.get("strConcluidoEduUni") == "1" or
            edu.get("strEgresadoEduUni") == "1" or
            edu.get("strTituloUni") == "1" or
            edu.get("strBachillerEduUni") == "1" or
            edu.get("strAnioTitulo") or
            edu.get("strAnioBachiller")
        ) else "incompleto"

        if not titulo:
            continue

        # Update existing record matching candidate + nivel + titulo
        res = db_retry(lambda: (
            supabase.table("education")
            .update({"estado": estado, "year_fin": year_fin})
            .eq("candidate_id", uuid)
            .eq("nivel", "universitario")
            .ilike("titulo", titulo)
            .execute()
        ))
        if res.data:
            fixed += len(res.data)

    return fixed


def main():
    supabase = make_supabase()

    # Get all candidates with their partido's org ID
    # We need the JNE org ID — stored as a numeric ID used in API calls
    # Fetch from the listarCanditatos endpoint and build a dni → org_id map
    print("Fetching candidate list from JNE API...")
    with httpx.Client() as client:
        all_raw = []
        for tipo in [1, 2, 3]:
            try:
                r = client.post(
                    f"{BASE_URL}/listarCanditatos",
                    json={"idProcesoElectoral": ID_PROCESO, "strUbiDepartamento": "", "idTipoEleccion": tipo},
                    headers=HEADERS, timeout=30,
                )
                data = r.json()
                items = data.get("data", data) if isinstance(data, dict) else data
                if isinstance(items, list):
                    all_raw.extend(items)
            except Exception as e:
                print(f"  [list error tipo={tipo}] {e}")

    # Build dni → org_id map
    dni_to_org: dict[str, str] = {}
    for c in all_raw:
        dni = c.get("strDocumentoIdentidad") or ""
        org = str(c.get("idOrganizacionPolitica") or "")
        if dni and org:
            dni_to_org[dni] = org

    print(f"  {len(dni_to_org)} candidates in JNE list")

    # Get all candidates from DB (paginate past the 1000-row default limit)
    candidates = []
    page_size = 1000
    offset = 0
    while True:
        res = supabase.table("candidates").select("id, dni").range(offset, offset + page_size - 1).execute()
        batch = res.data or []
        candidates.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size
    print(f"  {len(candidates)} candidates in DB\n")

    total_fixed = 0
    with httpx.Client() as client:
        for i, cand in enumerate(candidates, 1):
            dni = cand.get("dni") or ""
            org_id = dni_to_org.get(dni) or ""
            cand["_org_id"] = org_id

            nombre = f"{cand.get('nombres', '')} {cand.get('apellidos', '')}".strip() or cand["id"]
            n = fix_edu_for_candidate(supabase, client, cand)
            if n:
                total_fixed += n
                print(f"\r  [{i}/{len(candidates)}] Fixed {n} record(s) for {nombre[:40]:<40}")
            else:
                print(f"\r  [{i}/{len(candidates)}] {nombre[:50]:<50}", end="", flush=True)

            time.sleep(REQUEST_DELAY)

    print(f"\n\nDone. Updated {total_fixed} university education records.")


if __name__ == "__main__":
    main()
