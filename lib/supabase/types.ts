export type CargoType =
  | 'presidente'
  | 'vicepresidente_1'
  | 'vicepresidente_2'
  | 'senador'
  | 'congresista'

export type EducationLevel =
  | 'sin_estudios'
  | 'primaria'
  | 'secundaria'
  | 'tecnico'
  | 'universitario'
  | 'posgrado'

export type EducationStatus = 'completo' | 'incompleto' | 'en_curso'

export type ExperienceSector =
  | 'publico'
  | 'privado'
  | 'academia'
  | 'ong'
  | 'otro'

export type ProcesoStatus =
  | 'en_curso'
  | 'en_apelacion'
  | 'archivado'
  | 'anulado'
  | 'sentencia_firme'          // legacy — keep for backwards compat
  | 'sentencia_condenatoria'
  | 'sentencia_absolutoria'
  | 'sentencia_civil'          // lSentenciaObliga: alimentos, violencia familiar, etc.
  | 'pena_cumplida'
  | 'prescrito'

export type PlanEje =
  | 'social'
  | 'economico'
  | 'ambiental'
  | 'institucional'
  | 'economia'
  | 'medio_ambiente'
  | 'salud'
  | 'educacion_eje'
  | 'seguridad'
  | 'infraestructura'
  | 'otro'

export type IdeologyType =
  | 'izquierda'
  | 'centro_izquierda'
  | 'centro'
  | 'centro_derecha'
  | 'derecha'
  | 'populista'
  | 'otro'
  | 'sin_definir'

export interface Partido {
  id: string
  slug: string
  nombre: string
  nombre_corto: string | null
  logo_url: string | null
  color_hex: string | null
  color_secundario: string | null
  ideologia: IdeologyType | null
  fundacion_year: number | null
  descripcion: string | null
  jne_url: string | null
  jne_partido_id: string | null
  created_at: string
  updated_at: string
}

export interface Formula {
  id: string
  slug: string
  partido_id: string
  numero_lista: number | null
  activa: boolean
  created_at: string
  updated_at: string
  partido?: Partido
  members?: FormulaMember[]
}

export interface FormulaMember {
  id: string
  formula_id: string
  candidate_id: string
  cargo: CargoType
  orden: number
  region: string | null
  is_incumbent: boolean
  is_first_time: boolean
  created_at: string
  formula?: Formula
  candidate?: Candidate
}

// ─── Congreso — summary shape (for list) ─────────────────────────────────────
export interface CongresoPartidoRef {
  id: string
  slug: string
  nombre: string
  nombre_corto: string | null
  logo_url: string | null
  color_hex: string | null
}

export interface CongresoCandidateSlim {
  id: string
  slug: string
  nombres: string
  apellidos: string
  foto_url: string | null
  education: { nivel: EducationLevel }[]
  procesos_judiciales: { status: ProcesoStatus }[]
}

export interface CongresoMember {
  cargo: CargoType
  orden: number
  region: string | null
  is_incumbent: boolean
  is_first_time: boolean
  candidate: CongresoCandidateSlim
  formula: {
    numero_lista: number | null
    partido: CongresoPartidoRef
  }
}

// ─── Congreso — full profile shape ───────────────────────────────────────────
export interface CongresoMemberFull {
  cargo: CargoType
  orden: number
  region: string | null
  is_incumbent: boolean
  is_first_time: boolean
  candidate: CandidateFull
  formula: {
    numero_lista: number | null
    partido: CongresoPartidoRef
  }
}

export interface Candidate {
  id: string
  slug: string
  nombres: string
  apellidos: string
  foto_url: string | null
  fecha_nacimiento: string | null
  lugar_nacimiento: string | null
  dni: string | null
  bio: string | null
  created_at: string
  updated_at: string
  education?: Education[]
  experience?: Experience[]
  procesos_judiciales?: ProcesoJudicial[]
}

export interface Education {
  id: string
  candidate_id: string
  institucion: string
  titulo: string | null
  nivel: EducationLevel
  estado: EducationStatus
  year_inicio: number | null
  year_fin: number | null
  created_at: string
}

