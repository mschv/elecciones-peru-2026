"use client";

import { Fragment } from "react";
import type {
  PartidoDetail,
  FormulaFull,
  CongresoMemberFull,
  EducationLevel,
  CargoType,
  PlanEje,
} from "@/lib/supabase/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CompareTableData =
  | { type: "partidos"; items: PartidoDetail[] }
  | { type: "formulas"; items: FormulaFull[] }
  | { type: "congresistas"; items: CongresoMemberFull[] }
  | { type: "plan_gobierno"; items: FormulaFull[] };

// ─── Constants ────────────────────────────────────────────────────────────────

const EDU_RANK: Record<EducationLevel, number> = {
  sin_estudios: 0, primaria: 1, secundaria: 2, tecnico: 3, universitario: 4, posgrado: 5,
};

const EDU_LABELS: Record<EducationLevel, string> = {
  sin_estudios: "Sin estudios", primaria: "Primaria", secundaria: "Secundaria", tecnico: "Técnico",
  universitario: "Universitario", posgrado: "Posgrado",
  
};

const CARGO_LABELS: Partial<Record<CargoType, string>> = {
  presidente: "Presidente",
  vicepresidente_1: "1.er vicepresidente",
  vicepresidente_2: "2.do vicepresidente",
};

const ACTIVE_STATUSES = ["en_curso", "en_apelacion", "sentencia_firme"];

const EJE_LABELS: Record<PlanEje, string> = {
  social: "Social", economico: "Económico", economia: "Económico",
  ambiental: "Ambiental", medio_ambiente: "Ambiental",
  institucional: "Institucional", salud: "Salud",
  educacion_eje: "Educación", seguridad: "Seguridad",
  infraestructura: "Infraestructura", otro: "Otro",
};

const EJE_ORDER: PlanEje[] = [
  "social", "economico", "economia", "ambiental", "medio_ambiente",
  "institucional", "salud", "educacion_eje", "seguridad", "infraestructura", "otro",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function highestEdu(education: { nivel: EducationLevel }[]) {
  if (!education.length) return null;
  return education.reduce((best, e) =>
    (EDU_RANK[e.nivel] ?? 0) > (EDU_RANK[best.nivel] ?? 0) ? e : best
  );
}

function publicYears(
  experience: { sector: string; year_inicio: number | null; year_fin: number | null }[]
): number {
  return experience
    .filter((e) => e.sector === "publico")
    .reduce(
      (acc, e) =>
        acc + Math.max(0, (e.year_fin ?? new Date().getFullYear()) - (e.year_inicio ?? 0)),
      0
    );
}

function fmtMoney(n: number | null | undefined): string {
  if (n == null) return "—";
  return `S/ ${(n / 1000).toFixed(0)}k`;
}

function pct(count: number, total: number): string {
  if (total === 0) return "—";
  return `${count} (${Math.round((count / total) * 100)}%)`;
}

function getInitials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

// ─── Shared table primitives ──────────────────────────────────────────────────

function SectionRow({ label, span }: { label: string; span: number }) {
  return (
    <tr className="bg-gray-50 border-t-2 border-gray-200">
      <td
        colSpan={span + 1}
        className="px-3 py-2 text-[11px] font-semibold text-gray-600 tracking-wider"
      >
        {label}
      </td>
    </tr>
  );
}

function DataRow({
  label,
  values,
}: {
  label: string;
  values: React.ReactNode[];
}) {
  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
      <td className="px-3 py-2.5 text-xs text-gray-500 font-medium w-36 align-top whitespace-nowrap">
        {label}
      </td>
      {values.map((v, i) => (
        <td key={i} className="px-3 py-2.5 text-xs text-gray-800 align-top">
          {v ?? "—"}
        </td>
      ))}
    </tr>
  );
}

// ─── Column header ─────────────────────────────────────────────────────────────

