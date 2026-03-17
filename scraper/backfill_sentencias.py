"""
backfill_sentencias.py — Replace wrong procesos data with real criminal sentences.

The old scraper used lAnotacionMarginal (JNE administrative corrections) as the
source for procesos_judiciales. This was wrong. The actual criminal sentences
declared by candidates are in lSentenciaPenal.

This script:
1. Deletes ALL existing procesos_judiciales records
2. Loops all candidates with a DNI
3. Fetches HVConsolidado
4. Parses lSentenciaPenal → procesos_judiciales with full sentence details

New columns used (added via migration):
  fallo           — raw sentence verdict (strFalloPenal)
  modalidad       — SUSPENDIDA / EFECTIVA (strModalidad)
  cumple_fallo    — e.g. "PENA CUMPLIDA" (strCumpleFallo)
  fecha_sentencia — sentence date (strFechaSentenciaPenal)
  organo_judicial — court (strOrganoJudiPenal)

Status values:
  sentencia_absolutoria  — absuelto / absolutoria
  pena_cumplida          — sentence served (strCumpleFallo = "PENA CUMPLIDA")
  sentencia_condenatoria — all other convictions
  (lSentenciaPenal entries are all sentences — no en_curso/archivado)

Usage:
    cd scraper
    python3 backfill_sentencias.py

    # Dry-run (no writes, shows what would be inserted):
    python3 backfill_sentencias.py --dry-run
"""

from __future__ import annotations

import sys
import time
import httpx

from utils import make_supabase, fetch_all_candidates, get_hv, to_int, db_retry, REQUEST_DELAY

DRY_RUN = "--dry-run" in sys.argv

UNKNOWN_LOG: list[dict] = []


def map_sentencia_status(fallo: str | None, modalidad: str | None, cumple: str | None) -> str:
    fallo_l    = (fallo    or "").lower()
    cumple_l   = (cumple   or "").lower()
    modalidad_l = (modalidad or "").lower()

    if any(x in fallo_l for x in ["absuelto", "absolutoria", "absuelta", "no culpable"]):
        return "sentencia_absolutoria"

    if "pena cumplida" in cumple_l:
        return "pena_cumplida"

    if any(x in fallo_l for x in [
        "condenado", "condena", "culpable",
        "inhabilitacion", "inhabilitación",
        "pena privativa",
    ]):
        return "sentencia_condenatoria"

    if "suspendida" in modalidad_l or "efectiva" in modalidad_l:
        return "sentencia_condenatoria"

    return "sentencia_condenatoria"  # safe default — all lSentenciaPenal are verdicts


def parse_obligaciones(data: dict, uuid: str) -> list[dict]:
    obligaciones = data.get("lSentenciaObliga") or []
    records = []
    for s in obligaciones:
        expediente = (s.get("strExpedienteObliga") or "Sin expediente").strip()
        records.append({
            "candidate_id":   uuid,
            "caso":           expediente,
            "delito":         s.get("strMateriaSentencia"),
            "entidad":        s.get("strOrganoJuridicialObliga"),
            "status":         "sentencia_civil",
            "year_inicio":    None,
            "fallo":          s.get("strFalloObliga"),
            "modalidad":      None,
            "cumple_fallo":   None,
            "fecha_sentencia": None,
            "organo_judicial": s.get("strOrganoJuridicialObliga"),
        })
    return records


def parse_sentencias(data: dict, uuid: str) -> list[dict]:
    sentencias = data.get("lSentenciaPenal") or []
    records = []
    for s in sentencias:
        fallo     = s.get("strFalloPenal")
        modalidad = s.get("strModalidad")
        cumple    = s.get("strCumpleFallo")
        delito    = (
            s.get("strDelitoPenal") or
            s.get("strDelito") or
            "No especificado"
        )
        organo = (
            s.get("strOrganoJudiPenal") or
            s.get("strOrganoJudicial") or
            s.get("strJuzgado")
        )
        fecha = s.get("strFechaSentenciaPenal") or s.get("strFecha")
        year  = to_int(s.get("strAnio") or s.get("nroAnio"))

        status = map_sentencia_status(fallo, modalidad, cumple)

        expediente = (
            s.get("strExpedientePenal") or
            s.get("strExpediente") or
            s.get("txExpediente") or
            "Sin expediente"
        ).strip()

        if year is None and fecha:
            try:
                year = int(fecha.split("/")[-1].split(" ")[0])
            except (ValueError, IndexError):
                pass

        record: dict = {
            "candidate_id":  uuid,
            "caso":          expediente,
            "delito":        delito,
            "entidad":       organo,
            "status":        status,
            "year_inicio":   year,
            # New columns added by migration:
            "fallo":          fallo,
            "modalidad":      modalidad,
            "cumple_fallo":   cumple,
            "fecha_sentencia": fecha,
            "organo_judicial": organo,
        }
        records.append(record)
    return records


def main() -> None:
    supabase = make_supabase()

    print("Fetching all candidates with DNI…")
    candidates = fetch_all_candidates(supabase)
    total = len(candidates)
    print(f"  {total} candidates to process")

    if not DRY_RUN:
        print("\n⚠  Deleting ALL existing procesos_judiciales records…")
        confirm = input("  Type 'yes' to confirm: ").strip().lower()
        if confirm != "yes":
            print("  Aborted.")
            return
        supabase.table("procesos_judiciales").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
        print("  Deleted.\n")
    else:
        print("\n[DRY RUN] Would delete all procesos_judiciales.\n")

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

            records = parse_sentencias(data, uuid) + parse_obligaciones(data, uuid)
            if not records:
                continue

            found += 1
            print(f"\r  [{i}/{total}] {nombre} → {len(records)} sentencia(s)          ")

            if not DRY_RUN:
                db_retry(lambda: supabase.table("procesos_judiciales").insert(records).execute())

    print(f"\nDone. {found}/{total} candidates had sentencias penales o civiles.")
    if UNKNOWN_LOG:
        print(f"\nUnknown statuses logged ({len(UNKNOWN_LOG)} entries):")
        for u in UNKNOWN_LOG[:20]:
            print(f"  {u}")


if __name__ == "__main__":
    main()
