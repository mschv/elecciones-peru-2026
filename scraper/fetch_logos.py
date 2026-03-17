"""
fetch_logos.py — Populate logo_url for all parties from JNE SROP.

The JNE SROP endpoint returns a party's logo image given its
idOrganizacionPolitica (jne_partido_id stored in our DB).

Usage:
    cd scraper
    python fetch_logos.py
"""

from __future__ import annotations

import os
import httpx
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

LOGO_BASE = "https://sroppublico.jne.gob.pe/Consulta/Simbolo/GetSimbolo"

def logo_url_for(jne_partido_id: str) -> str:
    return f"{LOGO_BASE}?id={jne_partido_id}"

def is_image(response: httpx.Response) -> bool:
    ct = response.headers.get("content-type", "")
    return response.status_code == 200 and ("image" in ct or len(response.content) > 500)

def main():
    # Fetch all parties that have a jne_partido_id (and optionally missing logo_url)
    res = supabase.table("partidos").select("id, nombre, jne_partido_id, logo_url").execute()
    parties = res.data or []
    print(f"Found {len(parties)} parties total")

    to_update = [p for p in parties if p.get("jne_partido_id")]
    print(f"  {len(to_update)} have jne_partido_id, fetching logos...\n")

    updated = 0
    failed = 0

    with httpx.Client(timeout=15, follow_redirects=True) as client:
        for p in to_update:
            jne_id = p["jne_partido_id"]
            url = logo_url_for(jne_id)
            try:
                r = client.get(url)
                if is_image(r):
                    supabase.table("partidos").update({"logo_url": url}).eq("id", p["id"]).execute()
                    print(f"  ✓ {p['nombre']:40s}  {url}")
                    updated += 1
                else:
                    print(f"  ✗ {p['nombre']:40s}  HTTP {r.status_code} — not an image")
                    failed += 1
            except Exception as e:
                print(f"  ✗ {p['nombre']:40s}  error: {e}")
                failed += 1

    print(f"\nDone: {updated} updated, {failed} failed.")

if __name__ == "__main__":
    main()
