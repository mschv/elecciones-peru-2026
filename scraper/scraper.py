"""
Elecciones Perú 2026 — JNE Voto Informado Scraper
===================================================
Scrapes all candidate data from the JNE Voto Informado API and
upserts it into Supabase.

Election types handled:
  idTipoEleccion=1   → PRESIDENCIAL  (108 candidates, 36 formulas)
  idTipoEleccion=20  → SENADO DISTRITO ÚNICO      (1131 senators total)
  idTipoEleccion=21  → SENADO DISTRITO MÚLTIPLE   (1833 senators total)
  idTipoEleccion=15  → DIPUTADOS                  (5469 deputies total)
  idTipoEleccion=3   → PARLAMENTO ANDINO           (528 candidates)

These constants were confirmed from the JNE Voto Informado JS bundle:
  TipoEleccion: { presidencial:1, diputados:15, parlamentoAndino:3,
                  senadoresDistritoUnico:20, senadoresDistritoMultiple:21 }

Usage:
    cd scraper
    pip install httpx supabase python-dotenv
    cp .env.example .env   # fill in your keys

    # Scrape everything (takes ~5-6 hours for 7000+ HV calls):
    python scraper.py

    # Quick mode — skip hoja de vida detail (just names/partido):
    python scraper.py --no-hv

    # Scrape only specific types:
    python scraper.py --tipos presidencial
    python scraper.py --tipos presidencial,senate
    python scraper.py --tipos deputies

    Available --tipos values:
        presidencial   → tipo=1  (presidential formulas)
        senate         → tipo=20 + tipo=21 (all senators)
        deputies       → tipo=15 (diputados)
        andino         → tipo=3  (parlamento andino)
        all            → everything (default)

Environment variables (.env):
    SUPABASE_URL=your-supabase-url
    SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
"""

from __future__ import annotations

import sys
import httpx
import time
import os
import re
from datetime import datetime, timezone
from collections import defaultdict
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

# ── Supabase ─────────────────────────────────────────────────────────────────
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── JNE API ───────────────────────────────────────────────────────────────────
BASE_URL   = "https://web.jne.gob.pe/serviciovotoinformado/api/votoinf"
FOTO_BASE  = "https://mpesije.jne.gob.pe/apidocs"      # candidate photo base
LOGO_BASE  = "https://sroppublico.jne.gob.pe/Consulta/Simbolo/GetSimbolo"

ID_PROCESO = 124   # 2026 general election

HEADERS = {
    "Content-Type": "application/json",
    "Accept":        "application/json",
    "Origin":        "https://votoinformado.jne.gob.pe",
    "Referer":       "https://votoinformado.jne.gob.pe/",
}

REQUEST_DELAY = 1.2   # seconds — be respectful to JNE servers

# ── Election type constants (from JNE JS bundle) ──────────────────────────────
TIPO_PRESIDENCIAL            = 1
TIPO_CONGRESAL               = 2   # unused — no data yet
TIPO_PARLAMENTO_ANDINO       = 3
TIPO_DIPUTADOS               = 15
TIPO_SENADO_UNICO            = 20  # national senate list
TIPO_SENADO_MULTIPLE         = 21  # per-region senate lists

# ── Jurado → electoral district ───────────────────────────────────────────────
#
# strDepartamento is unreliable for deputies: 1363 of 5469 have it empty, and
# "LIMA" covers both Lima Metropolitana and Lima Provincias.
# strJuradoElectoralCreacion (the JNE circuit) is the authoritative signal.

