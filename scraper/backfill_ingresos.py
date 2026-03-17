"""
backfill_ingresos.py — Populate ingresos table from oIngresos.

The patrimonio table stores only a single ingresos_anuales total.
This script populates the new ingresos table with the full breakdown:
  - cargo_publico   (public sector salary)
  - cargo_privado   (private sector salary)
  - otros_ingresos  (other income)
  - total_ingresos  (declared total, or computed sum)
  - year            (declaration year)

Requires the ingresos table (run migration first):

  CREATE TABLE IF NOT EXISTS ingresos (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id    UUID NOT NULL UNIQUE REFERENCES candidates(id) ON DELETE CASCADE,
    cargo_publico   NUMERIC,
    cargo_privado   NUMERIC,
    otros_ingresos  NUMERIC,
    total_ingresos  NUMERIC,
    year            INTEGER,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

Usage:
    cd scraper
    python3 backfill_ingresos.py
"""

from __future__ import annotations

import sys
import time
import httpx

from utils import make_supabase, fetch_all_candidates, get_hv, to_float, to_int, REQUEST_DELAY


def parse_ingresos(data: dict, uuid: str) -> dict | None:
    ing = data.get("oIngresos") or {}
    if not ing:
        return None

    # Public sector — try multiple field name variants
    pub = to_float(
        ing.get("decRemuBrutaPublico") or
        ing.get("nroIngresoCargoPub") or
        ing.get("nroIngresoCargoPublico") or
        ing.get("dblIngresoCargoPub")
    )
    pub_renta = to_float(
        ing.get("decRentaIndividualPublico") or
        ing.get("nroRentaPublico")
    )
    pub_otros = to_float(
        ing.get("decOtroIngresoPublico") or
        ing.get("nroOtroIngresoPublico")
    )

    # Private sector
    priv = to_float(
        ing.get("decRemuBrutaPrivado") or
        ing.get("nroIngresoCargoPri") or
        ing.get("nroIngresoCargoPriva") or
        ing.get("dblIngresoCargoPri")
    )
    priv_renta = to_float(
        ing.get("decRentaIndividualPrivado") or
        ing.get("nroRentaPrivado")
    )
    priv_otros = to_float(
        ing.get("decOtroIngresoPrivado") or
        ing.get("nroOtroIngresoPrivado")
    )

    # Aggregate public and private components
    cargo_pub  = sum(filter(None, [pub, pub_renta, pub_otros])) or None
    cargo_priv = sum(filter(None, [priv, priv_renta, priv_otros])) or None

    otros = to_float(
        ing.get("nroIngresoOtros") or
        ing.get("dblIngresoOtros")
    )

    total = to_float(
        ing.get("nroIngresoTotal") or
        ing.get("dblIngresoTotal")
    )
    if total is None and any(x is not None for x in [cargo_pub, cargo_priv, otros]):
        total = (cargo_pub or 0) + (cargo_priv or 0) + (otros or 0)
        total = total or None

    year = to_int(ing.get("strAnioIngresos") or ing.get("nroAnio"))

    if not any(x is not None for x in [cargo_pub, cargo_priv, otros, total]):
        return None

    return {
        "candidate_id":   uuid,
        "cargo_publico":  cargo_pub,
        "cargo_privado":  cargo_priv,
        "otros_ingresos": otros,
        "total_ingresos": total,
        "year":           year,
    }


def main() -> None:
    supabase = make_supabase()

    print("Fetching all candidates with DNI…")
    candidates = fetch_all_candidates(supabase)
    total = len(candidates)
    print(f"  {total} candidates to process\n")

    found = 0
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

            record = parse_ingresos(data, uuid)
            if not record:
                continue

            found += 1
            total_s = f"S/ {record['total_ingresos']:,.0f}" if record["total_ingresos"] else "sin total"
            print(f"\r  [{i}/{total}] {nombre} → {total_s}          ")

            supabase.table("ingresos").upsert(
                record,
                on_conflict="candidate_id",
            ).execute()

    print(f"\nDone. {found}/{total} candidates had ingresos data.")


if __name__ == "__main__":
    main()