function ItemHeader({
  data,
  type,
}: {
  data: PartidoDetail | FormulaFull | CongresoMemberFull;
  type: CompareTableData["type"];
}) {
  if (type === "partidos") {
    const p = data as PartidoDetail;
    const color = p.color_hex ?? "#6b7280";
    return (
      <div className="flex flex-col items-center gap-1.5 text-center min-w-[100px]">
        {p.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.logo_url} alt="" className="w-10 h-10 object-contain rounded-lg" />
        ) : (
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-xs font-bold"
            style={{ backgroundColor: color }}
          >
            {getInitials(p.nombre_corto ?? p.nombre)}
          </div>
        )}
        <span className="text-xs font-semibold text-gray-900 leading-tight">
          {p.nombre_corto ?? p.nombre}
        </span>
      </div>
    );
  }

  if (type === "formulas" || type === "plan_gobierno") {
    const f = data as FormulaFull;
    const color = f.partido.color_hex ?? "#6b7280";
    return (
      <div className="flex flex-col items-center gap-1.5 text-center min-w-[100px]">
        {f.partido.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={f.partido.logo_url} alt="" className="w-10 h-10 object-contain rounded-lg" />
        ) : (
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-xs font-bold"
            style={{ backgroundColor: color }}
          >
            {getInitials(f.partido.nombre_corto ?? f.partido.nombre)}
          </div>
        )}
        <span className="text-xs font-semibold text-gray-900 leading-tight">
          {f.partido.nombre_corto ?? f.partido.nombre}
        </span>
        {f.numero_lista && (
          <span className="text-[10px] text-gray-400">Lista {f.numero_lista}</span>
        )}
      </div>
    );
  }

  // congresistas
  const m = data as CongresoMemberFull;
  const color = m.formula.partido.color_hex ?? "#6b7280";
  const name = `${m.candidate.nombres} ${m.candidate.apellidos}`;
  return (
    <div className="flex flex-col items-center gap-1.5 text-center min-w-[100px]">
      {m.candidate.foto_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={m.candidate.foto_url}
          alt=""
          className="w-10 h-10 rounded-lg object-cover"
        />
      ) : (
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-xs font-bold"
          style={{ backgroundColor: color }}
        >
          {getInitials(name)}
        </div>
      )}
      <span className="text-xs font-semibold text-gray-900 leading-tight">{name}</span>
      <span className="text-[10px] text-gray-400">
        {m.formula.partido.nombre_corto ?? m.formula.partido.nombre}
      </span>
    </div>
  );
}

// ─── Partidos table ───────────────────────────────────────────────────────────