export interface Experience {
  id: string
  candidate_id: string
  cargo: string
  organizacion: string
  sector: ExperienceSector
  year_inicio: number | null
  year_fin: number | null
  descripcion: string | null
  created_at: string
}

export interface ProcesoJudicial {
  id: string
  candidate_id: string
  caso: string
  delito: string | null
  entidad: string | null
  status: ProcesoStatus
  year_inicio: number | null
  year_resolucion: number | null
  descripcion: string | null
  fuente_url: string | null
  fallo: string | null
  modalidad: string | null
  cumple_fallo: string | null
  fecha_sentencia: string | null
  organo_judicial: string | null
  created_at: string
}

export interface PlanGobierno {
  id: string
  formula_id: string
  eje: PlanEje
  titulo: string
  descripcion: string | null
  problema: string | null
  objetivo: string | null
  indicador: string | null
  meta: string | null
  orden: number
  created_at: string
  docs?: PlanGobiernoDoc[]
}

export interface PlanGobiernoDoc {
  id: string
  plan_gobierno_id: string
  nombre: string
  url: string
  created_at: string
}

// ─── View: partido_summary ───────────────────────────────────────────────────
// Returned by the partido_summary Supabase view.
export interface PartidoSummary {
  id: string
  slug: string
  nombre: string
  nombre_corto: string | null
  logo_url: string | null
  color_hex: string | null
  ideologia: IdeologyType | null
  fundacion_year: number | null
  last_scraped_at: string | null
  total_candidatos: number
  candidatos_con_procesos: number
  total_procesos: number
  procesos_en_curso: number
  procesos_en_apelacion: number
  total_propuestas: number
  has_plan_gobierno: boolean
  has_formula: boolean
}

// ─── Full detail shape (from joined Supabase query) ──────────────────────────
export interface CandidateSlim {
  id: string
  nombres: string
  apellidos: string
  foto_url: string | null
  education: { nivel: EducationLevel }[]
  procesos_judiciales: { status: ProcesoStatus }[]
}

export interface FormulaMemberSlim {
  cargo: CargoType
  orden: number
  candidate: CandidateSlim
}

export interface PlanGobiernoSlim {
  eje: PlanEje
  titulo: string
  descripcion: string | null
  problema: string | null
  problema_grupo: string | null
  objetivo: string | null
  indicador: string | null
  meta: string | null
  orden: number
}

export interface PlanGobiernoDocSlim {
  tipo: string
  url: string
  nombre: string | null
}

export interface PartidoDetail {
  id: string
  slug: string
  nombre: string
  nombre_corto: string | null
  logo_url: string | null
  color_hex: string | null
  ideologia: IdeologyType | null
  fundacion_year: number | null
  descripcion: string | null
  jne_url: string | null
  formulas: {
    id: string
    activa: boolean
    formula_members: FormulaMemberSlim[]
  }[]
  plan_gobierno: PlanGobiernoSlim[]
  plan_gobierno_docs: PlanGobiernoDocSlim[]
}

// ─── Anotaciones JNE ─────────────────────────────────────────────────────────
export interface AnotacionJne {
  id: string
  candidate_id: string
  tipo_anotacion: string | null
  seccion_hv: string | null
  nro_anotacion: string | null
  nro_expediente: string | null
  nro_documento: string | null
  dice: string | null
  debe_decir: string | null
  fecha: string | null
  created_at: string
}

// ─── Patrimonio (declaración jurada) ─────────────────────────────────────────
export interface Patrimonio {
  id: string
  candidate_id: string
  ingresos_anuales: number | null
  bienes_declarados: number | null
  dj_url: string | null
  year: number | null
  created_at: string
}

// ─── Formula — summary shape (for list rendering) ────────────────────────────
export interface CandidateSummary {
  id: string
  nombres: string
  apellidos: string
  foto_url: string | null
  education: { nivel: EducationLevel; institucion: string }[]
  experience: { sector: ExperienceSector; year_inicio: number | null; year_fin: number | null }[]
  procesos_judiciales: { status: ProcesoStatus }[]
}

