"use client";

import type { CandidateFull, CargoType, EducationLevel, EducationStatus } from "@/lib/supabase/types";
import Accordion from "@/components/shared/Accordion";
import StatusBadge from "@/components/shared/StatusBadge";

// ─── Constants ───────────────────────────────────────────────────────────────

const CARGO_LABELS: Record<string, string> = {
  presidente: "Presidente",
  vicepresidente_1: "1.er vicepresidente",
  vicepresidente_2: "2.do vicepresidente",
};

const EDU_LEVEL_LABELS: Record<EducationLevel, string> = {
  sin_estudios: "Sin estudios",
  primaria: "Primaria",
  secundaria: "Secundaria",
  tecnico: "Técnico",
  universitario: "Universitario",
  posgrado: "Posgrado",
};

const EDU_STATUS_LABELS: Record<EducationStatus, string> = {
  completo: "Completo",
  incompleto: "Incompleto",
  en_curso: "En curso",
};

const EDU_RANK: Record<EducationLevel, number> = {
  sin_estudios: 0, primaria: 1, secundaria: 2, tecnico: 3,
  universitario: 4, posgrado: 5,
};

/** Sentence-case a DB string that may arrive in ALL CAPS */
function sc(s: string | null | undefined): string {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcPublicExpYears(exp: CandidateFull["experience"]): number {
  return exp
    .filter((e) => e.sector === "publico")
    .reduce((acc, e) => {
      const start = e.year_inicio ?? 0;
      const end = e.year_fin ?? new Date().getFullYear();
      return acc + Math.max(0, end - start);
    }, 0);
}

function highestEdu(education: CandidateFull["education"]) {
  if (!education.length) return null;
  const completed = education.filter((e) => e.estado === "completo" || !!e.year_fin);
  const pool = completed.length > 0 ? completed : education;
  return pool.reduce((best, e) =>
    (EDU_RANK[e.nivel] ?? 0) > (EDU_RANK[best.nivel] ?? 0) ? e : best
  );
}

function formatCurrency(amount: number | null): string {
  if (amount == null) return "—";
  return `S/ ${(amount / 1000).toFixed(0)}k`;
}

// ─── Avatar ──────────────────────────────────────────────────────────────────

function Avatar({ candidate, color }: { candidate: CandidateFull; color: string }) {
  if (candidate.foto_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={candidate.foto_url}
        alt=""
        className="w-11 h-11 rounded-lg object-cover shrink-0"
      />
    );
  }
  const initials = [candidate.nombres, candidate.apellidos]
    .join(" ")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <div
      className="w-11 h-11 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0"
      style={{ backgroundColor: color }}
    >
      {initials}
    </div>
  );
}

// ─── Summary tag ─────────────────────────────────────────────────────────────

