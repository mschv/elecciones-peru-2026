"""
check_lima_fields.py
====================
Fetches the raw JNE API response for diputados (tipo=15) and prints:
  1. All field names available in the response
  2. All unique strDepartamento values
  3. Full raw record for a Lima candidate (to find what distinguishes
     Lima Metropolitana from Lima Provincias)
  4. Any candidates with null/empty strDepartamento (potential overseas)

Usage:
    cd scraper
    python3 check_lima_fields.py
"""

import json
import httpx
from utils import BASE_URL, ID_PROCESO, HEADERS


def fetch_deputies(client: httpx.Client) -> list[dict]:
    r = client.post(
        f"{BASE_URL}/listarCanditatos",
        json={
            "idProcesoElectoral": ID_PROCESO,
            "strUbiDepartamento": "",
            "idTipoEleccion": 15,
        },
        headers=HEADERS,
        timeout=60,
    )
    r.raise_for_status()
    payload = r.json()
    return payload.get("data") or (payload if isinstance(payload, list) else [])


with httpx.Client() as client:
    print("Fetching diputados from JNE API...")
    candidates = fetch_deputies(client)
    print(f"Total: {len(candidates)} candidates\n")

    if not candidates:
        print("No data returned.")
        exit(1)

    # 1. All available field names
    all_keys = set()
    for c in candidates:
        all_keys.update(c.keys())
    print("=" * 60)
    print("AVAILABLE FIELDS:")
    print("=" * 60)
    for k in sorted(all_keys):
        print(f"  {k}")

    # 2. All unique strDepartamento values
    depts = sorted(set((c.get("strDepartamento") or "NULL").upper() for c in candidates))
    print(f"\n{'=' * 60}")
    print(f"UNIQUE strDepartamento values ({len(depts)}):")
    print("=" * 60)
    for d in depts:
        count = sum(1 for c in candidates if (c.get("strDepartamento") or "NULL").upper() == d)
        print(f"  {d!r:40s} → {count} candidates")

    # 3. First Lima candidate — full record
    lima_candidates = [c for c in candidates if (c.get("strDepartamento") or "").upper() == "LIMA"]
    if lima_candidates:
        print(f"\n{'=' * 60}")
        print(f"SAMPLE LIMA CANDIDATE (1 of {len(lima_candidates)}):")
        print("=" * 60)
        print(json.dumps(lima_candidates[0], ensure_ascii=False, indent=2))

        # Show all unique values of potentially useful fields for Lima candidates
        for field in ["strCircunscripcion", "strNombreCircunscripcion", "strDistrito",
                      "idCircunscripcion", "strUbigeo", "strUbiDepartamento",
                      "strUbiProvincia", "strProvincia", "idJuradoElectoral",
                      "strJurado", "strSede"]:
            if field in all_keys:
                unique_vals = sorted(set(str(c.get(field) or "") for c in lima_candidates))
                print(f"\n  Lima → {field}: {unique_vals[:10]}")

    # 4. Candidates with null/empty/non-standard strDepartamento
    no_dept = [c for c in candidates if not (c.get("strDepartamento") or "").strip()]
    if no_dept:
        print(f"\n{'=' * 60}")
        print(f"CANDIDATES WITH EMPTY strDepartamento ({len(no_dept)}):")
        print("=" * 60)
        print(json.dumps(no_dept[0], ensure_ascii=False, indent=2))
    else:
        print(f"\n  No candidates with empty strDepartamento.")
