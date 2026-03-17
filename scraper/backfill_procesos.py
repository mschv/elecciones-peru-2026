"""
Backfill procesos_judiciales for all candidates.

Fetches HVConsolidado from JNE for every candidate that has a DNI,
clears their existing procesos_judiciales rows, and re-inserts with
the corrected column names (caso / entidad instead of expediente / instancia).

Usage:
    cd scraper
    python3 backfill_procesos.py
"""

from __future__ import annotations

import os
import sys
import time
import httpx
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

BASE_URL   = "https://web.jne.gob.pe/serviciovotoinformado/api/votoinf"
ID_PROCESO = 124
HEADERS = {
    "Content-Type": "application/json",
    "Accept":        "application/json",
    "Origin":        "https://votoinformado.jne.gob.pe",
    "Referer":       "https://votoinformado.jne.gob.pe/",
}
REQUEST_DELAY = 1.2

STATUS_MAP = {
    "en curso":         "en_curso",
    "en proceso":       "en_curso",
    "complementario":   "en_curso",
    "investigacion":    "en_curso",   "investigación":    "en_curso",
    "acusacion":        "en_curso",   "acusación":        "en_curso",
    "juicio":           "en_curso",
    "en apelacion":     "en_apelacion", "en apelación":   "en_apelacion",
    "apelacion":        "en_apelacion", "apelación":      "en_apelacion",
    "sentencia firme":  "sentencia_condenatoria",
    "sentencia":        "sentencia_condenatoria",
    "condenatoria":     "sentencia_condenatoria",
    "absolutoria":      "sentencia_absolutoria",
    "absuelto":         "sentencia_absolutoria",
    "sobreseimiento":   "archivado",
    "dato falso":       "archivado",
    "dato erroneo":     "archivado",  "dato erróneo":     "archivado",
    "archivado":        "archivado",  "archivo":          "archivado",
    "anulado":          "anulado",
    "prescrito":        "prescrito",
}


def parse_int(val) -> int | None:
    try:
        v = int(str(val))
        return v if v != 0 else None
    except (TypeError, ValueError):
        return None


def api_post(client: httpx.Client, endpoint: str, payload: dict) -> dict | None:
    url = f"{BASE_URL}/{endpoint}"
    for attempt in range(3):
        try:
            r = client.post(url, json=payload, headers=HEADERS, timeout=30)
            r.raise_for_status()
            return r.json()
        except Exception as e:
            if attempt == 2:
                print(f"      [API error] {endpoint}: {e}")
                return None
            time.sleep(2 ** attempt)
    return None


def upsert_procesos(data: dict, uuid: str) -> int:
    procesos = data.get("lAnotacionMarginal") or []
    if not procesos:
        supabase.table("procesos_judiciales").delete().eq("candidate_id", uuid).execute()
        return 0
    records = []
    for p in procesos:
        raw_status = (p.get("strEstado") or p.get("strTipoAnotacion") or "").lower()
        matched = next((v for k, v in STATUS_MAP.items() if k in raw_status), None)
        if matched is None:
            print(f"\n      [unknown_proceso_status] DNI {uuid}: unrecognized JNE status: '{raw_status}'")
        status = matched or "archivado"
        records.append({
            "candidate_id": uuid,
            "caso":    (p.get("strExpediente") or p.get("txExpediente") or "Sin expediente").strip(),
            "delito":  (p.get("txDelito") or p.get("strDelito") or p.get("strAnotacion") or "No especificado"),
            "entidad": (p.get("strJuzgado") or p.get("txJuzgado") or p.get("strFiscalia") or None),
            "status":  status,
            "year_inicio": parse_int(p.get("strAnio") or p.get("nroAnio")),
        })
    supabase.table("procesos_judiciales").delete().eq("candidate_id", uuid).execute()
    supabase.table("procesos_judiciales").insert(records).execute()
    return len(records)


def fetch_all_candidates() -> list:
    PAGE = 1000
    rows, offset = [], 0
    while True:
        batch = (
            supabase.table("candidates")
            .select("id, dni, partido:partido_id ( jne_partido_id )")
            .not_.is_("dni", "null")
            .range(offset, offset + PAGE - 1)
            .execute()
            .data
        )
        rows.extend(batch)
        if len(batch) < PAGE:
            break
        offset += PAGE
    return rows


def main() -> None:
    print("Fetching all candidates with DNI...")
    rows = fetch_all_candidates()
    total = len(rows)
    print(f"  {total} candidates to process\n")

    found = 0
    with httpx.Client() as client:
        for i, row in enumerate(rows, 1):
            uuid = row["id"]
            dni  = row["dni"]
            jne_partido_id = (row.get("partido") or {}).get("jne_partido_id") or ""

            sys.stdout.write(f"\r  [{i}/{total}] DNI {dni} ...")
            sys.stdout.flush()

            hv_raw = api_post(client, "HVConsolidado", {
                "idProcesoElectoral":     ID_PROCESO,
                "strDocumentoIdentidad":  dni,
                "idOrganizacionPolitica": str(jne_partido_id),
            })
            time.sleep(REQUEST_DELAY)

            if not hv_raw:
                continue

            data = hv_raw.get("data") or (
                hv_raw if isinstance(hv_raw, dict) and any(
                    k in hv_raw for k in ("oEduBasica", "lEduUniversitaria", "lAnotacionMarginal")
                ) else None
            )
            if not data:
                continue

            n = upsert_procesos(data, uuid)
            if n:
                found += 1
                print(f"\r  [{i}/{total}] DNI {dni} → {n} proceso(s)          ")

    print(f"\nDone. {found}/{total} candidates had procesos judiciales.")


if __name__ == "__main__":
    main()
