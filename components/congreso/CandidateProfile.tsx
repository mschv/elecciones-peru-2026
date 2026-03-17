"use client";

import Link from "next/link";
import type { CongresoMemberFull, EducationLevel, EducationStatus, AnotacionJne } from "@/lib/supabase/types";
import Accordion from "@/components/shared/Accordion";
import StatusBadge from "@/components/shared/StatusBadge";
import DataSourceNote from "@/components/shared/DataSourceNote";
import { useCompareStore, makeInitials } from "@/lib/store/compareStore";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CARGO_LABEL: Record<string, string> = {
  senador: "Senador",
  congresista: "Diputado",
};

const EDU_LEVEL_LABELS: Record<EducationLevel, string> = {
  sin_estudios: "Sin estudios", primaria: "Primaria", secundaria: "Secundaria", tecnico: "Técnico",
  universitario: "Universitario", posgrado: "Posgrado",
  
};

const EDU_STATUS_LABELS: Record<EducationStatus, string> = {
  completo: "Completo", incompleto: "Incompleto", en_curso: "En curso",
};

const EDU_RANK: Record<EducationLevel, number> = {
  sin_estudios: 0, primaria: 1, secundaria: 2, tecnico: 3, universitario: 4, posgrado: 5,
};

/** Sentence-case a DB string that may arrive in ALL CAPS */
function sc(s: string | null | undefined): string {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function calcPoliticsYears(
  exp: CongresoMemberFull["candidate"]["experience"],
  cargoEleccion: CongresoMemberFull["candidate"]["cargo_eleccion"],
): number {
  const publicExp = exp
    .filter((e) => e.sector === "publico")
    .map((e) => ({ start: e.year_inicio ?? 0, end: e.year_fin ?? new Date().getFullYear() }));

  const eleccion = cargoEleccion
    .map((c) => ({ start: c.year_inicio ?? 0, end: c.year_fin ?? new Date().getFullYear() }));

  // Merge all intervals and sum unique years to avoid double-counting
  const allYears = new Set<number>();
  for (const { start, end } of [...publicExp, ...eleccion]) {
    if (start === 0) continue;
    for (let y = start; y < end; y++) allYears.add(y);
  }
  return allYears.size;
}

function highestEdu(education: CongresoMemberFull["candidate"]["education"]) {
  if (!education.length) return null;
  return education.reduce((best, e) =>
    (EDU_RANK[e.nivel] ?? 0) > (EDU_RANK[best.nivel] ?? 0) ? e : best
  );
}

// ─── Stat card ───────────────────────────────────────────────────────────────

function StatCard({ label, value, color = "text-gray-900" }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
      <div className={`text-xl font-bold leading-tight ${color}`}>{value}</div>
      <div className="text-[10px] text-gray-500 mt-0.5 leading-tight">{label}</div>
    </div>
  );
}

// ─── Avatar ──────────────────────────────────────────────────────────────────

function Avatar({ member }: { member: CongresoMemberFull }) {
  const { candidate, formula } = member;
  const color = formula.partido.color_hex ?? "#6b7280";
  if (candidate.foto_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={candidate.foto_url} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" />
    );
  }
  const initials = `${candidate.nombres} ${candidate.apellidos}`
    .split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <div
      className="w-14 h-14 rounded-lg flex items-center justify-center text-white text-lg font-bold shrink-0"
      style={{ backgroundColor: color }}
    >
      {initials}
    </div>
  );
}

// ─── Compare button ───────────────────────────────────────────────────────────

function CompareButton({
  id, type, slug, name, color,
}: {
  id: string; type: "partido" | "formula" | "candidato";
  slug: string; name: string; color: string;
}) {
  const { items, addItem, removeItem, canAdd } = useCompareStore();
  const isAdded = items.some((i) => i.id === id);
  return (
    <button
      onClick={() =>
        isAdded
          ? removeItem(id)
          : addItem({ id, type, slug, name, color, initials: makeInitials(name) })
      }
      disabled={!isAdded && !canAdd}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        isAdded
          ? "bg-[#e53935] border-[#e53935] text-white"
          : "border-[#e53935] text-[#e53935] hover:bg-red-50"
      }`}
    >
      {isAdded ? "✓ Añadido" : "+ Comparar"}
    </button>
  );
}

// ─── Anotaciones JNE ─────────────────────────────────────────────────────────

const TIPO_BADGE: Record<string, { bg: string; text: string }> = {
  "DATO FALSO":   { bg: "bg-red-100",   text: "text-red-700" },
  "DATO ERRÓNEO": { bg: "bg-amber-100", text: "text-amber-700" },
};

function tipoBadge(tipo: string | null) {
  const raw = tipo ?? "ANOTACIÓN";
  const label = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  const style = TIPO_BADGE[raw] ?? { bg: "bg-gray-100", text: "text-gray-600" };
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${style.bg} ${style.text}`}>
      {label}
    </span>
  );
}

