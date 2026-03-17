import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import Countdown from "@/components/home/Countdown";
import StatsCharts from "@/components/home/StatsCharts";
import type {
  EduChartRow,
  ExpChartRow,
  ProcesoChartRow,
} from "@/components/home/StatsCharts";
import QuickCompare from "@/components/home/QuickCompare";
import type {
  SampleFormula,
  SamplePartido,
  SampleCongresista,
} from "@/components/home/QuickCompare";
import type { EducationLevel } from "@/lib/supabase/types";

export const metadata = {
  title: "Elecciones Perú 2026 — Información oficial sobre candidatos",
  description:
    "Conoce a los candidatos para las elecciones generales del Perú 2026. Compara propuestas, verifica antecedentes judiciales y consulta datos oficiales del JNE.",
};

// ─── Constants ────────────────────────────────────────────────────────────────

const EDU_RANK: Record<EducationLevel, number> = {
  sin_estudios: 0, primaria: 1, secundaria: 2, tecnico: 3, universitario: 4, posgrado: 5,
};

const CARGO_DISPLAY: Record<string, string> = {
  presidente: "Presidente",
  vicepresidente_primero: "1° VP",
  vicepresidente_segundo: "2° VP",
  senador: "Senador",
  congresista: "Congresista",
};

const CARGO_ORDER = [
  "presidente",
  "vicepresidente_primero",
  "vicepresidente_segundo",
  "senador",
  "congresista",
];

const EDU_LABELS: Record<EducationLevel, string> = {
  sin_estudios: "Sin estudios", primaria: "Primaria", secundaria: "Secundaria", tecnico: "Técnico",
  universitario: "Universitario", posgrado: "Posgrado",
  
};