function Tag({ children, color = "bg-gray-100 text-gray-600" }: { children: React.ReactNode; color?: string }) {
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium ${color}`}>
      {children}
    </span>
  );
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  candidate: CandidateFull;
  cargo: CargoType;
  partyColor: string;
  simple?: boolean;
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function PersonRow({ candidate, cargo, partyColor, simple = false }: Props) {

  const topEdu = highestEdu(candidate.education);
  const pubYears = calcPublicExpYears(candidate.experience);
  const activeProcesos = candidate.procesos_judiciales.filter((p) =>
    ["en_curso", "en_apelacion", "sentencia_condenatoria", "sentencia_firme"].includes(p.status)
  ).length;
  const penales = candidate.procesos_judiciales.filter((p) => p.status !== "sentencia_civil");
  const civiles = candidate.procesos_judiciales.filter((p) => p.status === "sentencia_civil");
  const patrimonioArr = Array.isArray(candidate.patrimonio)
    ? candidate.patrimonio
    : candidate.patrimonio ? [candidate.patrimonio as typeof candidate.patrimonio[0]] : [];
  const latestPatrimonio = patrimonioArr.sort((a, b) => (b.year ?? 0) - (a.year ?? 0))[0] ?? null;
  const isPresidente = cargo === "presidente";
  const CONGRESS_KEYWORDS = ["CONGRESISTA", "DIPUTADO", "SENADOR", "REPRESENTANTE"];
  const isCongress2021 = candidate.cargo_eleccion?.some(
    (c) =>
      c.tipo === "eleccion" &&
      c.year_inicio === 2021 &&
      CONGRESS_KEYWORDS.some((kw) => c.cargo.toUpperCase().includes(kw))
  ) ?? false;

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* ── Collapsed header ── */}
      <div className="bg-white">
        <div className="flex items-center gap-3 px-4 py-3">
          <Avatar candidate={candidate} color={partyColor} />

          <div className="flex-1 min-w-0">
            {/* Name + role badge */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-semibold text-gray-900">
                {candidate.nombres} {candidate.apellidos}
              </span>
              <span
                className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                  isPresidente ? "bg-[#e53935] text-white" : "bg-gray-200 text-gray-600"
                }`}
              >
                {CARGO_LABELS[cargo] ?? cargo}
              </span>
            </div>

            {/* DNI */}
            {candidate.dni && (
              <div className="text-xs text-gray-400 mt-0.5">DNI {candidate.dni}</div>
            )}

            {/* Summary tags */}
            <div className="flex gap-1.5 mt-1.5 flex-wrap">
              <Tag color={activeProcesos > 0 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}>
                {activeProcesos > 0 ? `${activeProcesos} proceso${activeProcesos !== 1 ? "s" : ""}` : "Sin procesos"}
              </Tag>
              {isCongress2021 && (
                <Tag color="bg-blue-100 text-blue-700">Congresista 2021–2026</Tag>
              )}
              {topEdu && (
                <Tag>{EDU_LEVEL_LABELS[topEdu.nivel]}</Tag>
              )}
              {pubYears > 0 && (
                <Tag>{pubYears} año{pubYears !== 1 ? "s" : ""} exp. pública</Tag>
              )}
              {latestPatrimonio?.ingresos_anuales && (
                <Tag>{formatCurrency(latestPatrimonio.ingresos_anuales)} / año</Tag>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ── Detail accordions ── */}
      {!simple && (
        <div className="border-t border-gray-100 bg-white px-4 py-3 space-y-2">

          {/* 🎓 Formación académica */}
          <Accordion color={partyColor} title="Formación académica" summary={`— ${candidate.education.length} registro${candidate.education.length !== 1 ? "s" : ""}`} defaultOpen={false}>
            {candidate.education.length === 0 ? (
              <p className="text-xs text-gray-400">Sin registros de educación.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-200">
                      <th className="pb-1.5 pr-3 font-medium">Título</th>
                      <th className="pb-1.5 pr-3 font-medium">Institución</th>
                      <th className="pb-1.5 pr-3 font-medium">Año de obtención</th>
                      <th className="pb-1.5 font-medium">Concluido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...candidate.education]
                      .sort((a, b) => {
                        const lvl = (EDU_RANK[b.nivel] ?? 0) - (EDU_RANK[a.nivel] ?? 0);
                        if (lvl !== 0) return lvl;
                        return (b.year_fin ?? b.year_inicio ?? 0) - (a.year_fin ?? a.year_inicio ?? 0);
                      })
                      .map((edu, i) => (
                      <tr key={i} className="border-b border-gray-100 last:border-0">
                        <td className="py-1.5 pr-3 font-medium text-gray-800">
                          {edu.titulo ?? EDU_LEVEL_LABELS[edu.nivel]}
                        </td>
                        <td className="py-1.5 pr-3 text-gray-600">
                          {(edu.nivel === "primaria" || edu.nivel === "secundaria") ? "" : edu.institucion}
                        </td>
                        <td className="py-1.5 pr-3 text-gray-500">
                          {edu.year_fin ?? ""}
                        </td>
                        <td className="py-1.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                              edu.estado === "completo" || !!edu.year_fin
                                ? "bg-green-100 text-green-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {edu.estado === "completo" || !!edu.year_fin ? "Sí" : "No"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Accordion>

          {/* 💼 Experiencia */}
          <Accordion color={partyColor} title="Experiencia" summary={`— ${candidate.experience.length} cargo${candidate.experience.length !== 1 ? "s" : ""}`} defaultOpen={false}>
            {candidate.experience.length === 0 ? (
              <p className="text-xs text-gray-400">Sin experiencia registrada.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse table-fixed">
                  <colgroup>
                    <col style={{ width: "55%" }} />
                    <col style={{ width: "20%" }} />
                    <col style={{ width: "25%" }} />
                  </colgroup>
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-200">
                      <th className="pb-1.5 pr-3 font-medium">Cargo / Institución</th>
                      <th className="pb-1.5 pr-3 font-medium">Sector</th>
                      <th className="pb-1.5 font-medium">Período</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidate.experience
                      .sort((a, b) => (b.year_inicio ?? 0) - (a.year_inicio ?? 0))
                      .map((exp, i) => (
                        <tr key={i} className="border-b border-gray-100 last:border-0">
                          <td className="py-1.5 pr-3 align-top">
                            <p className="font-medium text-gray-800">{exp.cargo}</p>
                            <p className="text-gray-500">{exp.organizacion}</p>
                          </td>
                          <td className="py-1.5 pr-3 align-top">
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                              exp.sector === "publico"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-gray-100 text-gray-600"
                            }`}>
                              {exp.sector === "publico" ? "Público" : "Privado"}
                            </span>
                          </td>
                          <td className="py-1.5 text-gray-400 align-top">
                            {exp.year_inicio ?? "?"} – {exp.year_fin ?? "presente"}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </Accordion>

          {/* 🗳️ Cargos partidarios / elección popular */}
          {candidate.cargo_eleccion && candidate.cargo_eleccion.length > 0 && (() => {
            const partidarios = candidate.cargo_eleccion.filter((c) => c.tipo === "partidario");
            const eleccion    = candidate.cargo_eleccion.filter((c) => c.tipo !== "partidario");
            const total = candidate.cargo_eleccion.length;

            const CargoTable = ({ rows }: { rows: typeof candidate.cargo_eleccion }) => (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse table-fixed">
                  <colgroup>
                    <col style={{ width: "55%" }} />
                    <col style={{ width: "20%" }} />
                    <col style={{ width: "25%" }} />
                  </colgroup>
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-200">
                      <th className="pb-1.5 pr-3 font-medium">Organización</th>
                      <th className="pb-1.5 pr-3 font-medium">Cargo</th>
                      <th className="pb-1.5 font-medium">Período</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...rows]
                      .sort((a, b) => (b.year_inicio ?? 0) - (a.year_inicio ?? 0))
                      .map((c, i) => (
                        <tr key={i} className="border-b border-gray-100 last:border-0">
                          <td className="py-1.5 pr-3 text-gray-600">{c.partido ? sc(c.partido) : "—"}</td>
                          <td className="py-1.5 pr-3 font-medium text-gray-800">{sc(c.cargo)}</td>
                          <td className="py-1.5 text-gray-400">
                            {c.year_inicio ?? "?"} – {c.year_fin ?? "Actualidad"}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            );

            return (
              <Accordion
                color={partyColor}
                title="Cargos partidarios y de elección popular"
                icon=""
                summary={`— ${total} registro${total !== 1 ? "s" : ""}`}
                             >
                <div className="space-y-4">
                  {partidarios.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 tracking-wide mb-2">Cargos partidarios</p>
                      <CargoTable rows={partidarios} />
                    </div>
                  )}
                  {eleccion.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 tracking-wide mb-2">Elección popular</p>
                      <CargoTable rows={eleccion} />
                    </div>
                  )}
                </div>
              </Accordion>
            );
          })()}

          {/* ⚖️ Sentencias penales */}
          <Accordion
            color={partyColor}
            title="Sentencias penales"
            summary={penales.length > 0 ? `— ${penales.length} registro${penales.length !== 1 ? "s" : ""}` : ""}
            defaultOpen={false}
          >
            {penales.length === 0 ? (
              <p className="text-xs text-green-600 font-medium">Sin sentencias penales registradas</p>
            ) : (
              <div className="space-y-2">
                {penales.map((p, i) => (
                  <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2">
                    {/* Header: badge + delito + date */}
                    <div className="flex items-center gap-2">
                      <StatusBadge type="proceso" value={p.status} />
                      <p className="text-[13px] font-medium text-gray-800 flex-1 leading-snug">
                        {p.delito ? sc(p.delito) : <span className="text-gray-400 italic font-normal">Delito no especificado</span>}
                      </p>
                      {p.fecha_sentencia && (
                        <span className="text-[11px] text-gray-400 shrink-0">{p.fecha_sentencia}</span>
                      )}
                    </div>
                    {/* Fallo */}
                    {p.fallo && (
                      <p className="text-[12px] text-gray-600">Fallo: {sc(p.fallo)}</p>
                    )}
                    {/* Badges */}
                    {(p.modalidad || p.cumple_fallo) && (
                      <div className="flex gap-2 flex-wrap">
                        {p.modalidad && (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            p.modalidad.toLowerCase().includes("efectiva")
                              ? "bg-red-100 text-red-700"
                              : "bg-gray-100 text-gray-600"
                          }`}>
                            Pena {sc(p.modalidad)}
                          </span>
                        )}
                        {p.cumple_fallo && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600">
                            {sc(p.cumple_fallo)}
                          </span>
                        )}
                      </div>
                    )}
                    {/* Footer: organo + expediente */}
                    {(p.organo_judicial || (p.caso && p.caso !== "Sin expediente")) && (
                      <div className="border-t border-gray-100 pt-2 flex items-center justify-between gap-2">
                        {p.organo_judicial && (
                          <span className="text-[11px] text-gray-400">{sc(p.organo_judicial)}</span>
                        )}
                        {p.caso && p.caso !== "Sin expediente" && (
                          <span className="text-[11px] text-gray-400 shrink-0">Exp. {p.caso}</span>
                        )}
                      </div>
                    )}
                    {p.fuente_url && (
                      <a href={p.fuente_url} target="_blank" rel="noopener noreferrer"
                        className="block text-[11px] text-blue-600 hover:underline text-right">
                        Ver en JNE ↗
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Accordion>

          {/* ⚖️ Sentencias civiles */}
          {civiles.length > 0 && (
            <Accordion
              color={partyColor}
              title="Sentencias civiles"
              summary={`— ${civiles.length} registro${civiles.length !== 1 ? "s" : ""}`}
              defaultOpen={false}
            >
              <div className="space-y-2">
                {civiles.map((p, i) => (
                  <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2">
                    {/* Header: badge + delito + date */}
                    <div className="flex items-center gap-2">
                      <StatusBadge type="proceso" value={p.status} />
                      <p className="text-[13px] font-medium text-gray-800 flex-1 leading-snug">
                        {p.delito ? sc(p.delito) : <span className="text-gray-400 italic font-normal">Materia no especificada</span>}
                      </p>
                      {p.fecha_sentencia && (
                        <span className="text-[11px] text-gray-400 shrink-0">{p.fecha_sentencia}</span>
                      )}
                    </div>
                    {/* Fallo */}
                    {p.fallo && (
                      <p className="text-[12px] text-gray-600">Fallo: {sc(p.fallo)}</p>
                    )}
                    {/* Footer: organo + expediente */}
                    {(p.organo_judicial || (p.caso && p.caso !== "Sin expediente")) && (
                      <div className="border-t border-gray-100 pt-2 flex items-center justify-between gap-2">
                        {p.organo_judicial && (
                          <span className="text-[11px] text-gray-400">{sc(p.organo_judicial)}</span>
                        )}
                        {p.caso && p.caso !== "Sin expediente" && (
                          <span className="text-[11px] text-gray-400 shrink-0">Exp. {p.caso}</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Accordion>
          )}

          {/* 💰 Patrimonio */}
          <Accordion color={partyColor} title="Patrimonio declarado" defaultOpen={false}>
            {!latestPatrimonio ? (
              <p className="text-xs text-gray-400">Sin declaración jurada registrada.</p>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
                    <p className="text-sm text-gray-500">Ingresos anuales</p>
                    <p className="text-base font-bold text-gray-900 mt-0.5">
                      {latestPatrimonio.ingresos_anuales != null
                        ? `S/ ${latestPatrimonio.ingresos_anuales.toLocaleString("es-PE")}`
                        : "—"}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
                    <p className="text-sm text-gray-500">Bienes declarados</p>
                    <p className="text-base font-bold text-gray-900 mt-0.5">
                      {latestPatrimonio.bienes_declarados != null
                        ? `S/ ${latestPatrimonio.bienes_declarados.toLocaleString("es-PE")}`
                        : "—"}
                    </p>
                  </div>
                </div>
                {latestPatrimonio.dj_url && (
                  <a
                    href={latestPatrimonio.dj_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Ver declaración jurada en JNE →
                  </a>
                )}
                {latestPatrimonio.year && (
                  <p className="text-xs text-gray-400">Declarado en {latestPatrimonio.year}</p>
                )}
              </div>
            )}
          </Accordion>
        </div>
      )}
    </div>
  );
}
