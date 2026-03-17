"""
backfill_bienes.py — Populate bienes table from lBienInmueble + lBienMueble.

Requires the bienes table (run migration first):

  CREATE TABLE IF NOT EXISTS bienes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id    UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    tipo            TEXT NOT NULL,   -- 'inmueble' | 'mueble'
    descripcion     TEXT,
    valor_autoavaluo NUMERIC,
    valor_estimado  NUMERIC,
    ubicacion       TEXT,
    placa           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

Usage:
    cd scraper
    python3 backfill_bienes.py
"""

from __future__ import annotations

import sys
import time
import httpx

from utils import make_supabase, fetch_all_candidates, get_hv, to_float, db_retry, REQUEST_DELAY


def parse_bienes(data: dict, uuid: str) -> list[dict]:
    records = []

    for b in data.get("lBienInmueble") or []:
        records.append({
            "candidate_id":     uuid,
            "tipo":             "inmueble",
            "descripcion":      b.get("strTipoBienInmueble"),
            "valor_autoavaluo": to_float(b.get("decAutovaluo")),
            "valor_estimado":   to_float(b.get("decValor")),
            "ubicacion":        b.get("strInmuebleDireccion"),
        })

    for b in data.get("lBienMueble") or []:
        records.append({
            "candidate_id":   uuid,
            "tipo":           "mueble",
            "descripcion":    b.get("strVehiculo"),
            "valor_estimado": to_float(b.get("decValor")),
            "placa":          (b.get("strPlaca") or "").strip() or None,
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

            records = parse_bienes(data, uuid)
            if not records:
                continue

            found += 1
            print(f"\r  [{i}/{total}] {nombre} → {len(records)} bien(es)          ")

            db_retry(lambda: supabase.table("bienes").delete().eq("candidate_id", uuid).execute())
            db_retry(lambda: supabase.table("bienes").insert(records).execute())

    print(f"\nDone. {found}/{total} candidates had bienes declarados.")


if __name__ == "__main__":
    main()
