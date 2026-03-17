"""
check_api.py — Quick probe of the JNE Voto Informado API.
Prints raw JSON for each key endpoint so we can see real field names.

Usage:
    cd scraper
    pip install httpx python-dotenv
    python check_api.py
"""

import json
import httpx

BASE_URL = "https://web.jne.gob.pe/serviciovotoinformado/api/votoinf"
ALT_URL  = "https://apiplataformaelectoral3.jne.gob.pe/api/v1"

ID_PROCESO = 124

HEADERS = {
    "Content-Type": "application/json",
    "Accept":        "application/json",
    "Origin":        "https://votoinformado.jne.gob.pe",
    "Referer":       "https://votoinformado.jne.gob.pe/",
}


def pp(label: str, data):
    print(f"\n{'='*60}")
    print(f"  {label}")
    print(f"{'='*60}")
    print(json.dumps(data, ensure_ascii=False, indent=2)[:4000])
    print("  ... (truncated)" if len(json.dumps(data)) > 4000 else "")


def post(client: httpx.Client, path: str, body: dict):
    url = f"{BASE_URL}/{path}"
    print(f"\n>>> POST {url}")
    r = client.post(url, json=body, headers=HEADERS, timeout=30)
    print(f"    status: {r.status_code}")
    return r.json()


def get(client: httpx.Client, url: str, params: dict = None):
    print(f"\n>>> GET {url}  params={params}")
    r = client.get(url, params=params, headers=HEADERS, timeout=30)
    print(f"    status: {r.status_code}")
    return r.json()


with httpx.Client() as client:

    # ── 1. listarCanditatos (idTipoEleccion=1 → fórmulas presidenciales) ──
    data = post(client, "listarCanditatos", {
        "idProcesoElectoral": ID_PROCESO,
        "strUbiDepartamento": "",
        "idTipoEleccion": 1,
    })
    pp("listarCanditatos  idTipoEleccion=1  (first 3 items)", data[:3] if isinstance(data, list) else data)

    if isinstance(data, list) and data:
        first = data[0]
        print("\n>>> Keys in first candidate:", list(first.keys()))

        # Try to find a DNI and partido ID for the next call
        dni        = first.get("strDocumentoIdentidad") or first.get("dni") or ""
        partido_id = str(first.get("idOrganizacionPolitica") or first.get("idPartido") or "")
        hv_id      = str(first.get("idHojaVida") or first.get("idCandidato") or "")

        print(f"    dni={dni!r}  partido_id={partido_id!r}  hv_id={hv_id!r}")
    else:
        # Not a list — inspect structure
        print("\n>>> Response is NOT a list. Keys:", list(data.keys()) if isinstance(data, dict) else type(data))
        # Try common wrapper keys
        inner = (data.get("data") or data.get("result") or data.get("candidatos") or []) if isinstance(data, dict) else []
        if inner:
            first = inner[0]
            print(">>> Keys in first item:", list(first.keys()))
            dni        = first.get("strDocumentoIdentidad") or first.get("dni") or ""
            partido_id = str(first.get("idOrganizacionPolitica") or "")
            hv_id      = str(first.get("idHojaVida") or first.get("idCandidato") or "")
        else:
            dni = partido_id = hv_id = ""

    # ── 2. listarCanditatos idTipoEleccion=2 (senadores?) ──
    data2 = post(client, "listarCanditatos", {
        "idProcesoElectoral": ID_PROCESO,
        "strUbiDepartamento": "",
        "idTipoEleccion": 2,
    })
    if isinstance(data2, list):
        print(f"\n>>> idTipoEleccion=2 returned {len(data2)} items")
        if data2:
            print("    Keys:", list(data2[0].keys()))
    else:
        pp("listarCanditatos idTipoEleccion=2", data2)

    # ── 3. listarCanditatos idTipoEleccion=3 (congresistas?) ──
    data3 = post(client, "listarCanditatos", {
        "idProcesoElectoral": ID_PROCESO,
        "strUbiDepartamento": "",
        "idTipoEleccion": 3,
    })
    if isinstance(data3, list):
        print(f"\n>>> idTipoEleccion=3 returned {len(data3)} items")
        if data3:
            print("    Keys:", list(data3[0].keys()))
    else:
        pp("listarCanditatos idTipoEleccion=3", data3)

    # ── 4. HVConsolidado (hoja de vida) ──
    if dni and partido_id:
        hv = post(client, "HVConsolidado", {
            "idProcesoElectoral": ID_PROCESO,
            "strDocumentoIdentidad": dni,
            "idOrganizacionPolitica": partido_id,
        })
        pp("HVConsolidado (first candidate)", hv)
        if isinstance(hv, dict):
            print("\n>>> Top-level keys in HVConsolidado:", list(hv.keys()))

    # ── 5. hojavida ──
    if hv_id:
        hv2 = get(client, f"{BASE_URL}/hojavida", params={"idHojaVida": hv_id})
        pp("hojavida", hv2)
        if isinstance(hv2, dict):
            print("\n>>> Top-level keys in hojavida:", list(hv2.keys()))

    # ── 6. anotacion-marginal (procesos judiciales) ──
    if hv_id:
        proc = get(client, f"{ALT_URL}/candidato/anotacion-marginal", params={"IdHojaVida": hv_id})
        pp("anotacion-marginal", proc)

    # ── 7. plangobierno ──
    planes = post(client, "plangobierno", {
        "pageSize": 3,
        "skip": 1,
        "filter": {
            "idProcesoElectoral": ID_PROCESO,
            "idTipoEleccion": "1",
            "idOrganizacionPolitica": partido_id or "",
            "txDatoCandidato": "",
            "idJuradoElectoral": "0",
        }
    })
    pp("plangobierno", planes)
    if isinstance(planes, dict):
        print("\n>>> Top-level keys in plangobierno:", list(planes.keys()))

    # ── 8. detalle-plangobierno ──
    plan_id = None
    if isinstance(planes, list) and planes:
        plan_id = planes[0].get("idPlanGobierno") or planes[0].get("id")
    elif isinstance(planes, dict):
        items = planes.get("data") or planes.get("result") or planes.get("planes") or []
        if items:
            plan_id = items[0].get("idPlanGobierno") or items[0].get("id")

    if plan_id:
        detail = get(client, f"{BASE_URL}/detalle-plangobierno", params={"IdPlanGobierno": plan_id})
        pp("detalle-plangobierno", detail)
