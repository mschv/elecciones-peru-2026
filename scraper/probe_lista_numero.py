"""
probe_lista_numero.py
=====================
Probes the JNE API to find where the party list number (número de lista)
is stored for deputy candidates.

The "número de lista" (e.g., "Lista N°5") is assigned by the JNE and
printed on the ballot. We need to find the API field that contains it.

This script tries several possible endpoints and prints what it finds,
so we can identify the right field and update the scraper.

Usage:
    cd scraper
    python3 probe_lista_numero.py
"""

import json
import httpx
from utils import BASE_URL, ID_PROCESO, HEADERS


def try_endpoint(client: httpx.Client, path: str, body: dict) -> dict | None:
    try:
        r = client.post(f"{BASE_URL}/{path}", json=body, headers=HEADERS, timeout=30)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        print(f"  [error] {path}: {e}")
        return None


with httpx.Client() as client:
    print("=" * 60)
    print("Probing listarCanditatos for intNroLista or similar…")
    print("=" * 60)

    r = client.post(
        f"{BASE_URL}/listarCanditatos",
        json={"idProcesoElectoral": ID_PROCESO, "strUbiDepartamento": "", "idTipoEleccion": 15},
        headers=HEADERS, timeout=60,
    )
    data = r.json().get("data") or []
    if data:
        sample = data[0]
        print("All fields in listarCanditatos:")
        for k, v in sorted(sample.items()):
            if "nro" in k.lower() or "lista" in k.lower() or "numero" in k.lower() or "order" in k.lower():
                print(f"  *** {k}: {v!r}  ← potential list number")
            else:
                print(f"  {k}: {v!r}")

    print("\n" + "=" * 60)
    print("Trying listarListas endpoint…")
    print("=" * 60)
    res = try_endpoint(client, "listarListas", {"idProcesoElectoral": ID_PROCESO, "idTipoEleccion": 15})
    if res:
        print(json.dumps(res if isinstance(res, list) else res, ensure_ascii=False, indent=2)[:2000])

    print("\n" + "=" * 60)
    print("Trying listarFormulas endpoint…")
    print("=" * 60)
    res = try_endpoint(client, "listarFormulas", {"idProcesoElectoral": ID_PROCESO, "idTipoEleccion": 15})
    if res:
        print(json.dumps(res, ensure_ascii=False, indent=2)[:2000])

    print("\n" + "=" * 60)
    print("Checking oInfoAdicional + lCargoElecPostula in HVConsolidado for a deputy…")
    print("=" * 60)
    # Use a known deputy DNI
    sample_deputy = next((c for c in data if c.get("strDocumentoIdentidad")), None)
    if sample_deputy:
        dni    = sample_deputy["strDocumentoIdentidad"]
        org_id = str(sample_deputy["idOrganizacionPolitica"])
        print(f"  DNI: {dni}, Org: {org_id}")
        hv_r = client.post(
            f"{BASE_URL}/HVConsolidado",
            json={"idProcesoElectoral": ID_PROCESO,
                  "strDocumentoIdentidad": dni,
                  "idOrganizacionPolitica": org_id},
            headers=HEADERS, timeout=30,
        )
        hv = hv_r.json().get("data") or hv_r.json()
        postula = hv.get("lCargoElecPostula") or []
        historico = hv.get("lCargoElecHistorico") or []
        info_adic = hv.get("oInfoAdicional") or {}
        print(f"\n  lCargoElecPostula ({len(postula)} items):")
        print(json.dumps(postula, ensure_ascii=False, indent=4))
        print(f"\n  oInfoAdicional:")
        print(json.dumps(info_adic, ensure_ascii=False, indent=4))
        if historico:
            print(f"\n  lCargoElecHistorico (first item):")
            print(json.dumps(historico[0], ensure_ascii=False, indent=4))
