"use client";

import { useState } from "react";
import type { FormulaMemberSlim, CargoType, EducationLevel } from "@/lib/supabase/types";
import { getCandidatoState, type ProcesoState } from "@/lib/utils/procesos";

// ─── Constants ───────────────────────────────────────────────────────────────

const CARGO_LABELS: Partial<Record<CargoType, string>> = {
  presidente: "Presidente",
  vicepresidente_1: "Vicepresidente",
  senador: "Senador",
  congresista: "Diputado",
};

const CARGO_ORDER: CargoType[] = ["presidente", "vicepresidente_1", "senador", "congresista"];

const EDU_SEGMENTS = [
  { key: "sin_datos",     label: "Sin datos",      color: "#e5e7eb" },
  { key: "sin_estudios",  label: "Sin estudios",   color: "#888780" },
  { key: "primaria",      label: "Primaria",        color: "#B4B2A9" },
  { key: "secundaria",    label: "Secundaria",      color: "#D3D1C7" },
  { key: "tecnico",       label: "Técnico",         color: "#534AB7" },
  { key: "universitario", label: "Universitario",   color: "#1976d2" },
  { key: "posgrado",      label: "Posgrado",        color: "#0F6E56" },
] as const;


// ─── Tooltip ─────────────────────────────────────────────────────────────────

type TipState = { content: React.ReactNode; x: number; y: number } | null;

function FloatingTooltip({ tip }: { tip: TipState }) {
  if (!tip) return null;
  return (
    <div
      style={{
        position: "fixed",
        left: tip.x + 12,
        top: tip.y - 8,
        zIndex: 1000,
        pointerEvents: "none",
      }}
      className="bg-white border border-gray-200 rounded-md shadow-md px-2.5 py-2 text-[11px] min-w-[140px]"
    >
      {tip.content}
    </div>
  );
}

// ─── Education helpers ────────────────────────────────────────────────────────

function maxEduGroup(levels: EducationLevel[]): string {
  if (levels.some((l) => l === "posgrado"))      return "posgrado";
  if (levels.some((l) => l === "universitario")) return "universitario";
  if (levels.some((l) => l === "tecnico"))       return "tecnico";
  if (levels.some((l) => l === "secundaria"))    return "secundaria";
  if (levels.some((l) => l === "primaria"))      return "primaria";
  return "sin_estudios";
}

type EduRow = { cargo: string; total: number; counts: Record<string, number> };

function buildEduData(members: FormulaMemberSlim[]): EduRow[] {
  return CARGO_ORDER.map((cargo) => {
    const group = members.filter((m) =>
      cargo === "vicepresidente_1"
        ? ["vicepresidente_1", "vicepresidente_2"].includes(m.cargo)
        : m.cargo === cargo
    );
    if (group.length === 0) return null;
    const counts: Record<string, number> = {
      sin_datos: 0, sin_estudios: 0, primaria: 0, secundaria: 0,
      tecnico: 0, universitario: 0, posgrado: 0,
    };
    group.forEach((m) => {
      const levels = m.candidate.education.map((e) => e.nivel);
      if (levels.length === 0) { counts.sin_datos++; return; }
      counts[maxEduGroup(levels)]++;
    });
    return { cargo: CARGO_LABELS[cargo] ?? cargo, total: group.length, counts };
  }).filter(Boolean) as EduRow[];
}

// ─── Judicial helpers ─────────────────────────────────────────────────────────

const JUDICIAL_SEGMENTS: { key: ProcesoState; color: string; label: string }[] = [
  { key: "activo",  color: "#e53935", label: "Con procesos activos" },
  { key: "condena", color: "#444441", label: "Con condena firme" },
  { key: "limpio",  color: "#e5e7eb", label: "Sin procesos activos" },
];

type JudicialRow = {
  cargo: string;
  total: number;
  stateCounts: Record<ProcesoState, number>;
};

function buildJudicialData(members: FormulaMemberSlim[]): JudicialRow[] {
  return CARGO_ORDER.map((cargo) => {
    const group = members.filter((m) =>
      cargo === "vicepresidente_1"
        ? ["vicepresidente_1", "vicepresidente_2"].includes(m.cargo)
        : m.cargo === cargo
    );
    if (group.length === 0) return null;
    const stateCounts: Record<ProcesoState, number> = { activo: 0, condena: 0, limpio: 0 };
    group.forEach((m) => {
      stateCounts[getCandidatoState(m.candidate.procesos_judiciales)]++;
    });
    return { cargo: CARGO_LABELS[cargo] ?? cargo, total: group.length, stateCounts };
  }).filter(Boolean) as JudicialRow[];
}

// ─── Bar segment ─────────────────────────────────────────────────────────────

const TEXT_THRESHOLD      = 0.12; // ~28px on a 240px bar
const GRAY_TEXT_THRESHOLD = 0.38; // ~90px on a 240px bar

function BarSegment({
  count, total, color, textWhite, grayText,
}: {
  count: number; total: number; color: string;
  textWhite?: string; grayText?: string;
}) {
  if (count === 0 || total === 0) return null;
  const pct = count / total;
  return (
    <div
      style={{ flex: count, backgroundColor: color, minWidth: 0 }}
      className="flex items-center justify-center overflow-hidden"
    >
      {!!textWhite && pct >= TEXT_THRESHOLD && (
        <span className="text-white text-[9px] font-medium whitespace-nowrap px-0.5 leading-none">
          {textWhite}
        </span>
      )}
      {!!grayText && pct >= GRAY_TEXT_THRESHOLD && (
        <span className="text-gray-400 text-[9px] whitespace-nowrap px-0.5 leading-none">
          {grayText}
        </span>
      )}
    </div>
  );
}