_JURADO_TO_DISTRICT: dict[str, str] = {
    # Lima Provincias
    "HUAURA": "Lima Provincias", "CAÑETE": "Lima Provincias",
    "BARRANCA": "Lima Provincias", "HUAROCHIRI": "Lima Provincias",
    "YAUYOS": "Lima Provincias", "MATUCANA": "Lima Provincias",
    "HUACHO": "Lima Provincias",
    # Other departments
    "ABANCAY": "Apurimac", "ANDAHUAYLALAS": "Apurimac",
    "AREQUIPA": "Arequipa",
    "CAJAMARCA": "Cajamarca",
    "CALLAO": "Callao",
    "CHACHAPOYAS": "Amazonas",
    "CHICLAYO": "Lambayeque",
    "CORONEL PORTILLO": "Ucayali",
    "CUSCO": "Cusco",
    "HUAMANGA": "Ayacucho",
    "HUANCAVELICA": "Huancavelica",
    "HUANCAYO": "Junin",
    "HUANUCO": "Huanuco",
    "HUARAZ": "Ancash",
    "ICA": "Ica",
    "MARISCAL NIETO": "Moquegua",
    "MAYNAS": "Loreto",
    "PASCO": "Pasco",
    "PIURA": "Piura",
    "PUNO": "Puno",
    "SAN MARTIN": "San Martin",
    "TACNA": "Tacna",
    "TAMBOPATA": "Madre De Dios",
    "TRUJILLO": "La Libertad",
    "TUMBES": "Tumbes",
}


def deputy_region_from_raw(raw: dict) -> str:
    """
    Derive the correct electoral district for a deputy candidate using
    strJuradoElectoralCreacion as the primary signal, falling back to
    strDepartamento if the jurado is not mapped.
    """
    jurado = (raw.get("strJuradoElectoralCreacion") or "").upper().strip()

    if jurado.startswith("LIMA"):
        return "Lima Metropolitana"

    dist = _JURADO_TO_DISTRICT.get(jurado)
    if dist:
        return dist

    # Strip trailing number suffix (e.g. "AREQUIPA 1" → "AREQUIPA")
    parts = jurado.rsplit(None, 1)
    if len(parts) == 2 and parts[1].isdigit():
        dist = _JURADO_TO_DISTRICT.get(parts[0])
        if dist:
            return dist

    # Fallback: use strDepartamento
    dept = (raw.get("strDepartamento") or "").strip()
    if dept and dept.upper() != "LIMA":
        return dept.title()
    if dept.upper() == "LIMA":
        return "Lima Provincias"

    return "Nacional"


# ── Cargo mappings ────────────────────────────────────────────────────────────

# Presidential formula (idCargo from API → DB enum)
PRES_CARGO_MAP: dict[int, str] = {
    1: "presidente",
    2: "vicepresidente_1",
    3: "vicepresidente_2",
}

# Congress cargo strings (strCargo → DB enum)
CONGRESS_CARGO_MAP: dict[str, str] = {
    "SENADOR":   "senador",
    "DIPUTADO":  "congresista",
    "REPRESENTANTE ANTE EL PARLAMENTO ANDINO": "congresista",
}

# ── Plan dimension keys ───────────────────────────────────────────────────────
DIMENSION_EJE_MAP: dict[str, str] = {
    "dimensionSocial":         "social",
    "dimensionEconomica":      "economico",
    "dimensionAmbiental":      "ambiental",
    "dimensionInstitucional":  "institucional",
}

# ── Helpers ───────────────────────────────────────────────────────────────────

def slugify(text: str) -> str:
    text = text.lower().strip()
    for src, dst in [("á","a"),("é","e"),("í","i"),("ó","o"),("ú","u"),("ñ","n"),("ü","u")]:
        text = text.replace(src, dst)
    text = re.sub(r"[^a-z0-9\s-]", "", text)
    return re.sub(r"\s+", "-", text).strip("-")


def parse_int(val) -> int | None:
    try:
        v = int(str(val))
        return v if v != 0 else None
    except (TypeError, ValueError):
        return None


def parse_float(val) -> float | None:
    try:
        return float(val) if val is not None else None
    except (TypeError, ValueError):
        return None