export interface FormulaMemberSummary {
  cargo: CargoType
  orden: number
  candidate: CandidateSummary
}

export interface FormulaSummary {
  id: string
  slug: string
  activa: boolean
  numero_lista: number | null
  partido: {
    id: string
    nombre: string
    nombre_corto: string | null
    logo_url: string | null
    color_hex: string | null
    plan_gobierno: { eje: PlanEje }[]
  }
  formula_members: FormulaMemberSummary[]
}

export interface CargoEleccion {
  id: string
  candidate_id: string
  tipo: 'eleccion' | 'partidario'
  cargo: string
  entidad: string | null
  distrito: string | null
  year_inicio: number | null
  year_fin: number | null
  partido: string | null
  created_at: string
}

// ─── Formula — full detail shape ─────────────────────────────────────────────
export interface CandidateFull {
  id: string
  slug: string
  nombres: string
  apellidos: string
  foto_url: string | null
  fecha_nacimiento: string | null
  lugar_nacimiento: string | null
  dni: string | null
  bio: string | null
  education: Education[]
  experience: Experience[]
  procesos_judiciales: ProcesoJudicial[]
  patrimonio: Patrimonio[]
  anotaciones_jne: AnotacionJne[]
  cargo_eleccion: CargoEleccion[]
}

export interface FormulaMemberFull {
  cargo: CargoType
  orden: number
  candidate: CandidateFull
}

export interface FormulaFull {
  id: string
  slug: string
  activa: boolean
  numero_lista: number | null
  partido: {
    id: string
    nombre: string
    nombre_corto: string | null
    logo_url: string | null
    color_hex: string | null
    fundacion_year: number | null
    ideologia: IdeologyType | null
    plan_gobierno: PlanGobiernoSlim[]
  }
  formula_members: FormulaMemberFull[]
}

export type Database = {
  public: {
    Tables: {
      partidos: {
        Row: Partido
        Insert: Omit<Partido, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Partido, 'id' | 'created_at' | 'updated_at'>>
      }
      candidates: {
        Row: Candidate
        Insert: Omit<Candidate, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Candidate, 'id' | 'created_at' | 'updated_at'>>
      }
      formulas: {
        Row: Formula
        Insert: Omit<Formula, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Formula, 'id' | 'created_at' | 'updated_at'>>
      }
      formula_members: {
        Row: FormulaMember
        Insert: Omit<FormulaMember, 'id' | 'created_at'>
        Update: Partial<Omit<FormulaMember, 'id' | 'created_at'>>
      }
      education: {
        Row: Education
        Insert: Omit<Education, 'id' | 'created_at'>
        Update: Partial<Omit<Education, 'id' | 'created_at'>>
      }
      experience: {
        Row: Experience
        Insert: Omit<Experience, 'id' | 'created_at'>
        Update: Partial<Omit<Experience, 'id' | 'created_at'>>
      }
      procesos_judiciales: {
        Row: ProcesoJudicial
        Insert: Omit<ProcesoJudicial, 'id' | 'created_at'>
        Update: Partial<Omit<ProcesoJudicial, 'id' | 'created_at'>>
      }
      plan_gobierno: {
        Row: PlanGobierno
        Insert: Omit<PlanGobierno, 'id' | 'created_at'>
        Update: Partial<Omit<PlanGobierno, 'id' | 'created_at'>>
      }
      plan_gobierno_docs: {
        Row: PlanGobiernoDoc
        Insert: Omit<PlanGobiernoDoc, 'id' | 'created_at'>
        Update: Partial<Omit<PlanGobiernoDoc, 'id' | 'created_at'>>
      }
    }
    Enums: {
      cargo_type: CargoType
      education_level: EducationLevel
      education_status: EducationStatus
      experience_sector: ExperienceSector
      proceso_status: ProcesoStatus
      plan_eje: PlanEje
      ideology_type: IdeologyType
    }
  }
}