function AnotacionesSection({ anotaciones }: { anotaciones: AnotacionJne[] }) {
  if (anotaciones.length === 0) return null;

  const hasFalso = anotaciones.some((a) => a.tipo_anotacion === "DATO FALSO");
  const headerColor = hasFalso ? "text-red-700" : "text-amber-700";
  const accordionTitle = (
    <span className={`font-medium ${headerColor}`}>
      ⚠ Correcciones JNE — {anotaciones.length} observacion{anotaciones.length !== 1 ? "es" : ""}
    </span>
  );

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <details>
        <summary className="flex items-center justify-between px-4 py-3 hover:bg-gray-100 transition-colors cursor-pointer list-none" style={{ backgroundColor: "#faf9f7" }}>
          <span className="flex items-center gap-2 text-sm">
            {accordionTitle}
          </span>
          <span className="text-gray-400 text-xs shrink-0">▾</span>
        </summary>
        <div className="px-4 py-3 space-y-3">
          <p className="text-[11px] text-gray-400 italic">
            Correcciones ordenadas por el JNE sobre la declaración jurada de este candidato.
          </p>
          {anotaciones.map((a, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2">
              {/* Header row */}
              <div className="flex items-start justify-between gap-2">
                {tipoBadge(a.tipo_anotacion)}
                {a.fecha && (
                  <span className="text-[11px] text-gray-400 shrink-0">
                    {a.fecha.split(" ")[0]}
                  </span>
                )}
              </div>

              {/* Section + references */}
              {a.seccion_hv && (
                <p className="text-[12px] font-medium text-gray-700">{a.seccion_hv}</p>
              )}
              <div className="flex gap-3 flex-wrap text-[11px] text-gray-400">
                {a.nro_expediente && <span>Expediente: {a.nro_expediente}</span>}
                {a.nro_documento  && <span>Resolución: {a.nro_documento}</span>}
              </div>

              {/* Declaró vs Debe decir */}
              {(a.dice || a.debe_decir) && (
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <div className="bg-red-50 rounded p-2">
                    <p className="text-[10px] font-medium text-red-500 tracking-wide mb-1">Declaró</p>
                    <p className="text-[11px] text-gray-600 leading-relaxed">{a.dice ?? "—"}</p>
                  </div>
                  <div className="bg-green-50 rounded p-2">
                    <p className="text-[10px] font-medium text-green-600 tracking-wide mb-1">Debe decir</p>
                    <p className="text-[11px] text-gray-600 leading-relaxed">{a.debe_decir ?? "—"}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  member: CongresoMemberFull;
  onBack?: () => void;
  standalone?: boolean;
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function CandidateProfile({ member, onBack, standalone = false }: Props) {
  const { candidate, formula, cargo, region, is_incumbent, is_first_time } = member;
  const partido = formula.partido;
  const color = partido.color_hex ?? "#6b7280";
  const fullName = `${candidate.nombres} ${candidate.apellidos}`;

  const activeProcesos  = candidate.procesos_judiciales.filter((p) =>
    ["en_curso", "en_apelacion"].includes(p.status)
  ).length;
  const condenaFirme    = candidate.procesos_judiciales.filter((p) =>
    ["sentencia_condenatoria", "sentencia_firme", "pena_cumplida"].includes(p.status)
  ).length;
  const sentenciasCiviles = candidate.procesos_judiciales.filter((p) => p.status === "sentencia_civil").length;

  const politicsYears = calcPoliticsYears(candidate.experience, candidate.cargo_eleccion);
  const patrimonioArr = Array.isArray(candidate.patrimonio) ? candidate.patrimonio : (candidate.patrimonio ? [candidate.patrimonio] : []);
  const latestPatrimonio = [...patrimonioArr].sort((a, b) => (b.year ?? 0) - (a.year ?? 0))[0] ?? null;

  const topEdu = highestEdu(candidate.education);
  const autoOpen = cargo === "senador" || cargo === "congresista";

  return (
    <div className="min-h-full">
      {/* Mobile back (panel mode only) */}
      {!standalone && onBack && (
        <div className="md:hidden flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-200 sticky top-0 z-10">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"
          >
            ← Candidatos
          </button>
        </div>
      )}

      <div className="p-4 md:p-5 space-y-4">

        {/* ── a) Header card ── */}
        <div
          className="bg-white rounded-xl border border-gray-200 p-5 space-y-4"
          style={{ borderTopWidth: 4, borderTopColor: color }}
        >
          <div className="flex items-start gap-4">
            <Avatar member={member} />
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h1 className="text-xl font-bold text-gray-900 leading-tight flex items-center gap-2 flex-wrap">
                    {fullName}
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 font-normal">{CARGO_LABEL[cargo] ?? cargo}</span>
                    {is_incumbent && <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 font-normal">En ejercicio</span>}
                    {is_first_time && !is_incumbent && <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700 font-normal">Primera vez</span>}
                    {condenaFirme > 0 && <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 font-normal">Condena firme</span>}
                    {activeProcesos > 0 && <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 font-normal">Proceso penal</span>}
                    {sentenciasCiviles > 0 && <span className="px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700 font-normal">Sentencia civil</span>}
                    {activeProcesos === 0 && condenaFirme === 0 && sentenciasCiviles === 0 && <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500 font-normal">Sin procesos penales</span>}
                    {topEdu && <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700 font-normal">{EDU_LEVEL_LABELS[topEdu.nivel]}</span>}
                  </h1>
                  {/* Party link with colored dot */}
                  <div className="flex items-center gap-2 mt-1">
                    <Link
                      href={`/partidos/${partido.slug}`}
                      className="inline-flex items-center gap-1.5 hover:underline"
                    >
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-sm text-gray-600">{partido.nombre}</span>
                    </Link>
                    {member.orden && (
                      <span className="text-xs text-gray-400">· N°{member.orden} en lista</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {[region, formula.numero_lista ? `Lista N°${formula.numero_lista}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                  {candidate.dni && (
                    <div className="text-xs text-gray-400 mt-0.5">DNI {candidate.dni}</div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <DataSourceNote
                    source_url="https://www.jne.gob.pe"
                    last_scraped_at={new Date().toISOString()}
                  />
                  <CompareButton
                    id={candidate.id}
                    type="candidato"
                    slug={candidate.slug}
                    name={fullName}
                    color={color}
                  />
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* ── b) Stats row ── */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <StatCard label="Años en sector público" value={politicsYears > 0 ? politicsYears : "—"} />
          <StatCard
            label="Ingresos anuales"
            value={latestPatrimonio?.ingresos_anuales != null
              ? `S/ ${(latestPatrimonio.ingresos_anuales / 1000).toFixed(0)}k`
              : "—"}
          />
          <StatCard
            label="Bienes declarados"
            value={latestPatrimonio?.bienes_declarados != null
              ? `S/ ${(latestPatrimonio.bienes_declarados / 1000).toFixed(0)}k`
              : "—"}
          />
          <StatCard
            label="Procesos penales activos"
            value={activeProcesos}
            color={activeProcesos > 0 ? "text-red-600" : "text-green-600"}
          />
          <StatCard
            label="Condena firme"
            value={condenaFirme}
            color={condenaFirme > 0 ? "text-red-700" : "text-green-600"}
          />
          <StatCard
            label="Sentencias civiles registradas"
            value={sentenciasCiviles}
            color={sentenciasCiviles > 0 ? "text-orange-500" : "text-green-600"}
          />
        </div>

        {/* ── c) Accordions ── */}
        <div className="space-y-2">

          {/* Formación académica */}
          <Accordion
            color={color}
            title="Formación académica"
            summary={`— ${candidate.education.length} registro${candidate.education.length !== 1 ? "s" : ""}`}
            defaultOpen={autoOpen}
          >
            {candidate.education.length === 0 ? (
              <p className="text-xs text-gray-400">Sin registros de educación.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
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
                            className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              edu.estado === "completo" || !!edu.year_fin ? "bg-green-100 text-green-700"
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

          {/* Experiencia */}
          <Accordion
            color={color}
            title="Experiencia"
            summary={`— ${candidate.experience.length} cargo${candidate.experience.length !== 1 ? "s" : ""}`}
            defaultOpen={autoOpen}
          >
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
                            <p className="font-medium text-gray-800">{sc(exp.cargo)}</p>
                            <p className="text-gray-500">{sc(exp.organizacion)}</p>
                          </td>
                          <td className="py-1.5 pr-3 align-top">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
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
                color={color}
                title="Cargos partidarios y de elección popular"
                summary={`— ${total} registro${total !== 1 ? "s" : ""}`}
                defaultOpen={autoOpen}
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

          {/* Procesos penales */}
          {(() => {
            const penales = candidate.procesos_judiciales.filter((p) => p.status !== "sentencia_civil");
            if (penales.length === 0) return (
              <Accordion color={color} title="Sentencias penales" summary="" defaultOpen={autoOpen}>
                <p className="text-xs text-green-600 font-medium">Sin sentencias penales registradas</p>
              </Accordion>
            );
            return (
              <Accordion color={color} title="Sentencias penales" summary={`— ${penales.length} registro${penales.length !== 1 ? "s" : ""}`} defaultOpen={autoOpen}>
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
              </Accordion>
            );
          })()}

          {/* Sentencias civiles */}
          {(() => {
            const civiles = candidate.procesos_judiciales.filter((p) => p.status === "sentencia_civil");
            if (civiles.length === 0) return null;
            return (
              <Accordion color={color} title="Sentencias civiles" summary={`— ${civiles.length} registro${civiles.length !== 1 ? "s" : ""}`} defaultOpen={autoOpen}>
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
            );
          })()}
          {/* Correcciones JNE */}
          <AnotacionesSection anotaciones={(candidate as any).anotaciones_jne ?? []} />

        </div>

        {/* ── d) DataSourceNote ── */}
        <div className="px-0.5">
          <DataSourceNote
            source_url="https://www.jne.gob.pe"
            last_scraped_at={new Date().toISOString()}
          />
        </div>

      </div>
    </div>
  );
}
