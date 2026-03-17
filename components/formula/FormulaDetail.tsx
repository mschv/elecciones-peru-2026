"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { FormulaFull, CargoType, PlanEje, PlanGobiernoSlim } from "@/lib/supabase/types";
import PersonRow from "./PersonRow";
import DataSourceNote from "@/components/shared/DataSourceNote";
import { useCompareStore, makeInitials } from "@/lib/store/compareStore";
import { countGroupedProposals } from "@/lib/utils/compromisos";
import PlanSection, { EJE_ORDER } from "@/components/shared/PlanSection";

// ─── Fetch ───────────────────────────────────────────────────────────────────

async function fetchFormulaFull(formulaId: string): Promise<{ data: FormulaFull | null; error: string | null }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("formulas")
    .select(`
      id, slug, activa, numero_lista,
      partido:partido_id (
        id, nombre, nombre_corto, logo_url, color_hex,
        fundacion_year, ideologia,
        plan_gobierno ( eje, titulo, descripcion, problema, problema_grupo, objetivo, indicador, meta, orden )
      ),
      formula_members (
        cargo, orden,
        candidate:candidate_id (
          id, slug, nombres, apellidos, foto_url, dni,
          education ( * ),
          experience ( * ),
          procesos_judiciales ( * ),
          cargo_eleccion ( * )
        )
      )
    `)
    .eq("id", formulaId)
    .single();

  if (error) { console.error("[FormulaDetail] fetch error:", JSON.stringify(error)); return { data: null, error: JSON.stringify(error) }; }
  return { data: data as unknown as FormulaFull, error: null };
}

// ─── Cargo order ─────────────────────────────────────────────────────────────

const CARGO_ORDER: CargoType[] = [
  "presidente",
  "vicepresidente_1",
  "vicepresidente_2",
];

// ─── Empty / Loading ─────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8 text-gray-400 gap-3">
      <span className="text-5xl text-gray-300">—</span>
      <p className="text-sm">Selecciona una fórmula para ver el detalle</p>
    </div>
  );
}

// ─── Stat pill ───────────────────────────────────────────────────────────────

