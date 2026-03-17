"""
backfill_fix_regions.py
=======================
Fixes incorrect electoral region assignments for deputy (congresista) candidates.

Root cause:
  - 1363 candidates had empty strDepartamento (Lima Metropolitana + other
    districts registered in a second wave where JNE left the field blank)
  - The previous scraper fell back to strUbigeo prefix, which gives the
    candidate's HOME department — NOT their electoral district.
    Example: a candidate living in Lambayeque (ubigeo 140100) running for
    Lima Metropolitana would get region = "Lambayeque" instead of "Lima Metropolitana"
  - 1022 "LIMA" candidates need to be split into Lima Metropolitana vs
    Lima Provincias.

Fix:
  - Use strJuradoElectoralCreacion (the JNE electoral circuit that registered
    the candidacy) as the authoritative source for electoral district.
  - Lima Metropolitana: circuits named "LIMA OESTE X", "LIMA CENTRO X", etc.
  - Lima Provincias: circuits HUAURA, CAÑETE, BARRANCA, HUAROCHIRÍ, etc.
  - All other circuits: mapped to their parent department.

Updates both:
  - candidates.region        (used by the list view)
  - formula_members.region   (used by the individual profile page)

Usage:
    cd scraper
    python3 backfill_fix_regions.py
    python3 backfill_fix_regions.py --dry-run
    python3 backfill_fix_regions.py --show-unknown   # print unmapped jurados
"""

from __future__ import annotations

import sys
import httpx

from utils import make_supabase, BASE_URL, ID_PROCESO, HEADERS

DRY_RUN      = "--dry-run"     in sys.argv
SHOW_UNKNOWN = "--show-unknown" in sys.argv

# ── Jurado → electoral district map ──────────────────────────────────────────
#
# Any jurado that starts with "LIMA" (case-insensitive) is Lima Metropolitana
# (handled separately in jurado_to_district below).
#
# Lima Provincias circuits: these are the provincial capitals of the Lima
# department that form the "Lima Provincias" electoral district.
#
JURADO_TO_DISTRICT: dict[str, str] = {
    # Lima Provincias
    "HUAURA":            "Lima Provincias",
    "CAÑETE":            "Lima Provincias",
    "BARRANCA":          "Lima Provincias",
    "HUAROCHIRI":        "Lima Provincias",
    "YAUYOS":            "Lima Provincias",
    "MATUCANA":          "Lima Provincias",
    "HUACHO":            "Lima Provincias",   # Huaura province capital alias

    # Other departments (one or more circuits per dept, all map to the same name)
    "ABANCAY":           "Apurimac",
    "ANDAHUAYLALAS":     "Apurimac",
    "AREQUIPA":          "Arequipa",
    "CAJAMARCA":         "Cajamarca",
    "CALLAO":            "Callao",
    "CHACHAPOYAS":       "Amazonas",
    "CHICLAYO":          "Lambayeque",
    "CORONEL PORTILLO":  "Ucayali",
    "CUSCO":             "Cusco",
    "HUAMANGA":          "Ayacucho",
    "HUANCAVELICA":      "Huancavelica",
    "HUANCAYO":          "Junin",
    "HUANUCO":           "Huanuco",
    "HUARAZ":            "Ancash",
    "ICA":               "Ica",
    "MARISCAL NIETO":    "Moquegua",
    "MAYNAS":            "Loreto",
    "PASCO":             "Pasco",
    "PIURA":             "Piura",
    "PUNO":              "Puno",
    "SAN MARTIN":        "San Martin",
    "TACNA":             "Tacna",
    "TAMBOPATA":         "Madre De Dios",
    "TRUJILLO":          "La Libertad",
    "TUMBES":            "Tumbes",
}


