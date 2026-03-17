import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import StatsCharts from "@/components/home/StatsCharts";
import type {
  EduChartRow,
  ExpChartRow,
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
  vicepresidente_1: "1° Vicepres.",
  vicepresidente_2: "2° Vicepres.",
  senador: "Senador",
  congresista: "Diputado",
};

const CARGO_ORDER = [
  "presidente",
  "vicepresidente_1",
  "vicepresidente_2",
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
  return top.nivel === "sin_estudios" ? "sinEstudios" : top.nivel;
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
    { count: _totalPartidos },
    { count: totalFormulas },
    { count: totalCandidatosCount },
    { data: rawMembers },
    { data: rawFormulaSamples },
    { data: rawPartidoSamples },
    { data: rawCongresistasSamples },
  ] = await Promise.all([
    supabase.from("partidos").select("*", { count: "exact", head: true }),
    supabase.from("formula_members").select("*", { count: "exact", head: true }).eq("cargo", "presidente"),
    supabase.from("candidates").select("*", { count: "exact", head: true }),
    supabase.from("formula_members").select(`
      cargo,
      candidate:candidate_id (
        id,
        education ( nivel ),
        experience ( sector ),
        procesos_judiciales ( status )
      )
    `).limit(10000),
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


  // ── 3. Per-cargo chart data ───────────────────────────────────────────────────
  const cargoGroups: Record<string, RawMember[]> = {};
  for (const m of members) {
    if (!cargoGroups[m.cargo]) cargoGroups[m.cargo] = [];
    cargoGroups[m.cargo].push(m);
  }

  const activeCargos = CARGO_ORDER.filter((c) => (cargoGroups[c]?.length ?? 0) > 0);

  const eduChart: EduChartRow[] = activeCargos.map((cargo) => {
    const group = cargoGroups[cargo] ?? [];
    const counts = { sinEstudios: 0, primaria: 0, secundaria: 0, tecnico: 0, universitario: 0, posgrado: 0 };
    for (const m of group) {
      const key = eduGroup(m.candidate.education);
      (counts as Record<string, number>)[key]++;
    }
    return { cargo: CARGO_DISPLAY[cargo] ?? cargo, ...toPct(counts, group.length), _total: group.length } as EduChartRow;
  });

  const expChart: ExpChartRow[] = activeCargos.map((cargo) => {
    const group = cargoGroups[cargo] ?? [];
    let soloPublico = 0, soloPrivado = 0, mixto = 0, sinExp = 0;
    for (const m of group) {
      const hasPublic = m.candidate.experience.some((e) => e.sector === "publico");
      const hasPrivate = m.candidate.experience.some((e) =>
        ["privado", "academia", "ong", "otro"].includes(e.sector)
      );
      if (hasPublic && hasPrivate) mixto++;
      else if (hasPublic) soloPublico++;
      else if (hasPrivate) soloPrivado++;
      else sinExp++;
    }
    return { cargo: CARGO_DISPLAY[cargo] ?? cargo, ...toPct({ soloPublico, soloPrivado, mixto, sinExp }, group.length), _total: group.length } as ExpChartRow;
  });

  function makeSimpleChart(predicate: (ps: { status: string }[]) => boolean): { cargo: string; con: number; sin: number; _total: number }[] {
    return activeCargos.map((cargo) => {
      const group = cargoGroups[cargo] ?? [];
      const con = group.filter((m) => predicate(m.candidate.procesos_judiciales)).length;
      const sin = group.length - con;
      const pct = toPct({ con, sin }, group.length);
      return { cargo: CARGO_DISPLAY[cargo] ?? cargo, con: pct.con, sin: pct.sin, _total: group.length };
    });
  }

  const activosChart = makeSimpleChart((ps) =>
    ps.some((p) => ["en_curso", "en_apelacion"].includes(p.status))
  );
  const civilesChart = makeSimpleChart((ps) =>
    ps.some((p) => p.status === "sentencia_civil")
  );
  const condenaChart = makeSimpleChart((ps) =>
    ps.some((p) => ["sentencia_condenatoria", "sentencia_firme", "pena_cumplida"].includes(p.status))
  );

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
    <div className="min-h-screen" style={{ backgroundColor: "#faf9f7" }}>
      {/* ══ HERO ══════════════════════════════════════════════════════════════ */}
      <div className="bg-white px-4 pt-10 pb-12 border-b border-gray-100">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center gap-10">

          {/* Left: text + buttons */}
          <div className="flex-1">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 text-xs text-gray-500 border border-gray-300 rounded-full px-3 py-1 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 shrink-0" />
              Iniciativa ciudadana · independiente y no partidaria
            </div>

            {/* Heading */}
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight">
              Conoce a tus candidatos.<br />
              <span style={{ color: "#c0392b" }}>Compara. Decide.</span>
            </h1>

            <p className="text-gray-600 mt-4 text-base leading-relaxed max-w-lg">
              Información oficial de todos los partidos, fórmulas presidenciales y candidatos al
              congreso para las Elecciones Perú 2026.
            </p>
            <p className="text-gray-400 mt-2 text-sm leading-relaxed max-w-lg">
              Este sitio no está afiliado al JNE, ningún partido político ni entidad gubernamental.
              Los datos provienen de fuentes oficiales públicas: JNE, Infogob y ONPE.
            </p>

            {/* CTA buttons */}
            <div className="flex flex-wrap gap-3 mt-6">
              <Link
                href="/partidos"
                className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white"
                style={{ backgroundColor: "#c0392b" }}
              >
                Ver partidos
              </Link>
              <Link
                href="/congreso"
                className="px-5 py-2.5 rounded-lg text-sm font-semibold text-gray-700 border border-gray-300 hover:border-gray-400 transition-colors"
              >
                Ver congreso
              </Link>
            </div>
          </div>

          {/* Right: stat cards */}
          <div className="flex flex-col gap-3 md:w-80 shrink-0">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl p-4 bg-gray-900">
                <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">Partidos</p>
                <p className="text-3xl font-bold text-white">{totalFormulas ?? "—"}</p>
                <p className="text-xs text-gray-500 mt-1">con fórmula presidencial</p>
              </div>
              <div className="rounded-xl p-4 bg-gray-900">
                <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">Candidatos</p>
                <p className="text-3xl font-bold text-white">{(totalCandidatosCount ?? 0).toLocaleString("es-PE")}</p>
                <p className="text-xs text-gray-500 mt-1">candidatos registrados</p>
              </div>
            </div>
            <div className="rounded-xl p-4 border" style={{ backgroundColor: "#fff5f5", borderColor: "#fecaca" }}>
              <p className="text-xs uppercase tracking-widest font-semibold mb-1" style={{ color: "#c0392b" }}>
                Candidatos con condena firme
              </p>
              <p className="text-3xl font-bold" style={{ color: "#c0392b" }}>{pctConProceso}%</p>
              <p className="text-xs text-red-400 mt-1">de todos los candidatos</p>
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
          </div>
        </div>

        <StatsCharts
          edu={eduChart}
          exp={expChart}
          activos={activosChart}
          civiles={civilesChart}
          condena={condenaChart}
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

      {/* ══ METHODOLOGY ═══════════════════════════════════════════════════════ */}
      <div className="max-w-6xl mx-auto px-4 py-10 mt-4 border-t border-gray-200">
        <h2 className="text-base font-bold text-gray-900 mb-3">Metodología</h2>
        <p className="text-[13px] text-gray-500 leading-[1.7] max-w-3xl">
          Elecciones Perú 2026 es una plataforma ciudadana independiente que centraliza información
          oficial sobre candidatos y partidos para las elecciones generales del 12 de abril de 2026.
          No tiene fines de lucro ni afiliación política o gubernamental.
        </p>

        <div className="border-t border-gray-200 mt-6 pt-6 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
          {/* Left column */}
          <div className="space-y-6">
            <div>
              <h3 className="text-[12px] font-medium text-gray-400 mb-2">Fuentes de datos</h3>
              <p className="text-[13px] text-gray-500 leading-[1.7]">
                Los datos de candidatos, fórmulas presidenciales, listas al congreso y planes de
                gobierno provienen del JNE (Jurado Nacional de Elecciones) y su plataforma Infogob,
                a través de sus APIs públicas oficiales.
              </p>
            </div>
            <div>
              <h3 className="text-[12px] font-medium text-gray-400 mb-2">Cómo se obtienen los datos</h3>
              <p className="text-[13px] text-gray-500 leading-[1.7]">
                La información se actualiza mediante un proceso automatizado que consulta las APIs
                oficiales del JNE para cada candidato, extrayendo su formación académica, experiencia
                laboral, procesos judiciales y patrimonio declarado.
              </p>
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-6">
            <div>
              <h3 className="text-[12px] font-medium text-gray-400 mb-2">Cómo se clasifican los datos</h3>
              <p className="text-[13px] text-gray-500 leading-[1.7]">
                El nivel educativo refleja el máximo nivel declarado por cada candidato. La experiencia
                laboral se clasifica como pública, privada o mixta. Los procesos judiciales se agrupan
                en tres categorías: procesos activos, sentencias civiles y condenas firmes, según el
                estado reportado por el JNE.
              </p>
            </div>
            <div>
              <h3 className="text-[12px] font-medium text-gray-400 mb-2">Sobre el proyecto</h3>
              <p className="text-[13px] text-gray-500 leading-[1.7]">
                Este sitio es una iniciativa ciudadana sin fines de lucro. Fue construido con Next.js
                y el código fuente está disponible bajo licencia abierta. Desarrollado con asistencia
                de{" "}
                <a
                  href="https://claude.ai/code"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                  style={{ color: "#e02020" }}
                >
                  Claude Code
                </a>{" "}
                (Anthropic).
              </p>
            </div>
          </div>
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
