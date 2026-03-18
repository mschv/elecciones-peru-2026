"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  PartidoDetail,
  PlanEje,
  FormulaMemberSlim,
  FormulaMemberFull,
  CargoType,
  PlanGobiernoDocSlim,
  PlanGobiernoSlim,
} from "@/lib/supabase/types";
import { useCompareStore, makeInitials } from "@/lib/store/compareStore";
import PersonRow from "@/components/formula/PersonRow";
import { countGroupedProposals } from "@/lib/utils/compromisos";
import { getCandidatoState } from "@/lib/utils/procesos";
import PlanSection, { EJE_ORDER } from "@/components/shared/PlanSection";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Props {
  partyId: string | null;
  onBack: () => void;
}

interface DetailWithAllMembers extends PartidoDetail {
  allMembers: FormulaMemberSlim[];
}

// ─── Supabase fetch ───────────────────────────────────────────────────────────

async function fetchCongressCandidates(supabase: ReturnType<typeof createClient>, partyId: string) {
  // Senadores and congresistas are stored in `candidates` with partido_id.
  // formula_members only holds presidential cargo (cargo_type enum constraint).
  const PAGE = 1000;
  const results: any[] = [];
  let offset = 0;
  while (true) {
    const { data } = await supabase
      .from("candidates")
      .select(`id, nombres, apellidos, foto_url, cargo, education ( nivel ), procesos_judiciales ( status )`)
      .eq("partido_id", partyId)
      .in("cargo", ["senador", "congresista"])
      .order("apellidos")
      .range(offset, offset + PAGE - 1);
    if (!data?.length) break;
    results.push(...data);
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return results;
}

async function fetchDetail(partyId: string): Promise<DetailWithAllMembers | null> {
  const supabase = createClient();
  const [{ data, error }, congressData] = await Promise.all([
    supabase
      .from("partidos")
      .select(`
        id, slug, nombre, nombre_corto, logo_url, color_hex,
        ideologia, fundacion_year, descripcion, jne_url,
        formulas (
          id, slug, activa,
          formula_members (
            cargo, orden,
            candidate:candidate_id (
              id, slug, nombres, apellidos, foto_url, dni,
              education ( * ),
              experience ( * ),
              procesos_judiciales ( * ),
              patrimonio ( * ),
              cargo_eleccion ( * )
            )
          )
        ),
        plan_gobierno ( eje, titulo, descripcion, problema, problema_grupo, objetivo, indicador, meta, orden ),
        plan_gobierno_docs ( tipo, url, nombre )
      `)
      .eq("id", partyId)
      .single(),
    fetchCongressCandidates(supabase, partyId),
  ]);

  if (error) { console.error("[PartyDetail] fetch error:", error); return null; }

  const partido = data as unknown as PartidoDetail;

  // Presidential formula: find the one with a "presidente" member
  const presidentialFormula =
    (partido.formulas ?? []).find((f) =>
      (f.formula_members ?? []).some((m: any) => m.cargo === "presidente")
    ) ??
    (partido.formulas ?? []).find((f) => f.activa) ??
    (partido.formulas ?? [])[0];
  const formulaMembers: FormulaMemberSlim[] = presidentialFormula?.formula_members ?? [];

  const congressMembers: FormulaMemberSlim[] = congressData.map((c: any) => ({
    cargo: c.cargo,
    orden: 0,
    candidate: {
      id: c.id,
      nombres: c.nombres,
      apellidos: c.apellidos,
      foto_url: c.foto_url,
      education: c.education ?? [],
      procesos_judiciales: c.procesos_judiciales ?? [],
    },
  }));

  return { ...partido, allMembers: [...formulaMembers, ...congressMembers] };
}

// ─── Small UI atoms ───────────────────────────────────────────────────────────

const CONDENA_STATUSES = ["sentencia_condenatoria", "sentencia_firme", "pena_cumplida"];
const ACTIVOS_STATUSES = ["en_curso", "en_apelacion"];
const CIVIL_STATUSES   = ["sentencia_civil"];

function StatRow({
  label, value, accent, href,
}: {
  label: string; value: number; accent?: boolean; href?: string;
}) {
  const row = (
    <div className={`flex justify-between items-center gap-2 ${href && value > 0 ? "group" : ""}`}>
      <span className={`text-[11px] ${href && value > 0 ? "text-gray-600 group-hover:underline" : "text-gray-600"}`}>
        {label}
      </span>
      <span className={`text-[11px] font-semibold shrink-0 ${accent ? "text-red-600" : "text-gray-800"}`}>
        {value}
      </span>
    </div>
  );
  if (href && value > 0) {
    return <Link href={href} className="block">{row}</Link>;
  }
  return row;
}

function GroupStatCard({
  title, count, condenas, activos, civiles, href,
  hrefCondenas, hrefActivos, hrefCiviles,
}: {
  title: string; count: number; condenas: number; activos: number; civiles: number;
  href?: string;
  hrefCondenas?: string; hrefActivos?: string; hrefCiviles?: string;
}) {
  const header = (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{title}</p>
      <p className="text-3xl font-bold text-gray-900 leading-tight mt-0.5">{count}</p>
    </div>
  );
  return (
    <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-4 flex flex-col gap-3 h-full">
      {href ? <Link href={href} className="block hover:opacity-80 transition-opacity">{header}</Link> : header}
      <div className="border-t border-gray-100" />
      <div className="space-y-1.5">
        <StatRow label="Sentencia penal"  value={condenas} accent={condenas > 0} href={hrefCondenas} />
        <StatRow label="En proceso penal" value={activos}  accent={activos > 0}  href={hrefActivos} />
        <StatRow label="Sentencia civil"  value={civiles}                         href={hrefCiviles} />
      </div>
    </div>
  );
}

function InitialsCircle({ name, color, size = 52 }: { name: string; color: string; size?: number }) {
  const initials = name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <div
      className="rounded-lg flex items-center justify-center text-white font-bold shrink-0"
      style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.3 }}
    >
      {initials}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8 text-gray-400 gap-3">
      <span className="text-5xl text-gray-300">—</span>
      <p className="text-sm">Selecciona un partido para ver su detalle</p>
    </div>
  );
}

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
      className={`ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        isAdded
          ? "bg-[#e53935] border-[#e53935] text-white"
          : "border-[#e53935] text-[#e53935] hover:bg-red-50"
      }`}
    >
      {isAdded ? "✓ Añadido" : "+ Comparar"}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const CARGO_ORDER: CargoType[] = ["presidente", "vicepresidente_1", "vicepresidente_2"];