def parse_date(s: str | None) -> str | None:
    """Parse JNE date strings like '5/10/1980 00:00:00' → 'YYYY-MM-DD'."""
    if not s:
        return None
    s = s.split(" ")[0]
    for fmt in ("%d/%m/%Y", "%m/%d/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(s, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def detect_sector(centro: str) -> str:
    pub_kw = ["ministerio","gobierno","municipalidad","region","ugel",
              "poder judicial","congreso","senado","sunat","essalud",
              "petroperu","sedapal","indeci","minedu","minsa","provias",
              "sunarp","osinergmin","tribunal","fiscalia","mimp",
              "independiente","ffaa","ejercito","marina","fuerza aerea"]
    low = centro.lower()
    return "publico" if any(k in low for k in pub_kw) else "privado"


# ── HTTP ──────────────────────────────────────────────────────────────────────

def api_post(client: httpx.Client, path: str, body: dict) -> dict | None:
    try:
        r = client.post(f"{BASE_URL}/{path}", json=body, headers=HEADERS, timeout=30)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        print(f"  [POST error] {path}: {e}")
        return None


def api_get(client: httpx.Client, path: str, params: dict = None) -> dict | None:
    try:
        r = client.get(f"{BASE_URL}/{path}", params=params, headers=HEADERS, timeout=30)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        print(f"  [GET error] {path}: {e}")
        return None


# ── Fetch candidate list ──────────────────────────────────────────────────────

def fetch_candidates(client: httpx.Client, tipo: int, ubigeo: str = "") -> list[dict]:
    raw = api_post(client, "listarCanditatos", {
        "idProcesoElectoral": ID_PROCESO,
        "strUbiDepartamento": ubigeo,
        "idTipoEleccion":     tipo,
    })
    if not raw:
        return []
    return raw.get("data") or []


# ── Upsert partido ────────────────────────────────────────────────────────────

_party_cache: dict[str, str] = {}   # jne_partido_id → uuid

def upsert_party(raw: dict) -> str | None:
    jne_id = str(raw.get("idOrganizacionPolitica") or "")
    if not jne_id:
        return None
    if jne_id in _party_cache:
        return _party_cache[jne_id]

    nombre = (raw.get("strOrganizacionPolitica") or "").title()
    slug   = slugify(nombre)

    logo_url = f"{LOGO_BASE}?id={jne_id}"

    try:
        res = supabase.table("partidos").upsert(
            {"slug": slug, "nombre": nombre, "jne_partido_id": jne_id, "logo_url": logo_url},
            on_conflict="jne_partido_id",
            returning="representation",
        ).execute()
        uuid = res.data[0]["id"] if res.data else None
        if uuid:
            _party_cache[jne_id] = uuid
        return uuid
    except Exception as e:
        print(f"    [partidos error] {nombre}: {e}")
        return None


# ── Upsert formula ────────────────────────────────────────────────────────────

def upsert_formula(partido_uuid: str, slug: str, activa: bool = True) -> str | None:
    try:
        res = supabase.table("formulas").upsert(
            {"slug": slug, "partido_id": partido_uuid, "activa": activa},
            on_conflict="slug",
            returning="representation",
        ).execute()
        return res.data[0]["id"] if res.data else None
    except Exception as e:
        print(f"    [formulas error] {slug}: {e}")
        return None


# ── Upsert candidate (basic info) ─────────────────────────────────────────────

_candidate_cache: dict[str, str] = {}   # slug → uuid

def upsert_candidate_basic(raw: dict, cargo: str,
                           partido_id: str | None = None,
                           electoral_region: str | None = None,
                           orden: int | None = None) -> tuple[str | None, str]:
    """Upsert candidate with basic info only. Returns (uuid, slug)."""
    nombres   = (raw.get("strNombres") or "").title()
    ap_pat    = (raw.get("strApellidoPaterno") or "").title()
    ap_mat    = (raw.get("strApellidoMaterno") or "").title()
    apellidos = f"{ap_pat} {ap_mat}".strip()
    slug      = slugify(f"{nombres} {apellidos}")

    if slug in _candidate_cache:
        return _candidate_cache[slug], slug

    foto_guid = raw.get("strGuidFoto") or ""
    foto_url  = f"{FOTO_BASE}/{foto_guid}.jpg" if foto_guid else None
    dni       = raw.get("strDocumentoIdentidad") or None
    fecha_nac = parse_date(raw.get("strFechaNacimiento"))
    lugar_nac = (raw.get("strDepartamento") or "").title() or None

    row: dict = {
        "slug":             slug,
        "nombres":          nombres,
        "apellidos":        apellidos,
        "cargo":            cargo,
        "dni":              dni,
        "foto_url":         foto_url,
        "fecha_nacimiento": fecha_nac,
        "lugar_nacimiento": lugar_nac,
    }
    if partido_id:
        row["partido_id"] = partido_id
    if electoral_region:
        row["region"] = electoral_region
    if orden is not None:
        row["orden"] = orden

    try:
        res = supabase.table("candidates").upsert(
            row,
            on_conflict="slug",
            returning="representation",
        ).execute()
        uuid = res.data[0]["id"] if res.data else None
        if uuid:
            _candidate_cache[slug] = uuid
        return uuid, slug
    except Exception as e:
        print(f"    [candidate error] {nombres}: {e}")
        return None, slug


def upsert_candidate_hv(client: httpx.Client, raw: dict, uuid: str) -> None:
    """Fetch HVConsolidado and populate education, experience, procesos, patrimonio."""
    dni       = raw.get("strDocumentoIdentidad") or ""
    partido_id = str(raw.get("idOrganizacionPolitica") or "")
    if not dni:
        return

    hv_raw = api_post(client, "HVConsolidado", {
        "idProcesoElectoral":    ID_PROCESO,
        "strDocumentoIdentidad": dni,
        "idOrganizacionPolitica": partido_id,
    })
    if not hv_raw:
        return
    # Accept both {"success": true, "data": ...} and {"data": ...} shapes
    data = hv_raw.get("data") or (hv_raw if isinstance(hv_raw, dict) and any(
        k in hv_raw for k in ("oEduBasica", "lEduUniversitaria", "lExperienciaLaboral")
    ) else None)
    if not data:
        return
    upsert_education(data, uuid)
    upsert_experience(data, uuid)
    upsert_procesos(data, uuid)
    upsert_patrimonio(data, uuid)


def upsert_formula_member(formula_uuid: str, candidate_uuid: str,
                           cargo: str, orden: int, region: str | None) -> None:
    try:
        supabase.table("formula_members").upsert(
            {
                "formula_id":    formula_uuid,
                "candidate_id":  candidate_uuid,
                "cargo":         cargo,
                "orden":         orden,
                "region":        region,
                "is_incumbent":  False,
                "is_first_time": False,
            },
            on_conflict="formula_id,candidate_id",
        ).execute()
    except Exception as e:
        print(f"    [formula_members error] {e}")


# ── Education ─────────────────────────────────────────────────────────────────

def upsert_education(data: dict, uuid: str) -> None:
    records = []

    edu_basica = data.get("oEduBasica") or {}
    if edu_basica.get("strEduPrimaria") == "1":
        records.append({
            "candidate_id": uuid, "nivel": "primaria",
            "institucion": "No especificado",
            "estado": "completo" if edu_basica.get("strConcluidoEduPrimaria") == "1" else "incompleto",
        })
    if edu_basica.get("strEduSecundaria") == "1":
        records.append({
            "candidate_id": uuid, "nivel": "secundaria",
            "institucion": "No especificado",
            "estado": "completo" if edu_basica.get("strConcluidoEduSecundaria") == "1" else "incompleto",
        })

    edu_tec = data.get("oEduTecnico") or {}
    if edu_tec.get("strTengoEduTecnico") == "1":
        records.append({
            "candidate_id": uuid, "nivel": "tecnico",
            "titulo":      (edu_tec.get("strCarreraTecnico") or "").title() or None,
            "institucion": (edu_tec.get("strInstitutoTecnico") or "No especificado").title(),
            "year_inicio": parse_int(edu_tec.get("strAnioInicioTecnico")),
            "year_fin":    parse_int(edu_tec.get("strAnioFinTecnico")),
            "estado": "completo" if edu_tec.get("strConcluidoEduTecnico") == "1" else "incompleto",
        })

    for edu in data.get("lEduUniversitaria") or []:
        records.append({
            "candidate_id": uuid, "nivel": "universitario",
            "titulo":      (edu.get("strCarreraUni") or "").title() or None,
            "institucion": (edu.get("strUniversidad") or "No especificado").title(),
            "year_fin":    parse_int(edu.get("strAnioTitulo")) or parse_int(edu.get("strAnioBachiller")),
            "estado": "completo" if (edu.get("strConcluidoEduUni") == "1" or edu.get("strEgresadoEduUni") == "1" or edu.get("strTituloUni") == "1" or edu.get("strBachillerEduUni") == "1" or edu.get("strAnioTitulo") or edu.get("strAnioBachiller")) else "incompleto",
        })

    for edu in (data.get("lEduPosgrado") or []) + (data.get("lEduPosgradoOtro") or []):
        records.append({
            "candidate_id": uuid, "nivel": "posgrado",
            "titulo":      (edu.get("strEspecialidadPosgrado") or edu.get("strCarreraPosgrado") or "").title() or None,
            "institucion": (edu.get("strInstitucionPosgrado") or edu.get("strUniversidadPosgrado") or "No especificado").title(),
            "year_fin":    parse_int(edu.get("strAnioPosgrado") or edu.get("strAnioFinPosgrado")),
            "estado": "completo",
        })

    if not records:
        return
    supabase.table("education").delete().eq("candidate_id", uuid).execute()
    supabase.table("education").insert(records).execute()


# ── Experience ────────────────────────────────────────────────────────────────

def upsert_experience(data: dict, uuid: str) -> None:
    exp_list = data.get("lExperienciaLaboral") or []
    if not exp_list:
        return
    records = []
    for exp in exp_list:
        centro    = (exp.get("strCentroTrabajo") or "").title()
        ocupacion = (exp.get("strOcupacionProfesion") or "").title()
        records.append({
            "candidate_id": uuid,
            "cargo":        ocupacion or "No especificado",
            "organizacion": centro or "No especificado",
            "sector":       detect_sector(centro),
            "year_inicio":  parse_int(exp.get("strAnioTrabajoDesde")),
            "year_fin":     parse_int(exp.get("strAnioTrabajoHasta")),
        })
    supabase.table("experience").delete().eq("candidate_id", uuid).execute()
    supabase.table("experience").insert(records).execute()


# ── Procesos judiciales ───────────────────────────────────────────────────────

STATUS_MAP = {
    "en curso":       "en_curso",
    "complementario": "en_curso",
    "investigacion":  "en_curso",   "investigación":  "en_curso",
    "acusacion":      "en_curso",   "acusación":      "en_curso",
    "juicio":         "en_curso",
    "en apelacion":   "en_apelacion", "en apelación": "en_apelacion",
    "apelacion":      "en_apelacion", "apelación":    "en_apelacion",
    "sentencia":      "sentencia_firme",
    "condenatoria":   "sentencia_firme",
    "absolutoria":    "sentencia_firme",
    "archivado":      "archivado",  "archivo":        "archivado",
    "anulado":        "anulado",
    "prescrito":      "prescrito",
}

def upsert_procesos(data: dict, uuid: str) -> None:
    procesos = data.get("lAnotacionMarginal") or []
    if not procesos:
        return
    records = []
    for p in procesos:
        raw_status = (p.get("strEstado") or p.get("strTipoAnotacion") or "").lower()
        status = next((v for k, v in STATUS_MAP.items() if k in raw_status), "en_curso")
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


# ── Patrimonio ────────────────────────────────────────────────────────────────

def upsert_patrimonio(data: dict, uuid: str) -> None:
    ing = data.get("oIngresos") or {}
    total = sum(filter(None, [
        parse_float(ing.get("decRemuBrutaPublico")),
        parse_float(ing.get("decRentaIndividualPublico")),
        parse_float(ing.get("decOtroIngresoPublico")),
        parse_float(ing.get("decRemuBrutaPrivado")),
        parse_float(ing.get("decRentaIndividualPrivado")),
        parse_float(ing.get("decOtroIngresoPrivado")),
    ]))
    bienes = sum(
        parse_float(b.get("decValorBien") or b.get("decValor")) or 0.0
        for b in (data.get("lBienInmueble") or []) + (data.get("lBienMueble") or [])
    )
    if not total and not bienes:
        return
    try:
        supabase.table("patrimonio").upsert(
            {
                "candidate_id":    uuid,
                "ingresos_anuales":  total or None,
                "bienes_declarados": bienes or None,
                "year":              parse_int(ing.get("strAnioIngresos")),
            },
            on_conflict="candidate_id",
        ).execute()
    except Exception as e:
        print(f"    [patrimonio error] {e}")


# ── Plan de gobierno ──────────────────────────────────────────────────────────

def scrape_planes(client: httpx.Client) -> None:
    print("\n[Plan de Gobierno] Fetching plans…")
    page, page_size, total_done = 1, 10, 0

    while True:
        raw = api_post(client, "plangobierno", {
            "pageSize": page_size,
            "skip":     page,
            "filter": {
                "idProcesoElectoral":     ID_PROCESO,
                "idTipoEleccion":         "1",
                "idOrganizacionPolitica": "0",
                "txDatoCandidato":        "",
                "idJuradoElectoral":      "0",
            }
        })
        if not raw:
            break
        items = raw.get("data") or []
        if not items:
            break

        for plan in items:
            jne_pid     = str(plan.get("idOrganizacionPolitica") or "")
            plan_id     = plan.get("idPlanGobierno")
            partido_uuid = _party_cache.get(jne_pid)
            if not partido_uuid or not plan_id:
                continue

            time.sleep(REQUEST_DELAY)
            detail = api_get(client, "detalle-plangobierno",
                             params={"IdPlanGobierno": plan_id})
            if detail:
                _upsert_plan(detail, partido_uuid,
                             plan.get("txRutaResumen"),
                             plan.get("txRutaCompleto"))
                total_done += 1
                print(f"  plan {plan_id} → {plan.get('txOrganizacionPolitica')}")

        if page >= (raw.get("totalPages") or 1):
            break
        page += 1
        time.sleep(REQUEST_DELAY)

    print(f"  {total_done} plans scraped")


def _upsert_plan(detail: dict, partido_uuid: str,
                 resumen_url: str | None, completo_url: str | None) -> None:
    supabase.table("plan_gobierno").delete().eq("partido_id", partido_uuid).execute()
    records, orden = [], 0
    for dim_key, eje in DIMENSION_EJE_MAP.items():
        for prop in detail.get(dim_key) or []:
            problema  = (prop.get("txPgProblema") or "").strip()
            objetivo  = (prop.get("txPgObjetivo") or "").strip()
            indicador = (prop.get("txPgIndicador") or "").strip()
            meta      = (prop.get("txPgMeta") or "").strip()
            titulo    = objetivo[:120] or problema[:120] or "Propuesta"
            desc      = "\n".join(filter(None, [problema, objetivo, indicador, meta])) or None
            records.append({
                            "partido_id": partido_uuid, "eje": eje,
                            "titulo": titulo, "descripcion": desc, "orden": orden,
                            "problema":  problema or None,
                            "objetivo":  objetivo or None,
                            "indicador": indicador or None,
                            "meta":      meta or None,
                            })
            orden += 1
    if not records:
        return
    supabase.table("plan_gobierno").insert(records).execute()

    if resumen_url or completo_url:
        for tipo, url in [("resumen", resumen_url), ("completo", completo_url)]:
            if url:
                supabase.table("plan_gobierno_docs").upsert(
                    {"partido_id": partido_uuid, "tipo": tipo, "url": url},
                    on_conflict="partido_id,tipo",
                ).execute()


# ── Section runners ───────────────────────────────────────────────────────────

def run_presidential(client: httpx.Client, fetch_hv: bool) -> dict[str, str]:
    """Process presidential formulas. Returns {jne_partido_id → formula_uuid}."""
    print("\n═══ PRESIDENCIAL (tipo=1) ═══")
    candidates = fetch_candidates(client, TIPO_PRESIDENCIAL)
    print(f"  {len(candidates)} candidates")

    # Group by party, keep only cargos 1-3
    groups: dict[str, list[dict]] = defaultdict(list)
    for c in candidates:
        if c.get("idCargo") in PRES_CARGO_MAP:
            groups[str(c.get("idOrganizacionPolitica", ""))].append(c)

    party_formula_map: dict[str, str] = {}

    for jne_pid, members in groups.items():
        pres = next((m for m in members if m.get("idCargo") == 1), members[0])
        nombre = (pres.get("strOrganizacionPolitica") or "").title()
        partido_uuid = upsert_party(pres)
        if not partido_uuid:
            continue
        partido_slug = slugify(nombre)
        formula_uuid = upsert_formula(partido_uuid, f"{partido_slug}-2026")
        if not formula_uuid:
            continue
        party_formula_map[jne_pid] = formula_uuid

        print(f"\n  {nombre}")
        for m in sorted(members, key=lambda x: x.get("idCargo", 9)):
            cargo = PRES_CARGO_MAP.get(m["idCargo"], "presidente")
            cand_uuid, slug = upsert_candidate_basic(m, cargo)
            if not cand_uuid:
                continue
            upsert_formula_member(formula_uuid, cand_uuid, cargo,
                                  m.get("intPosicion", 0), None)
            if fetch_hv:
                time.sleep(REQUEST_DELAY)
                upsert_candidate_hv(client, m, cand_uuid)
            print(f"    [{cargo}] {slug}")

        time.sleep(REQUEST_DELAY)

    return party_formula_map


def run_senate(client: httpx.Client, fetch_hv: bool) -> None:
    """Process senators (tipo=20 national + tipo=21 regional)."""
    print("\n═══ SENADO (tipo=20 + tipo=21) ═══")

    for tipo, label in [(TIPO_SENADO_UNICO, "Distrito Único"),
                         (TIPO_SENADO_MULTIPLE, "Distrito Múltiple")]:
        candidates = fetch_candidates(client, tipo)
        print(f"\n  {label}: {len(candidates)} candidates")

        # Group by (partido, departamento)
        # For tipo=20 (national list), region is irrelevant → group by party only
        use_region = (tipo == TIPO_SENADO_MULTIPLE)
        groups: dict[tuple, list[dict]] = defaultdict(list)
        for c in candidates:
            jne_pid = str(c.get("idOrganizacionPolitica", ""))
            dept    = (c.get("strDepartamento") or "").upper() if use_region else ""
            groups[(jne_pid, dept)].append(c)

        total = 0
        for (jne_pid, dept), members in groups.items():
            sample = members[0]
            nombre = (sample.get("strOrganizacionPolitica") or "").title()
            partido_uuid = upsert_party(sample)
            if not partido_uuid:
                continue
            partido_slug = slugify(nombre)
            dept_slug    = slugify(dept.lower()) if dept else "nacional"
            if tipo == TIPO_SENADO_UNICO:
                formula_slug = f"{partido_slug}-senado-unico-2026"
            else:
                formula_slug = f"{partido_slug}-senado-{dept_slug}-2026"

            formula_uuid = upsert_formula(partido_uuid, formula_slug)
            if not formula_uuid:
                continue

            region = dept.title() if dept else None
            for m in sorted(members, key=lambda x: x.get("intPosicion", 0)):
                cand_uuid, _ = upsert_candidate_basic(m, "senador",
                                                      partido_id=partido_uuid,
                                                      electoral_region=region,
                                                      orden=m.get("intPosicion"))
                if not cand_uuid:
                    continue
                if fetch_hv and cand_uuid not in _hv_done:
                    time.sleep(REQUEST_DELAY)
                    upsert_candidate_hv(client, m, cand_uuid)
                    _hv_done.add(cand_uuid)
                total += 1

        print(f"  {total} candidates upserted")
        time.sleep(REQUEST_DELAY)


def run_deputies(client: httpx.Client, fetch_hv: bool) -> None:
    """Process diputados (tipo=15) by region."""
    print("\n═══ DIPUTADOS (tipo=15) ═══")

    candidates = fetch_candidates(client, TIPO_DIPUTADOS)
    print(f"  {len(candidates)} candidates")

    # Group by (partido, departamento)
    groups: dict[tuple, list[dict]] = defaultdict(list)
    for c in candidates:
        jne_pid = str(c.get("idOrganizacionPolitica", ""))
        dept    = (c.get("strDepartamento") or "NACIONAL").upper()
        groups[(jne_pid, dept)].append(c)

    total = 0
    for (jne_pid, dept), members in groups.items():
        sample = members[0]
        nombre = (sample.get("strOrganizacionPolitica") or "").title()
        partido_uuid = upsert_party(sample)
        if not partido_uuid:
            continue
        partido_slug = slugify(nombre)
        dept_slug    = slugify(dept.lower())
        formula_slug = f"{partido_slug}-diputados-{dept_slug}-2026"

        formula_uuid = upsert_formula(partido_uuid, formula_slug)
        if not formula_uuid:
            continue

        region = deputy_region_from_raw(members[0])
        for m in sorted(members, key=lambda x: x.get("intPosicion", 0)):
            member_region = deputy_region_from_raw(m)
            cand_uuid, _ = upsert_candidate_basic(m, "congresista",
                                                  partido_id=partido_uuid,
                                                  electoral_region=member_region,
                                                  orden=m.get("intPosicion"))
            if not cand_uuid:
                continue
            upsert_formula_member(formula_uuid, cand_uuid, "congresista",
                                  m.get("intPosicion", 0), member_region)
            if fetch_hv and cand_uuid not in _hv_done:
                time.sleep(REQUEST_DELAY)
                upsert_candidate_hv(client, m, cand_uuid)
                _hv_done.add(cand_uuid)
            total += 1

    print(f"  {total} candidates upserted")


def run_andino(client: httpx.Client, fetch_hv: bool) -> None:
    """Process Parlamento Andino candidates (tipo=3)."""
    print("\n═══ PARLAMENTO ANDINO (tipo=3) ═══")

    candidates = fetch_candidates(client, TIPO_PARLAMENTO_ANDINO)
    print(f"  {len(candidates)} candidates")

    groups: dict[str, list[dict]] = defaultdict(list)
    for c in candidates:
        jne_pid = str(c.get("idOrganizacionPolitica", ""))
        groups[jne_pid].append(c)

    total = 0
    for jne_pid, members in groups.items():
        sample = members[0]
        nombre = (sample.get("strOrganizacionPolitica") or "").title()
        partido_uuid = upsert_party(sample)
        if not partido_uuid:
            continue
        partido_slug = slugify(nombre)
        formula_slug = f"{partido_slug}-andino-2026"

        formula_uuid = upsert_formula(partido_uuid, formula_slug)
        if not formula_uuid:
            continue

        for m in sorted(members, key=lambda x: x.get("intPosicion", 0)):
            cand_uuid, _ = upsert_candidate_basic(m, "congresista",
                                                  partido_id=partido_uuid,
                                                  orden=m.get("intPosicion"))
            if not cand_uuid:
                continue
            if fetch_hv and cand_uuid not in _hv_done:
                time.sleep(REQUEST_DELAY)
                upsert_candidate_hv(client, m, cand_uuid)
                _hv_done.add(cand_uuid)
            total += 1

    print(f"  {total} candidates upserted")


# Set to track which candidates already had HV fetched (avoid duplicates)
_hv_done: set[str] = set()


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    args = sys.argv[1:]
    fetch_hv = "--no-hv" not in args

    tipos_arg = next((a.split("=")[1] for a in args if a.startswith("--tipos=")), "all")
    tipos_requested = {t.strip() for t in tipos_arg.split(",")}
    run_all = "all" in tipos_requested

    def should_run(key: str) -> bool:
        return run_all or key in tipos_requested

    print("═" * 60)
    print("Elecciones Perú 2026 — JNE Scraper")
    print(f"Started : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Types   : {tipos_arg}")
    print(f"Fetch HV: {fetch_hv}")
    print("═" * 60)

    with httpx.Client() as client:
        party_formula_map: dict[str, str] = {}

        if should_run("presidencial"):
            pmap = run_presidential(client, fetch_hv)
            party_formula_map.update(pmap)

        if should_run("senate"):
            run_senate(client, fetch_hv)

        if should_run("deputies"):
            run_deputies(client, fetch_hv)

        if should_run("andino"):
            run_andino(client, fetch_hv)

        # Plans belong to parties (scraped after presidential so _party_cache is populated)
        if should_run("presidencial"):
            scrape_planes(client)

    print("\n" + "═" * 60)
    print(f"Finished: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("═" * 60)


if __name__ == "__main__":
    main()