def jurado_to_district(jurado_raw: str) -> str | None:
    """Map a JNE electoral circuit name to the electoral district name."""
    j = jurado_raw.upper().strip()

    # Any circuit that starts with "LIMA" is Lima Metropolitana
    if j.startswith("LIMA"):
        return "Lima Metropolitana"

    # Direct lookup
    dist = JURADO_TO_DISTRICT.get(j)
    if dist:
        return dist

    # Strip trailing number (e.g. "AREQUIPA 1" → "AREQUIPA", "PIURA 1" → "PIURA")
    parts = j.rsplit(None, 1)
    if len(parts) == 2 and parts[1].isdigit():
        dist = JURADO_TO_DISTRICT.get(parts[0])
        if dist:
            return dist

    return None


# ── Fetch deputies from JNE API ───────────────────────────────────────────────

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
    return r.json().get("data") or []


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    supabase = make_supabase()

    print("Fetching deputies from JNE API…")
    with httpx.Client() as client:
        jne_candidates = fetch_deputies(client)
    print(f"  {len(jne_candidates)} deputies in JNE list")

    # Build DNI → (district, jurado) map using jurado as primary signal
    dni_to_district: dict[str, str] = {}
    unknown_jurados: set[str] = set()

    for c in jne_candidates:
        dni    = (c.get("strDocumentoIdentidad") or "").strip()
        jurado = (c.get("strJuradoElectoralCreacion") or "").strip()
        if not dni:
            continue

        district = jurado_to_district(jurado) if jurado else None

        # Fallback: use strDepartamento if jurado mapping fails
        if not district:
            dept = (c.get("strDepartamento") or "").strip().title()
            if dept and dept.upper() not in ("LIMA",):
                district = dept
            elif dept.upper() == "LIMA":
                # If jurado not mapped, default Lima → Lima Provincias
                # (Lima Metropolitana jurados all start with "LIMA" and are caught above)
                district = "Lima Provincias"

        if district:
            dni_to_district[dni] = district
        elif jurado:
            unknown_jurados.add(jurado)

    print(f"  {len(dni_to_district)} deputies mapped to districts")
    if unknown_jurados and SHOW_UNKNOWN:
        print(f"  {len(unknown_jurados)} unknown jurados:")
        for j in sorted(unknown_jurados):
            count = sum(
                1 for c in jne_candidates
                if (c.get("strJuradoElectoralCreacion") or "").strip() == j
            )
            print(f"    {j!r} → {count} candidates")

    # ── Fetch all deputies from DB ─────────────────────────────────────────
    print("\nFetching deputies from DB…")
    rows, offset = [], 0
    while True:
        batch = (
            supabase.table("candidates")
            .select("id, nombres, apellidos, dni, region")
            .eq("cargo", "congresista")
            .not_.is_("dni", "null")
            .range(offset, offset + 999)
            .execute()
            .data
        )
        rows.extend(batch)
        if len(batch) < 1000:
            break
        offset += 1000
    print(f"  {len(rows)} deputies in DB")

    # ── Apply updates ──────────────────────────────────────────────────────
    updated = 0
    unchanged = 0
    not_found = 0

    for row in rows:
        dni         = row["dni"]
        current     = row["region"] or ""
        new_district = dni_to_district.get(dni)
        name        = f"{row['nombres']} {row['apellidos']}"

        if not new_district:
            not_found += 1
            continue

        if current == new_district:
            unchanged += 1
            continue

        updated += 1
        print(f"  {name} | {current!r} → {new_district!r}")

        if not DRY_RUN:
            cand_id = row["id"]
            # Update candidates table
            supabase.table("candidates") \
                .update({"region": new_district}) \
                .eq("id", cand_id) \
                .execute()
            # Update formula_members table (used by the profile page)
            supabase.table("formula_members") \
                .update({"region": new_district}) \
                .eq("candidate_id", cand_id) \
                .in_("cargo", ["congresista"]) \
                .execute()

    print(f"\nDone.")
    print(f"  Updated  : {updated}")
    print(f"  Unchanged: {unchanged}")
    print(f"  Not found: {not_found}")
    if DRY_RUN:
        print("[DRY RUN] No changes written.")


if __name__ == "__main__":
    main()