const CARGO_TAB_LABELS: Record<CargoType, string> = {
  presidente: "Presidente",
  vicepresidente_1: "1.er Vice",
  vicepresidente_2: "2.do Vice",
};

export default function PartyDetail({ partyId, onBack }: Props) {
  const [detail, setDetail] = useState<DetailWithAllMembers | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<CargoType>("presidente");
  const planRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!partyId) { setDetail(null); return; }
    setLoading(true);
    fetchDetail(partyId).then((d) => {
      setDetail(d);
      setLoading(false);
    });
  }, [partyId]);

  if (!partyId) return <EmptyState />;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-6 h-6 border-2 border-gray-300 border-t-[#e53935] rounded-full" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        No se pudo cargar el detalle.
      </div>
    );
  }

  const color = detail.color_hex ?? "#6b7280";
  // Use the formula that has a "presidente" member (presidential formula)
  const formula =
    detail.formulas?.find((f) =>
      (f.formula_members ?? []).some((m: any) => m.cargo === "presidente")
    ) ??
    detail.formulas?.find((f) => f.activa) ??
    detail.formulas?.[0] ??
    null;
  const formulaMembers: FormulaMemberSlim[] = formula?.formula_members ?? [];
  const members = detail.allMembers.filter(
    (m, i, arr) => arr.findIndex((x) => x.candidate.id === m.candidate.id) === i
  );

  // Per-group stats
  const formulaGroup   = detail.allMembers.filter((m) => ["presidente", "vicepresidente_1", "vicepresidente_2"].includes(m.cargo));
  const senadoresGroup = detail.allMembers.filter((m) => m.cargo === "senador");
  const diputadosGroup = detail.allMembers.filter((m) => m.cargo === "congresista");

  function groupStats(group: FormulaMemberSlim[]) {
    return {
      condenas: group.filter((m) => m.candidate.procesos_judiciales.some((p) => CONDENA_STATUSES.includes(p.status))).length,
      activos:  group.filter((m) => m.candidate.procesos_judiciales.some((p) => ACTIVOS_STATUSES.includes(p.status))).length,
      civiles:  group.filter((m) => m.candidate.procesos_judiciales.some((p) => CIVIL_STATUSES.includes(p.status))).length,
    };
  }

  const formulaStats   = groupStats(formulaGroup);
  const senadoresStats = groupStats(senadoresGroup);
  const diputadosStats = groupStats(diputadosGroup);

  const formulaCount   = formulaMembers.length;
  const senadoresCount = senadoresGroup.length;
  const diputadosCount = diputadosGroup.length;

  // Plan — filter out header rows (scraped column-name rows, e.g. indicador === "INDICADORES")
  const isHeaderRow = (p: PlanGobiernoSlim) =>
    !!(p.indicador && p.indicador.toLowerCase().trim() === "indicadores");

  const propuestas = (detail.plan_gobierno ?? [])
    .filter((p) => !isHeaderRow(p))
    .sort((a, b) =>
      EJE_ORDER.indexOf(a.eje as PlanEje) - EJE_ORDER.indexOf(b.eje as PlanEje) || a.orden - b.orden
    );
  const propuestasCount = countGroupedProposals(propuestas);

  // Docs
  const docs: PlanGobiernoDocSlim[] = detail.plan_gobierno_docs ?? [];
  const resumenDoc = docs.find((d) => d.tipo === "resumen");
  const completoDoc = docs.find((d) => d.tipo === "completo");

  // Leader from formula
  const lider = formulaMembers.find((m) => m.cargo === "presidente")?.candidate;
  const liderNombre = lider ? `${lider.nombres} ${lider.apellidos}` : null;
  const formulaSlug = (formula as any)?.slug ?? null;

  // Formatted date
  const updatedAt = new Date().toLocaleDateString("es-PE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="min-h-full">
      {/* ── Back button (mobile only) ── */}
      <div className="md:hidden flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-200 sticky top-0 z-10">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <span>←</span>
          <span>Partidos</span>
        </button>
      </div>

      <div className="py-4 px-5 space-y-4">

        {/* ── a) Header card ── */}
        <div
          className="bg-white rounded-xl border border-gray-200 p-5 space-y-4"
          style={{ borderTopWidth: 4, borderTopColor: color }}
        >
          {/* Row 1: Logo + name | JNE note */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              {detail.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={detail.logo_url}
                  alt=""
                  className="w-[52px] h-[52px] rounded-lg object-contain bg-gray-50 shrink-0"
                />
              ) : (
                <InitialsCircle name={detail.nombre_corto ?? detail.nombre} color={color} size={52} />
              )}
              <div className="min-w-0">
                <h1 className="text-base font-bold text-gray-900 leading-tight">{detail.nombre}</h1>
                {liderNombre && (
                  <p className="text-sm text-gray-500 mt-0.5">{liderNombre}</p>
                )}
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] text-gray-400 leading-tight">
                Datos obtenidos del{" "}
                <a
                  href={detail.jne_url ?? "https://www.jne.gob.pe"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-gray-600"
                >
                  JNE
                </a>
              </p>
              <p className="text-[10px] text-gray-400 leading-tight">
                Actualizado {updatedAt}
              </p>
            </div>
          </div>

          {/* Row 2: stat cards per group */}
          <div className="grid grid-cols-3 gap-2">
            <GroupStatCard
              title="Fórmula presidencial"
              count={formulaCount}
              {...formulaStats}
            />
            <GroupStatCard
              title="Senadores"
              count={senadoresCount}
              {...senadoresStats}
              href={`/congreso/senadores?partido=${detail.id}`}
              hrefCondenas={`/congreso/senadores?partido=${detail.id}&procesos=con_condena`}
              hrefActivos={`/congreso/senadores?partido=${detail.id}&procesos=con_activos`}
              hrefCiviles={`/congreso/senadores?partido=${detail.id}&procesos=sentencia_civil`}
            />
            <GroupStatCard
              title="Diputados"
              count={diputadosCount}
              {...diputadosStats}
              href={`/congreso/congresistas?partido=${detail.id}`}
              hrefCondenas={`/congreso/congresistas?partido=${detail.id}&procesos=con_condena`}
              hrefActivos={`/congreso/congresistas?partido=${detail.id}&procesos=con_activos`}
              hrefCiviles={`/congreso/congresistas?partido=${detail.id}&procesos=sentencia_civil`}
            />
          </div>

        </div>

        {/* ── b) Fórmula presidencial ── */}
        {formulaMembers.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="border-b border-gray-200 px-4 pt-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-gray-800 tracking-wider">
                  Fórmula presidencial
                </h2>
                {formula && (
                  <CompareButton
                    id={formula.id}
                    type="formula"
                    slug={formulaSlug ?? formula.id}
                    name={detail.nombre_corto ?? detail.nombre}
                    color={color}
                  />
                )}
              </div>
              <div className="flex gap-1">
                {[...formulaMembers as unknown as FormulaMemberFull[]]
                  .sort((a, b) => CARGO_ORDER.indexOf(a.cargo) - CARGO_ORDER.indexOf(b.cargo))
                  .map((member) => (
                    <button
                      key={member.cargo}
                      onClick={() => setActiveTab(member.cargo)}
                      className={`px-3 py-2 text-xs font-medium rounded-t-lg border-b-2 transition-colors ${
                        activeTab === member.cargo
                          ? "border-[#e53935] text-[#e53935] bg-red-50"
                          : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {CARGO_TAB_LABELS[member.cargo] ?? member.cargo}
                    </button>
                  ))}
              </div>
            </div>
            {[...formulaMembers as unknown as FormulaMemberFull[]]
              .sort((a, b) => CARGO_ORDER.indexOf(a.cargo) - CARGO_ORDER.indexOf(b.cargo))
              .map((member) =>
                member.cargo === activeTab ? (
                  <div key={member.cargo} className="p-4">
                    <PersonRow
                      candidate={member.candidate}
                      cargo={member.cargo}
                      partyColor={color}
                    />
                  </div>
                ) : null
              )}
          </div>
        )}

        {/* ── c) Plan de Gobierno ── */}
        <div ref={planRef} className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-start justify-between gap-3 mb-1">
            <h2 className="text-sm font-bold text-gray-800 tracking-wider">Plan de gobierno</h2>
            <CompareButton
              id={detail.id}
              type="partido"
              slug={detail.slug}
              name={detail.nombre_corto ?? detail.nombre}
              color={detail.color_hex ?? "#6b7280"}
            />
          </div>
          <p className="text-[11px] text-gray-400 italic mb-3">Según el plan presentado al JNE</p>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-sm font-semibold text-gray-900">
              {propuestasCount}{" "}
              <span className="font-normal text-gray-400 underline underline-offset-2">compromisos</span>
            </span>
            {(resumenDoc || completoDoc) && <span className="text-gray-300 text-xs">|</span>}
            {resumenDoc && (
              <a
                href={resumenDoc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 text-xs font-medium text-gray-700 transition-colors"
              >
                Resumen plan
              </a>
            )}
            {completoDoc && (
              <a
                href={completoDoc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-3 py-1.5 rounded-lg bg-gray-900 hover:bg-black text-xs font-medium text-white transition-colors"
              >
                Plan completo
              </a>
            )}
          </div>
          <PlanSection
            key={partyId}
            propuestas={propuestas}
            entityId={partyId}
            color={color}
          />
        </div>

      </div>
    </div>
  );
}
