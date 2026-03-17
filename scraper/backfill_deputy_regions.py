"""
backfill_deputy_regions.py — Fix region='Nacional' for deputies.

The scraper defaulted strDepartamento=null to "NACIONAL" for ~1363 deputies.
This script fetches the raw JNE candidates list for tipo=15 (diputados),
builds a DNI→department map, then updates candidates where region='Nacional'.

Usage:
    cd scraper
    python3 backfill_deputy_regions.py
    python3 backfill_deputy_regions.py --dry-run
"""

from __future__ import annotations

import sys
import httpx

from utils import make_supabase, BASE_URL, ID_PROCESO, HEADERS

DRY_RUN = "--dry-run" in sys.argv

# Peru department codes (ubigeo prefix → department name)
UBIGEO_DEPT: dict[str, str] = {
    "01": "Amazonas", "02": "Ancash", "03": "Apurimac", "04": "Arequipa",
    "05": "Ayacucho", "06": "Cajamarca", "07": "Callao", "08": "Cusco",
    "09": "Huancavelica", "10": "Huanuco", "11": "Ica", "12": "Junin",
    "13": "La Libertad", "14": "Lambayeque", "15": "Lima", "16": "Loreto",
    "17": "Madre De Dios", "18": "Moquegua", "19": "Pasco", "20": "Piura",
    "21": "Puno", "22": "San Martin", "23": "Tacna", "24": "Tumbes", "25": "Ucayali",
}


def dept_from_ubigeo(ubigeo: str) -> str | None:
    return UBIGEO_DEPT.get(ubigeo[:2]) if ubigeo else None


def fetch_deputies(client: httpx.Client) -> list[dict]:
    r = client.post(
        f"{BASE_URL}/listarCanditatos",
        json={
            "idProcesoElectoral": ID_PROCESO,
            "strUbiDepartamento": "",
            "idTipoEleccion":     15,
        },
        headers=HEADERS,
        timeout=60,
    )
    r.raise_for_status()
    return r.json().get("data") or []


def main() -> None:
    supabase = make_supabase()

    print("Fetching deputies list from JNE...")
    with httpx.Client() as client:
        candidates = fetch_deputies(client)
    print(f"  {len(candidates)} deputies in JNE list")

    # Build DNI → department map, falling back to ubigeo if strDepartamento is empty
    dni_to_dept: dict[str, str] = {}
    for c in candidates:
        dni  = (c.get("strDocumentoIdentidad") or "").strip()
        dept = (c.get("strDepartamento") or "").strip().title()
        if not dept:
            dept = dept_from_ubigeo(c.get("strUbigeo") or "") or ""
        if dni and dept:
            dni_to_dept[dni] = dept

    print(f"  {len(dni_to_dept)} deputies have a department in JNE list")

    # Fetch all our deputies with region='Nacional' (paginated)
    rows, offset = [], 0
    while True:
        batch = (
            supabase.table("candidates")
            .select("id, nombres, apellidos, dni, region")
            .eq("cargo", "congresista")
            .eq("region", "Nacional")
            .not_.is_("dni", "null")
            .range(offset, offset + 999)
            .execute()
            .data
        )
        rows.extend(batch)
        if len(batch) < 1000:
            break
        offset += 1000
    print(f"  {len(rows)} deputies with region='Nacional' in DB\n")

    fixed = 0
    not_found = 0

    for row in rows:
        dni  = row["dni"]
        dept = dni_to_dept.get(dni)
        name = f"{row['nombres']} {row['apellidos']}"

        if not dept:
            not_found += 1
            continue

        fixed += 1
        print(f"  {name} → {dept}")

        if not DRY_RUN:
            supabase.table("candidates").update({"region": dept}).eq("id", row["id"]).execute()

    print(f"\nDone. Fixed: {fixed} | Not found in JNE list: {not_found}")
    if DRY_RUN:
        print("[DRY RUN] No changes written.")


if __name__ == "__main__":
    main()