function Pill({
  label, value, color = "bg-gray-100 text-gray-700",
}: { label: string; value: string | number; color?: string }) {
  return (
    <div className={`flex flex-col items-center px-3 py-1.5 rounded-lg text-center ${color}`}>
      <span className="text-lg font-bold leading-tight">{value}</span>
      <span className="text-[10px] leading-tight">{label}</span>
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

// ─── Main ─────────────────────────────────────────────────────────────────────

interface Props {
  formulaId: string | null;
  onBack: () => void;
}

const CARGO_TAB_LABELS: Record<CargoType, string> = {
  presidente: "Presidente",
  vicepresidente_1: "1.er Vice",
  vicepresidente_2: "2.do Vice",
};

export default function FormulaDetail({ formulaId, onBack }: Props) {
  const [formula, setFormula] = useState<FormulaFull | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<CargoType>("presidente");

  useEffect(() => {
    if (!formulaId) { setFormula(null); setFetchError(null); return; }
    setLoading(true);
    setFetchError(null);
    fetchFormulaFull(formulaId).then(({ data, error }) => {
      setFormula(data);
      setFetchError(error);
      setLoading(false);
    });
  }, [formulaId]);

  if (!formulaId) return <EmptyState />;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-6 h-6 border-2 border-gray-300 border-t-[#e53935] rounded-full" />
      </div>
    );
  }

  if (!formula) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm p-4 text-center flex-col gap-2">
        <p>No se pudo cargar el detalle.</p>
        {fetchError && <pre className="text-xs text-red-500 whitespace-pre-wrap text-left max-w-sm">{fetchError}</pre>}
      </div>
    );
  }

  const color = formula.partido.color_hex ?? "#6b7280";

  // Sort members by CARGO_ORDER
  const sortedMembers = [...formula.formula_members].sort(
    (a, b) => CARGO_ORDER.indexOf(a.cargo) - CARGO_ORDER.indexOf(b.cargo)
  );

  // Plan de gobierno
  const isHeaderRow = (p: PlanGobiernoSlim) =>
    !!(p.indicador && p.indicador.toLowerCase().trim() === "indicadores");
  const propuestas = (formula.partido.plan_gobierno ?? [])
    .filter((p) => !isHeaderRow(p))
    .sort((a, b) =>
      EJE_ORDER.indexOf(a.eje as PlanEje) - EJE_ORDER.indexOf(b.eje as PlanEje) || a.orden - b.orden
    );
  const propuestasCount = countGroupedProposals(propuestas);

  // Stats
  const totalProcesos = sortedMembers.reduce(
    (acc, m) => acc + m.candidate.procesos_judiciales.length,
    0
  );
  const activeProcesos = sortedMembers.reduce(
    (acc, m) =>
      acc +
      m.candidate.procesos_judiciales.filter((p) =>
        ["en_curso", "acusacion", "juicio", "sentencia_condenatoria"].includes(p.status)
      ).length,
    0
  );

  return (
    <div className="min-h-full">
      {/* Mobile back button */}
      <div className="md:hidden flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-200 sticky top-0 z-10">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <span>←</span>
          <span>Fórmulas</span>
        </button>
      </div>

      <div className="p-4 md:p-6 space-y-5">

        {/* ── a) Header card ── */}
        <div
          className="bg-white rounded-xl border border-gray-200 p-5 space-y-4"
          style={{ borderTopWidth: 4, borderTopColor: color }}
        >
          <div className="flex items-start gap-4">
            {formula.partido.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={formula.partido.logo_url}
                alt=""
                className="w-16 h-16 rounded-xl object-contain bg-gray-50 shrink-0"
              />
            ) : (
              <div
                className="w-16 h-16 rounded-xl flex items-center justify-center text-white text-xl font-bold shrink-0"
                style={{ backgroundColor: color }}
              >
                {(formula.partido.nombre_corto ?? formula.partido.nombre)
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((w) => w[0])
                  .join("")
                  .toUpperCase()}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h1 className="text-lg font-bold text-gray-900 leading-tight">
                    {formula.partido.nombre}
                  </h1>
                  <p className="text-xs text-gray-500 mt-0.5">Fórmula Presidencial 2026</p>
                  {formula.numero_lista && (
                    <p className="text-xs text-gray-400">Lista N° {formula.numero_lista}</p>
                  )}
                </div>
                <DataSourceNote
                  source_url="https://www.jne.gob.pe"
                  last_scraped_at={new Date().toISOString()}
                />
              </div>

              <div className="flex gap-2 mt-3 flex-wrap">
                <Pill
                  label="Procesos activos"
                  value={activeProcesos}
                  color={activeProcesos > 0 ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}
                />
                <Pill label="Compromisos" value={propuestasCount} color="bg-blue-50 text-blue-700" />
              </div>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            {formula && (
              <CompareButton
                id={formula.id}
                type="formula"
                slug={formula.slug}
                name={formula.partido.nombre_corto ?? formula.partido.nombre}
                color={formula.partido.color_hex ?? "#6b7280"}
              />
            )}
          </div>
        </div>

        {/* ── b) Tabbed candidate profiles ── */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="border-b border-gray-200 px-4 pt-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
              Miembros de la Fórmula
            </h2>
            {sortedMembers.length === 0 ? (
              <p className="text-sm text-gray-400 pb-4">Sin miembros registrados.</p>
            ) : (
              <div className="flex gap-1">
                {sortedMembers.map((member) => (
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
            )}
          </div>

          {sortedMembers.map((member) =>
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

        {/* ── c) Plan de Gobierno ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-medium text-gray-900 mb-1">
            Plan de Gobierno{" "}
            <span className="font-normal text-gray-400">— {propuestasCount} compromisos</span>
          </h2>
          <p className="text-[11px] text-gray-400 italic mb-4">Según el plan presentado al JNE</p>
          <PlanSection
            key={formula.id}
            propuestas={propuestas}
            entityId={formula.id}
            color={color}
          />
        </div>

      </div>
    </div>
  );
}
