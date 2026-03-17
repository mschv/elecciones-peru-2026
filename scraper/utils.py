"""
Shared utilities for all backfill scripts.
"""

from __future__ import annotations

import os
import time
import httpx
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

BASE_URL    = "https://web.jne.gob.pe/serviciovotoinformado/api/votoinf"
ID_PROCESO  = 124
REQUEST_DELAY = 1.2

HEADERS = {
    "Content-Type": "application/json",
    "Accept":        "application/json",
    "Origin":        "https://votoinformado.jne.gob.pe",
    "Referer":       "https://votoinformado.jne.gob.pe/",
}


def make_supabase() -> Client:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env")
    return create_client(url, key)


def fetch_all_candidates(supabase: Client) -> list:
    """Return all candidates that have a DNI, with their partido's jne_partido_id."""
    PAGE = 1000
    rows, offset = [], 0
    while True:
        batch = (
            supabase.table("candidates")
            .select("id, nombres, apellidos, dni, partido:partido_id(jne_partido_id)")
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


def get_hv(client: httpx.Client, dni: str, jne_partido_id: str) -> dict | None:
    """
    Call HVConsolidado for a candidate. Returns the data payload or None.
    Retries up to 3 times with exponential back-off.
    """
    for attempt in range(3):
        try:
            r = client.post(
                f"{BASE_URL}/HVConsolidado",
                json={
                    "idProcesoElectoral":     ID_PROCESO,
                    "strDocumentoIdentidad":  dni,
                    "idOrganizacionPolitica": str(jne_partido_id or ""),
                },
                headers=HEADERS,
                timeout=30,
            )
            r.raise_for_status()
            raw = r.json()
            # Accept both {"data": {...}} and flat-dict shapes
            data = raw.get("data") or (
                raw if isinstance(raw, dict) and any(
                    k in raw for k in (
                        "oEduBasica", "lEduUniversitaria", "lAnotacionMarginal",
                        "lSentenciaPenal", "oIngresos",
                    )
                ) else None
            )
            return data
        except Exception as e:
            if attempt == 2:
                print(f"  [API error] DNI {dni}: {e}")
                return None
            time.sleep(2 ** attempt)
    return None


def db_retry(fn, retries: int = 5, base_delay: float = 3.0):
    """
    Call fn() and retry on transient network/Supabase errors (ReadError,
    ConnectError, 5xx). Raises on the final attempt.
    """
    for attempt in range(retries):
        try:
            return fn()
        except Exception as e:
            err = str(e).lower()
            transient = (
                isinstance(e, (httpx.ReadError, httpx.ConnectError,
                               httpx.RemoteProtocolError, httpx.TimeoutException))
                or any(x in err for x in ["connection reset", "502", "503", "504", "500",
                                           "read error", "connect error"])
            )
            if not transient or attempt == retries - 1:
                raise
            delay = base_delay * (2 ** attempt)
            print(f"\n  [DB retry {attempt + 1}/{retries}] {type(e).__name__} — waiting {delay:.0f}s…")
            time.sleep(delay)


def to_float(val) -> float | None:
    try:
        return float(val) if val is not None else None
    except (ValueError, TypeError):
        return None


def to_int(val) -> int | None:
    try:
        v = int(str(val))
        return v if v != 0 else None
    except (TypeError, ValueError):
        return None
