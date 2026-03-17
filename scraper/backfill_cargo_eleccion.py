"""
backfill_cargo_eleccion.py — Populate cargo_eleccion from lCargoEleccion + lCargoPartidario.

Captures both elected positions (lCargoEleccion) and internal party
roles (lCargoPartidario), distinguished by the `tipo` column.

Requires the cargo_eleccion table with a tipo column (run migration first):

  CREATE TABLE IF NOT EXISTS cargo_eleccion (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id    UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    cargo           TEXT NOT NULL,
    entidad         TEXT,
    distrito        TEXT,
    year_inicio     INTEGER,
    year_fin        INTEGER,
    partido         TEXT,
    tipo            TEXT NOT NULL DEFAULT 'eleccion',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- If the table already exists, add the column:
  ALTER TABLE cargo_eleccion ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'eleccion';

Usage:
    cd scraper
    python3 backfill_cargo_eleccion.py
"""

from __future__ import annotations

import sys
import time
import httpx

from utils import make_supabase, fetch_all_candidates, get_hv, to_int, REQUEST_DELAY


def parse_cargos(data: dict, uuid: str) -> list[dict]:
    records = []

    for c in data.get("lCargoEleccion") or []:
        cargo = (c.get("strCargoEleccion2") or "").strip()
        if not cargo:
            continue
        records.append({
            "candidate_id": uuid,
            "tipo":        "eleccion",
            "cargo":       cargo,
            "year_inicio": to_int(c.get("strAnioCargoElecDesde")),
            "year_fin":    to_int(c.get("strAnioCargoElecHasta")),
            "partido":     c.get("strOrgPolCargoElec"),
        })

    for c in data.get("lCargoPartidario") or []:
        cargo = (c.get("strCargoPartidario") or "").strip()
        if not cargo:
            continue
        records.append({
            "candidate_id": uuid,
            "tipo":        "partidario",
            "cargo":       cargo,
            "year_inicio": to_int(c.get("strAnioCargoPartiDesde")),
            "year_fin":    to_int(c.get("strAnioCargoPartiHasta")),
            "partido":     c.get("strOrgPolCargoPartidario"),
        })

    return records


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

            records = parse_cargos(data, uuid)
            if not records:
                continue

            found += 1
            print(f"\r  [{i}/{total}] {nombre} → {len(records)} cargo(s) de elección          ")

            supabase.table("cargo_eleccion").delete().eq("candidate_id", uuid).execute()
            supabase.table("cargo_eleccion").insert(records).execute()

    print(f"\nDone. {found}/{total} candidates had cargos de elección.")


if __name__ == "__main__":
    main()