function PartidosTable({ items }: { items: PartidoDetail[] }) {
  const n = items.length;

  const stats = items.map((p) => {
    const formula = p.formulas?.find((f) => f.activa) ?? p.formulas?.[0];
    const members = formula?.formula_members ?? [];
    const total = members.length;

    const conProcesos = members.filter((m) =>
      m.candidate.procesos_judiciales.some((pj) => ACTIVE_STATUSES.includes(pj.status))
    ).length;

    const allEdu = members.map((m) => highestEdu(m.candidate.education)?.nivel ?? null);
    const sinEstudios = allEdu.filter((e) => !e || ["primaria", "secundaria"].includes(e)).length;
    const tecnico = allEdu.filter((e) => e === "tecnico").length;
    const universitario = allEdu.filter((e) => e === "universitario").length;
    const posgrado = allEdu.filter(
      (e) => e && ["posgrado"].includes(e)
    ).length;

    const allProcesos = members.flatMap((m) => m.candidate.procesos_judiciales);
    const totalProcesos = allProcesos.length;
    const enCurso = allProcesos.filter((pj) => ACTIVE_STATUSES.includes(pj.status)).length;

    return {
      total,
      conProcesos,
      propuestas: p.plan_gobierno?.length ?? 0,
      sinEstudios,
      tecnico,
      universitario,
      posgrado,
      totalProcesos,
      enCurso,
      archivados: totalProcesos - enCurso,
    };
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse bg-white rounded-xl overflow-hidden border border-gray-200">
        <thead>
          <tr className="bg-white border-b border-gray-200">
            <th className="px-3 py-4 text-left w-36" />
            {items.map((p) => (
              <th key={p.id} className="px-3 py-4 text-center">
                <ItemHeader data={p} type="partidos" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <SectionRow label="Resumen" span={n} />
          <DataRow label="Total candidatos" values={stats.map((s) => String(s.total))} />
          <DataRow
            label="Con procesos activos"
            values={stats.map((s) =>
              s.conProcesos > 0 ? (
                <span className="text-red-600 font-medium">{pct(s.conProcesos, s.total)}</span>
              ) : (
                <span className="text-green-600">✓ Ninguno</span>
              )
            )}
          />
          <DataRow label="Compromisos de gobierno" values={stats.map((s) => String(s.propuestas))} />

          <SectionRow label="Nivel educativo (candidatos)" span={n} />
          <DataRow
            label="Sin estudios sup."
            values={stats.map((s) => pct(s.sinEstudios, s.total))}
          />
          <DataRow label="Técnico" values={stats.map((s) => pct(s.tecnico, s.total))} />
          <DataRow
            label="Universitario"
            values={stats.map((s) => pct(s.universitario, s.total))}
          />
          <DataRow label="Posgrado" values={stats.map((s) => pct(s.posgrado, s.total))} />

          <SectionRow label="Procesos judiciales (candidatos)" span={n} />
          <DataRow label="Total" values={stats.map((s) => String(s.totalProcesos))} />
          <DataRow
            label="En curso"
            values={stats.map((s) =>
              s.enCurso > 0 ? (
                <span className="text-red-600 font-medium">⚠ {s.enCurso}</span>
              ) : (
                <span className="text-green-600">✓ 0</span>
              )
            )}
          />
          <DataRow label="Archivados" values={stats.map((s) => String(s.archivados))} />
        </tbody>
      </table>
    </div>
  );
}

// ─── Formulas table ───────────────────────────────────────────────────────────

function FormulasTable({ items }: { items: FormulaFull[] }) {
  const n = items.length;
  const CARGO_ORDER: CargoType[] = [
    "presidente",
    "vicepresidente_1",
    "vicepresidente_2",
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse bg-white rounded-xl overflow-hidden border border-gray-200">
        <thead>
          <tr className="bg-white border-b border-gray-200">
            <th className="px-3 py-4 text-left w-36" />
            {items.map((f) => (
              <th key={f.id} className="px-3 py-4 text-center">
                <ItemHeader data={f} type="formulas" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {CARGO_ORDER.map((cargo) => {
            const members = items.map(
              (f) => f.formula_members.find((m) => m.cargo === cargo) ?? null
            );
            if (members.every((m) => m === null)) return null;

            return (
              <Fragment key={cargo}>
                <SectionRow label={CARGO_LABELS[cargo] ?? cargo} span={n} />
                <DataRow
                  label="Educación"
                  values={members.map((m) => {
                    if (!m) return "—";
                    const top = highestEdu(m.candidate.education);
                    return top ? EDU_LABELS[top.nivel] : "—";
                  })}
                />
                <DataRow
                  label="Institución"
                  values={members.map((m) => {
                    if (!m) return "—";
                    const top = highestEdu(m.candidate.education) as any;
                    return top?.institucion ?? "—";
                  })}
                />
                <DataRow
                  label="Exp. pública (años)"
                  values={members.map((m) =>
                    m ? String(publicYears(m.candidate.experience)) : "—"
                  )}
                />
                <DataRow
                  label="Cargo más reciente"
                  values={members.map((m) => {
                    if (!m) return "—";
                    const recent = [...m.candidate.experience]
                      .sort((a, b) => (b.year_inicio ?? 0) - (a.year_inicio ?? 0))[0];
                    return recent ? recent.cargo : "—";
                  })}
                />
                <DataRow
                  label="Procesos activos"
                  values={members.map((m) => {
                    if (!m) return "—";
                    const active = m.candidate.procesos_judiciales.filter((p) =>
                      ACTIVE_STATUSES.includes(p.status)
                    ).length;
                    return active > 0 ? (
                      <span className="text-red-600 font-medium">⚠ {active}</span>
                    ) : (
                      <span className="text-green-600">✓ 0</span>
                    );
                  })}
                />
                <DataRow
                  label="Procesos totales"
                  values={members.map((m) =>
                    m ? String(m.candidate.procesos_judiciales.length) : "—"
                  )}
                />
                <DataRow
                  label="Ingresos anuales"
                  values={members.map((m) => {
                    if (!m) return "—";
                    const latest = [...(m.candidate.patrimonio ?? [])].sort(
                      (a, b) => (b.year ?? 0) - (a.year ?? 0)
                    )[0];
                    return fmtMoney(latest?.ingresos_anuales);
                  })}
                />
                <DataRow
                  label="Bienes declarados"
                  values={members.map((m) => {
                    if (!m) return "—";
                    const latest = [...(m.candidate.patrimonio ?? [])].sort(
                      (a, b) => (b.year ?? 0) - (a.year ?? 0)
                    )[0];
                    return fmtMoney(latest?.bienes_declarados);
                  })}
                />
              </Fragment>
            );
          })}

          <SectionRow label="Partido" span={n} />
          <DataRow
            label="Total procesos fórmula"
            values={items.map((f) => {
              const total = f.formula_members.reduce(
                (acc, m) => acc + m.candidate.procesos_judiciales.length,
                0
              );
              return total > 0 ? (
                <span className="text-red-600">{total}</span>
              ) : (
                <span className="text-green-600">✓ 0</span>
              );
            })}
          />
          <DataRow
            label="Propuestas de gobierno"
            values={items.map((f) => String(f.partido.plan_gobierno?.length ?? 0))}
          />
        </tbody>
      </table>
    </div>
  );
}

// ─── Congresistas table ───────────────────────────────────────────────────────

function CongresistasTable({ items }: { items: CongresoMemberFull[] }) {
  const n = items.length;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse bg-white rounded-xl overflow-hidden border border-gray-200">
        <thead>
          <tr className="bg-white border-b border-gray-200">
            <th className="px-3 py-4 text-left w-36" />
            {items.map((m) => (
              <th key={m.candidate.id} className="px-3 py-4 text-center">
                <ItemHeader data={m} type="congresistas" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <SectionRow label="Formación académica" span={n} />
          <DataRow
            label="Nivel educativo"
            values={items.map((m) => {
              const top = highestEdu(m.candidate.education);
              return top ? EDU_LABELS[top.nivel] : "—";
            })}
          />
          <DataRow
            label="Institución"
            values={items.map((m) => {
              const top = highestEdu(m.candidate.education) as any;
              return top?.institucion ?? "—";
            })}
          />
          <DataRow
            label="Título/Especialidad"
            values={items.map((m) => {
              const top = highestEdu(m.candidate.education) as any;
              return top?.titulo ?? "—";
            })}
          />

          <SectionRow label="Experiencia" span={n} />
          <DataRow
            label="Años sector público"
            values={items.map((m) => String(publicYears(m.candidate.experience)))}
          />
          <DataRow
            label="Cargo más reciente"
            values={items.map((m) => {
              const latest = [...m.candidate.experience].sort(
                (a, b) => (b.year_inicio ?? 0) - (a.year_inicio ?? 0)
              )[0];
              return latest ? `${latest.cargo} — ${latest.organizacion}` : "—";
            })}
          />

          <SectionRow label="Procesos Judiciales" span={n} />
          <DataRow
            label="Total"
            values={items.map((m) => String(m.candidate.procesos_judiciales.length))}
          />
          <DataRow
            label="Activos"
            values={items.map((m) => {
              const active = m.candidate.procesos_judiciales.filter((p) =>
                ACTIVE_STATUSES.includes(p.status)
              ).length;
              return active > 0 ? (
                <span className="text-red-600 font-medium">⚠ {active}</span>
              ) : (
                <span className="text-green-600">✓ 0</span>
              );
            })}
          />
          <DataRow
            label="Archivados"
            values={items.map((m) => {
              const archived = m.candidate.procesos_judiciales.filter(
                (p) => !ACTIVE_STATUSES.includes(p.status)
              ).length;
              return String(archived);
            })}
          />

          <SectionRow label="Patrimonio" span={n} />
          <DataRow
            label="Ingresos anuales"
            values={items.map((m) => {
              const latest = [...(m.candidate.patrimonio ?? [])].sort(
                (a, b) => (b.year ?? 0) - (a.year ?? 0)
              )[0];
              return fmtMoney(latest?.ingresos_anuales);
            })}
          />
          <DataRow
            label="Bienes declarados"
            values={items.map((m) => {
              const latest = [...(m.candidate.patrimonio ?? [])].sort(
                (a, b) => (b.year ?? 0) - (a.year ?? 0)
              )[0];
              return fmtMoney(latest?.bienes_declarados);
            })}
          />
        </tbody>
      </table>
    </div>
  );
}

// ─── Plan de Gobierno table ────────────────────────────────────────────────────

function PlanGobiernoTable({ items }: { items: FormulaFull[] }) {
  const ejesPresentes = EJE_ORDER.filter((eje) =>
    items.some((f) => (f.partido.plan_gobierno ?? []).some((p) => p.eje === eje))
  );

  if (ejesPresentes.length === 0) {
    return (
      <div className="text-center text-gray-400 py-16 text-sm">
        Ninguna de las fórmulas seleccionadas tiene plan de gobierno registrado.
      </div>
    );
  }

  const colStyle: React.CSSProperties = {
    gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
  };

  return (
    <div className="space-y-6">
      {/* Column headers */}
      <div className="grid gap-4" style={colStyle}>
        {items.map((f) => (
          <div
            key={f.id}
            className="bg-white rounded-xl border border-gray-200 p-3 flex flex-col items-center text-center"
          >
            <ItemHeader data={f} type="plan_gobierno" />
          </div>
        ))}
      </div>

      {/* Eje sections */}
      {ejesPresentes.map((eje) => (
        <div key={eje}>
          <h3 className="text-sm font-semibold text-gray-700 tracking-wide mb-3 px-1">
            {EJE_LABELS[eje]}
          </h3>
          <div className="grid gap-4" style={colStyle}>
            {items.map((f) => {
              const proposals = (f.partido.plan_gobierno ?? [])
                .filter((p) => p.eje === eje)
                .sort((a, b) => a.orden - b.orden);
              return (
                <div
                  key={f.id}
                  className="bg-white rounded-xl border border-gray-200 p-4 space-y-2"
                >
                  {proposals.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">Sin compromisos en este eje</p>
                  ) : (
                    <ul className="space-y-2.5">
                      {proposals.map((p, i) => (
                        <li key={i} className="text-xs">
                          <p className="font-medium text-gray-800">{p.titulo}</p>
                          {p.descripcion && (
                            <p className="text-gray-500 mt-0.5 leading-relaxed">{p.descripcion}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function CompareTable({ data }: { data: CompareTableData }) {
  if (data.type === "partidos") return <PartidosTable items={data.items} />;
  if (data.type === "formulas") return <FormulasTable items={data.items} />;
  if (data.type === "congresistas") return <CongresistasTable items={data.items} />;
  if (data.type === "plan_gobierno") return <PlanGobiernoTable items={data.items} />;
  return null;
}