const ACTIVE_STATUSES = ["en_curso", "acusacion", "juicio"];
const APPEAL_STATUSES = ["sentencia_condenatoria"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function eduGroup(education: { nivel: EducationLevel }[]): string {
  if (!education.length) return "sinEstudios";
  const top = education.reduce((best, e) =>
    (EDU_RANK[e.nivel] ?? 0) > (EDU_RANK[best.nivel] ?? 0) ? e : best
  );
  const n = top.nivel;
  if (n === "tecnico") return "tecnico";
  if (n === "universitario") return "universitario";
  if (["posgrado"].includes(n)) return "posgrado";
  return "sinEstudios";
}

function toPct(
  counts: Record<string, number>,
  total: number
): Record<string, number> {
  if (total === 0) return counts;
  const keys = Object.keys(counts);
  const scaled: Record<string, number> = {};
  let sum = 0;
  keys.forEach((k, i) => {
    if (i < keys.length - 1) {
      const v = Math.round((counts[k] / total) * 100);
      scaled[k] = v;
      sum += v;
    } else {
      scaled[k] = 100 - sum; // last bar takes remainder
    }
  });
  return scaled;
}

function highestEduLabel(education: { nivel: EducationLevel }[]): string {
  if (!education.length) return "—";
  const top = education.reduce((best, e) =>
    (EDU_RANK[e.nivel] ?? 0) > (EDU_RANK[best.nivel] ?? 0) ? e : best
  );
  return EDU_LABELS[top.nivel];
}

// ─── Data aggregation types ───────────────────────────────────────────────────

type RawMember = {
  cargo: string;
  candidate: {
    id: string;
    education: { nivel: EducationLevel }[];
    experience: { sector: string }[];
    procesos_judiciales: { status: string }[];
  };
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function HomePage() {
  const supabase = createClient();

  // ── 1. Parallel data fetching ───────────────────────────────────────────────
  const [
    { count: totalPartidos },
    { count: totalFormulas },
    { data: rawMembers },
    { data: rawFormulaSamples },
    { data: rawPartidoSamples },
    { data: rawCongresistasSamples },
  ] = await Promise.all([
    supabase.from("partidos").select("*", { count: "exact", head: true }),
    supabase.from("formulas").select("*", { count: "exact", head: true }).eq("activa", true),
    supabase.from("formula_members").select(`
      cargo,
      candidate:candidate_id (
        id,
        education ( nivel ),
        experience ( sector ),
        procesos_judiciales ( status )
      )
    `),
    supabase
      .from("formulas")
      .select(`
        id, slug, numero_lista,
        partido:partido_id ( nombre, nombre_corto, logo_url, color_hex, plan_gobierno ( eje ) ),
        formula_members (
          cargo,
          candidate:candidate_id (
            nombres, apellidos,
            education ( nivel ),
            procesos_judiciales ( status )
          )
        )
      `)
      .eq("activa", true)
      .order("id")
      .limit(2),
    supabase
      .from("partidos")
      .select(`
        id, slug, nombre, nombre_corto, logo_url, color_hex,
        formulas (
          activa,
          formula_members (
            candidate:candidate_id ( procesos_judiciales ( status ) )
          )
        ),
        plan_gobierno ( eje )
      `)
      .order("nombre")
      .limit(2),
    supabase
      .from("formula_members")
      .select(`
        cargo, region,
        candidate:candidate_id (
          id, slug, nombres, apellidos,
          education ( nivel ),
          procesos_judiciales ( status )
        ),
        formula:formula_id (
          partido:partido_id ( nombre, nombre_corto, color_hex )
        )
      `)
      .in("cargo", ["senador", "congresista"])
      .order("orden")
      .limit(2),
  ]);

  const members = (rawMembers ?? []) as unknown as RawMember[];

  // ── 2. Deduplicate for global stats ──────────────────────────────────────────
  const uniqueById = new Map<string, RawMember>();
  for (const m of members) {
    if (!uniqueById.has(m.candidate.id)) uniqueById.set(m.candidate.id, m);
  }
  const uniqueList = Array.from(uniqueById.values());
  const totalCandidatos = uniqueList.length;

  let withProceso = 0;
  let withPublic = 0;
  let withPrivate = 0;

  for (const m of uniqueList) {
    if (m.candidate.procesos_judiciales.length > 0) withProceso++;
    if (m.candidate.experience.some((e) => e.sector === "publico")) withPublic++;
    if (
      m.candidate.experience.some((e) =>
        ["privado", "academia", "ong", "otro"].includes(e.sector)
      )
    )
      withPrivate++;
  }

  const pctConProceso =
    totalCandidatos > 0 ? Math.round((withProceso / totalCandidatos) * 100) : 0;
  const pctExpPublica =
    totalCandidatos > 0 ? Math.round((withPublic / totalCandidatos) * 100) : 0;
  const pctExpPrivada =
    totalCandidatos > 0 ? Math.round((withPrivate / totalCandidatos) * 100) : 0;

  // ── 3. Per-cargo chart data ───────────────────────────────────────────────────
  const cargoGroups: Record<string, RawMember[]> = {};
  for (const m of members) {
    if (!cargoGroups[m.cargo]) cargoGroups[m.cargo] = [];
    cargoGroups[m.cargo].push(m);
  }

  const eduChart: EduChartRow[] = CARGO_ORDER.filter(
    (c) => (cargoGroups[c]?.length ?? 0) > 0
  ).map((cargo) => {
    const group = cargoGroups[cargo] ?? [];
    const counts = {
      sinEstudios: 0,
      tecnico: 0,
      universitario: 0,
      posgrado: 0,
    };
    for (const m of group) {
      const g = eduGroup(m.candidate.education);
      (counts as Record<string, number>)[g]++;
    }
    const pct = toPct(counts, group.length);
    return { cargo: CARGO_DISPLAY[cargo] ?? cargo, ...pct } as EduChartRow;
  });

  const expChart: ExpChartRow[] = CARGO_ORDER.filter(
    (c) => (cargoGroups[c]?.length ?? 0) > 0
  ).map((cargo) => {
    const group = cargoGroups[cargo] ?? [];
    let publico = 0;
    let privado = 0;
    for (const m of group) {
      const hasPublic = m.candidate.experience.some((e) => e.sector === "publico");
      const hasPrivate = m.candidate.experience.some((e) =>
        ["privado", "academia", "ong", "otro"].includes(e.sector)
      );
      if (hasPublic) publico++;
      else if (hasPrivate) privado++;
      else privado++; // no experience → treat as "other/private"
    }
    const pct = toPct({ publico, privado }, group.length);
    return { cargo: CARGO_DISPLAY[cargo] ?? cargo, ...pct } as ExpChartRow;
  });

  const procesosChart: ProcesoChartRow[] = CARGO_ORDER.filter(
    (c) => (cargoGroups[c]?.length ?? 0) > 0
  ).map((cargo) => {
    const group = cargoGroups[cargo] ?? [];
    let enCurso = 0;
    let enApelacion = 0;
    let archivado = 0;
    let sinProcesos = 0;
    for (const m of group) {
      const ps = m.candidate.procesos_judiciales;
      if (ps.length === 0) {
        sinProcesos++;
      } else if (ps.some((p) => ACTIVE_STATUSES.includes(p.status))) {
        enCurso++;
      } else if (ps.some((p) => APPEAL_STATUSES.includes(p.status))) {
        enApelacion++;
      } else {
        archivado++;
      }
    }
    const pct = toPct({ enCurso, enApelacion, archivado, sinProcesos }, group.length);
    return {
      cargo: CARGO_DISPLAY[cargo] ?? cargo,
      ...pct,
    } as ProcesoChartRow;
  });

  // ── 4. Sample data for quick compare ─────────────────────────────────────────
  const sampleFormulas: SampleFormula[] = ((rawFormulaSamples ?? []) as any[]).map((f) => {
    const partido = f.partido ?? {};
    const pres = (f.formula_members ?? []).find((m: any) => m.cargo === "presidente");
    const presName = pres
      ? `${pres.candidate.nombres} ${pres.candidate.apellidos}`
      : "—";
    const presEdu = pres ? highestEduLabel(pres.candidate.education) : "—";
    const activeProcesos = (f.formula_members ?? []).reduce(
      (acc: number, m: any) =>
        acc +
        m.candidate.procesos_judiciales.filter((p: any) =>
          ACTIVE_STATUSES.includes(p.status)
        ).length,
      0
    );
    return {
      id: f.id,
      slug: f.slug,
      partidoNombre: partido.nombre ?? "—",
      partidoColor: partido.color_hex ?? "#6b7280",
      partidoLogo: partido.logo_url ?? null,
      presidenteNombre: presName,
      presidenteEdu: presEdu,
      activeProcesos,
      propuestasCount: (f.partido?.plan_gobierno ?? []).length,
    };
  });

  const samplePartidos: SamplePartido[] = ((rawPartidoSamples ?? []) as any[]).map((p) => {
    const formula = (p.formulas ?? []).find((f: any) => f.activa) ?? (p.formulas ?? [])[0];
    const members = formula?.formula_members ?? [];
    const totalCandidatosP = members.length;
    const conSentencia = members.filter((m: any) =>
      m.candidate.procesos_judiciales.some((pj: any) =>
        [...ACTIVE_STATUSES, ...APPEAL_STATUSES].includes(pj.status)
      )
    ).length;
    return {
      id: p.id,
      slug: p.slug,
      nombre: p.nombre,
      nombreCorto: p.nombre_corto,
      color: p.color_hex ?? "#6b7280",
      logo: p.logo_url ?? null,
      totalCandidatos: totalCandidatosP,
      conSentencia,
      propuestasCount: (p.plan_gobierno ?? []).length,
    };
  });

  const sampleCongresistas: SampleCongresista[] = (
    (rawCongresistasSamples ?? []) as any[]
  ).map((m) => ({
    id: m.candidate.id,
    slug: m.candidate.slug,
    nombre: `${m.candidate.nombres} ${m.candidate.apellidos}`,
    partidoNombre:
      m.formula?.partido?.nombre_corto ?? m.formula?.partido?.nombre ?? "—",
    partidoColor: m.formula?.partido?.color_hex ?? "#6b7280",
    region: m.region ?? null,
    cargo: m.cargo,
    educacion: highestEduLabel(m.candidate.education),
    procesos: m.candidate.procesos_judiciales.length,
  }));

  // ── 5. Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="bg-gray-50 min-h-screen">
      {/* ══ HERO ══════════════════════════════════════════════════════════════ */}
      <div className="max-w-6xl mx-auto px-4 pt-6 pb-4">
        <div
          className="rounded-2xl p-6 md:p-8"
          style={{ backgroundColor: "#111111" }}
        >
          <div className="flex flex-col md:flex-row md:items-start gap-6">
            {/* Left: Title + subtitle + countdown */}
            <div className="flex-1 space-y-4">
              <div>
                <h1 className="text-3xl md:text-4xl font-extrabold text-white leading-tight">
                  Elecciones{" "}
                  <span style={{ color: "#e53935" }}>Perú</span>{" "}
                  2026
                </h1>
                <p className="text-gray-400 mt-2 text-sm md:text-base max-w-lg">
                  Conoce a tus candidatos. Compara. Decide.{" "}
                  <span className="text-gray-500">Data oficial del JNE.</span>
                </p>
              </div>

              <Countdown />

              {/* Freshness badge */}
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                <span>
                  Datos actualizados · JNE · Infogob · ONPE
                </span>
              </div>
            </div>

            {/* Right: Stat pills */}
            <div className="grid grid-cols-2 gap-3 md:w-72 shrink-0">
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-white">
                  {totalPartidos ?? "—"}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">Partidos</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-white">
                  {totalFormulas ?? "—"}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">Fórmulas</p>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-amber-400">
                  {totalCandidatos.toLocaleString("es-PE")}
                </p>
                <p className="text-xs text-amber-300/70 mt-0.5">Candidatos</p>
              </div>
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-red-400">
                  {pctConProceso}%
                </p>
                <p className="text-xs text-red-300/70 mt-0.5">Con procesos</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══ STATS SECTION ═════════════════════════════════════════════════════ */}
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-3">
        <div className="flex items-baseline justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Estadísticas de los candidatos
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {pctExpPublica}% con experiencia pública ·{" "}
              {pctExpPrivada}% con experiencia privada ·{" "}
              {pctConProceso}% con procesos judiciales
            </p>
          </div>
        </div>

        <StatsCharts
          edu={eduChart}
          exp={expChart}
          procesos={procesosChart}
        />
      </div>

      {/* ══ QUICK COMPARE SECTION ═════════════════════════════════════════════ */}
      <div className="max-w-6xl mx-auto px-4 py-4 space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-bold text-gray-900">
            Comparación rápida
          </h2>
          <Link
            href="/comparar"
            className="text-sm text-[#e53935] hover:underline font-medium"
          >
            Ver comparación completa →
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <QuickCompare
            formulas={sampleFormulas}
            partidos={samplePartidos}
            congresistas={sampleCongresistas}
          />
        </div>
      </div>

      {/* ══ EXPLORE SECTION ═══════════════════════════════════════════════════ */}
      <div className="max-w-6xl mx-auto px-4 py-4">
        <h2 className="text-lg font-bold text-gray-900 mb-3">
          Explorar por sección
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              title: "Partidos",
              desc: "Consulta la ideología, composición y plan de gobierno de cada partido político participante.",
              href: "/partidos",
              cta: "Ver partidos →",
            },
            {
              title: "Fórmula presidencial",
              desc: "Conoce a los candidatos presidenciales, sus vicepresidentes y su propuesta de gobierno.",
              href: "/formula",
              cta: "Ver fórmulas →",
            },
            {
              title: "Congreso",
              desc: "Explora los candidatos al Senado y la Cámara de Diputados por partido y región.",
              href: "/congreso",
              cta: "Ver congreso →",
            },
          ].map(({ title, desc, href, cta }) => (
            <Link
              key={href}
              href={href}
              className="group bg-white rounded-xl border border-gray-200 p-5 hover:border-[#e53935] hover:shadow-sm transition-all"
            >
              <h3 className="font-semibold text-gray-900 group-hover:text-[#e53935] transition-colors">
                {title}
              </h3>
              <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{desc}</p>
              <p className="text-xs text-[#e53935] font-medium mt-3">{cta}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* ══ FOOTER ════════════════════════════════════════════════════════════ */}
      <footer className="max-w-6xl mx-auto px-4 py-8 mt-4 border-t border-gray-200">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="text-xs text-gray-400 space-y-1">
            <p>
              Data obtenida del{" "}
              <a
                href="https://www.jne.gob.pe"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline text-gray-500"
              >
                JNE
              </a>{" "}
              ·{" "}
              <a
                href="https://infogob.jne.gob.pe"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline text-gray-500"
              >
                Infogob
              </a>{" "}
              ·{" "}
              <a
                href="https://www.onpe.gob.pe"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline text-gray-500"
              >
                ONPE
              </a>
            </p>
            <p>
              Última actualización global:{" "}
              <span className="text-gray-500">
                {new Date().toLocaleDateString("es-PE", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <Link href="/metodologia" className="text-gray-400 hover:text-gray-600 hover:underline">
              Metodología
            </Link>
            <a
              href="mailto:errores@eleccionesperu2026.pe?subject=Reporte de error"
              className="text-gray-400 hover:text-gray-600 hover:underline"
            >
              Reportar un error
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