// ─── Education chart ──────────────────────────────────────────────────────────

export function EducationChart({ members }: { members: FormulaMemberSlim[] }) {
  const rows = buildEduData(members);
  const [tip, setTip] = useState<TipState>(null);

  if (rows.length === 0) return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h2 className="text-xs font-semibold text-gray-700 tracking-wide">Nivel educativo por cargo</h2>
      <p className="text-xs text-gray-400 mt-4">Sin datos</p>
    </div>
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <FloatingTooltip tip={tip} />
      <h2 className="text-xs font-semibold text-gray-700 tracking-wide">Nivel educativo por cargo</h2>
      <p className="text-[10px] text-gray-400 mt-0.5 mb-3">Nivel educativo máximo alcanzado</p>

      <div className="space-y-2">
        {rows.map((row) => {
          const tooltipContent = (
            <>
              <p className="font-semibold text-gray-800 mb-1">{row.cargo} · {row.total} candidatos</p>
              {EDU_SEGMENTS.filter((s) => row.counts[s.key] > 0).map((s) => (
                <div key={s.key} className="flex items-center gap-1.5 text-gray-600">
                  <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: s.color }} />
                  {s.label}: {row.counts[s.key]}
                </div>
              ))}
            </>
          );
          return (
            <div
              key={row.cargo}
              className="flex items-center gap-2"
              onMouseEnter={(e) => setTip({ content: tooltipContent, x: e.clientX, y: e.clientY })}
              onMouseMove={(e) => setTip((prev) => prev ? { ...prev, x: e.clientX, y: e.clientY } : null)}
              onMouseLeave={() => setTip(null)}
            >
              <span className="w-24 text-xs text-gray-500 shrink-0 text-right">{row.cargo}</span>
              <div className="flex-1 flex h-[18px] rounded overflow-hidden bg-gray-100">
                {EDU_SEGMENTS.map((seg) => (
                  <BarSegment
                    key={seg.key}
                    count={row.counts[seg.key]}
                    total={row.total}
                    color={seg.color}
                    textWhite={String(row.counts[seg.key])}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-3 flex-wrap mt-3">
        {EDU_SEGMENTS.map((seg) => (
          <div key={seg.key} className="flex items-center gap-1 text-[10px] text-gray-500">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: seg.color }} />
            {seg.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Judicial chart ───────────────────────────────────────────────────────────

export function JudicialChart({ members }: { members: FormulaMemberSlim[] }) {
  const rows = buildJudicialData(members);
  const [tip, setTip] = useState<TipState>(null);

  if (rows.length === 0) return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h2 className="text-xs font-semibold text-gray-700 tracking-wide">Procesos judiciales por cargo</h2>
      <p className="text-xs text-gray-400 mt-4">Sin datos</p>
    </div>
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <FloatingTooltip tip={tip} />
      <h2 className="text-xs font-semibold text-gray-700 tracking-wide">Procesos judiciales por cargo</h2>
      <p className="text-[10px] text-gray-400 mt-0.5 mb-3">Candidatos con procesos judiciales</p>

      <div className="space-y-2">
        {rows.map((row) => {
          const tooltipContent = (
            <>
              <p className="font-semibold text-gray-800 mb-1">{row.cargo} · {row.total} candidatos</p>
              {JUDICIAL_SEGMENTS.filter((s) => s.key !== "limpio" && row.stateCounts[s.key] > 0).map((s) => (
                <div key={s.key} className="flex items-center gap-1.5 text-gray-600">
                  <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: s.color }} />
                  {s.label}: {row.stateCounts[s.key]}
                </div>
              ))}
              <div className="flex items-center gap-1.5 text-gray-600">
                <span className="w-2 h-2 rounded-sm shrink-0 bg-gray-300" />
                Sin procesos activos: {row.stateCounts.limpio}
              </div>
            </>
          );
          return (
            <div
              key={row.cargo}
              className="flex items-center gap-2"
              onMouseEnter={(e) => setTip({ content: tooltipContent, x: e.clientX, y: e.clientY })}
              onMouseMove={(e) => setTip((prev) => prev ? { ...prev, x: e.clientX, y: e.clientY } : null)}
              onMouseLeave={() => setTip(null)}
            >
              <span className="w-24 text-xs text-gray-500 shrink-0 text-right">{row.cargo}</span>
              <div className="flex-1 flex h-[18px] rounded overflow-hidden bg-gray-100">
                {JUDICIAL_SEGMENTS.map((s) => (
                  <BarSegment
                    key={s.key}
                    count={row.stateCounts[s.key]}
                    total={row.total}
                    color={s.color}
                    textWhite={s.key !== "limpio" ? String(row.stateCounts[s.key]) : undefined}
                    grayText={s.key === "limpio" ? `${row.stateCounts[s.key]} sin procesos` : undefined}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-3 flex-wrap mt-3">
        {JUDICIAL_SEGMENTS.map((s) => (
          <div key={s.key} className="flex items-center gap-1 text-[10px] text-gray-500">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: s.color }} />
            {s.label}
          </div>
        ))}
      </div>
    </div>
  );
}
