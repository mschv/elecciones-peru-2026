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

async function fetchDetail(partyId: string): Promise<DetailWithAllMembers | null> {
  const supabase = createClient();
  const [{ data, error }, { data: candidatesData }] = await Promise.all([
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
    supabase
      .from("candidates")
      .select(`
        id, nombres, apellidos, foto_url, cargo,
        education ( nivel ),
        procesos_judiciales ( status )
      `)
      .eq("partido_id", partyId)
      .in("cargo", ["senador", "congresista"]),
  ]);

  if (error) { console.error("[PartyDetail] fetch error:", error); return null; }

  const partido = data as unknown as PartidoDetail;
  const formula = partido.formulas?.find((f) => f.activa) ?? partido.formulas?.[0];
  const formulaMembers: FormulaMemberSlim[] = formula?.formula_members ?? [];

  const congressMembers: FormulaMemberSlim[] = (candidatesData ?? []).map((c: any) => ({
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

function StatCard({ label, value, accent, href }: {
  label: string; value: number; accent?: boolean; href?: string;
}) {
  const inner = (
    <>
      <div className={`text-xl font-bold leading-tight ${accent ? "text-red-600" : "text-gray-900"}`}>{value}</div>
      <div className="text-[10px] text-gray-500 mt-0.5 leading-tight text-center">{label}</div>
    </>
  );
  const cls = `flex-1 flex flex-col items-center justify-center bg-white rounded-lg border border-gray-200 p-3 transition-colors ${
    href ? "hover:border-gray-300 cursor-pointer" : ""
  }`;
  if (href) return <Link href={href} className={cls}>{inner}</Link>;
  return <div className={cls}>{inner}</div>;
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
  const formula = detail.formulas?.find((f) => f.activa) ?? detail.formulas?.[0] ?? null;
  const formulaMembers: FormulaMemberSlim[] = formula?.formula_members ?? [];
  const members = detail.allMembers.filter(
    (m, i, arr) => arr.findIndex((x) => x.candidate.id === m.candidate.id) === i
  );

  // Stats
  const formulaCount   = formulaMembers.length;
  const senadoresCount = members.filter((m) => m.cargo === "senador").length;
  const diputadosCount = members.filter((m) => m.cargo === "congresista").length;
  const activos        = members.filter((m) => m.candidate.procesos_judiciales.some((p) => ["en_curso", "en_apelacion"].includes(p.status))).length;
  const condenas       = members.filter((m) => m.candidate.procesos_judiciales.some((p) => ["sentencia_condenatoria", "sentencia_firme", "pena_cumplida"].includes(p.status))).length;
  const civiles        = members.filter((m) => m.candidate.procesos_judiciales.some((p) => p.status === "sentencia_civil")).length;

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

          {/* Row 2: 4 stat cards */}
          <div className="flex gap-2">
            <StatCard
              label="Fórmula presidencial"
              value={formulaCount}
            />
            <StatCard
              label="Senadores"
              value={senadoresCount}
              href={`/congreso/senadores?partido=${detail.id}`}
            />
            <StatCard
              label="Diputados"
              value={diputadosCount}
              href={`/congreso/congresistas?partido=${detail.id}`}
            />
            <StatCard label="Candidatos con procesos penales activos" value={activos} accent={activos > 0} />
            {condenas > 0 && <StatCard label="Candidatos con condena firme" value={condenas} accent />}
            {civiles > 0 && <StatCard label="Candidatos con sentencias civiles" value={civiles} accent />}
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
