"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

export interface EduChartRow {
  cargo: string;
  noReporta: number;
  sinEstudios: number;
  primaria: number;
  secundaria: number;
  tecnico: number;
  universitario: number;
  posgrado: number;
  _total: number;
}

export interface ExpChartRow {
  cargo: string;
  soloPublico: number;
  soloPrivado: number;
  mixto: number;
  sinExp: number;
  _total: number;
}

export interface ProcesoSimpleRow {
  cargo: string;
  con: number;
  sin: number;
  _total: number;
}

interface Props {
  edu: EduChartRow[];
  exp: ExpChartRow[];
  activos: ProcesoSimpleRow[];
  civiles: ProcesoSimpleRow[];
  condena: ProcesoSimpleRow[];
}

const AXIS_COLOR = "#6b7280";

const EDU_SEGMENTS = [
  { key: "noReporta",     label: "No reporta",     color: "#d1d5db" },
  { key: "sinEstudios",   label: "Sin estudios",   color: "#3a3a3a" },
  { key: "primaria",      label: "Primaria",        color: "#4b4b4b" },
  { key: "secundaria",    label: "Secundaria",     color: "#606060" },
  { key: "tecnico",       label: "Técnico",        color: "#787878" },
  { key: "universitario", label: "Universitario",  color: "#3b82f6" },
  { key: "posgrado",      label: "Posgrado",       color: "#8b5cf6" },
] as const;

const EXP_SEGMENTS = [
  { key: "soloPublico", label: "Solo público",  color: "#3b82f6" },
  { key: "soloPrivado", label: "Solo privado",  color: "#f59e0b" },
  { key: "mixto",       label: "Mixto",          color: "#10b981" },
  { key: "sinExp",      label: "Sin exp.",       color: "#4b4b4b" },
] as const;

const ACTIVOS_SEGMENTS = [
  { key: "con", label: "Con procesos", color: "#ef4444" },
  { key: "sin", label: "Sin procesos", color: "#d6d0c4" },
] as const;

const CIVILES_SEGMENTS = [
  { key: "con", label: "Con sentencia", color: "#f59e0b" },
  { key: "sin", label: "Sin sentencia", color: "#d6d0c4" },
] as const;

const CONDENA_SEGMENTS = [
  { key: "con", label: "Con condena", color: "#ef4444" },
  { key: "sin", label: "Sin condena", color: "#d6d0c4" },
] as const;

function Legend({ segments }: { segments: readonly { key: string; label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
      {segments.map((s) => (
        <div key={s.key} className="flex items-center gap-1.5 text-[11px] text-gray-500">
          <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: s.color }} />
          {s.label}
        </div>
      ))}
    </div>
  );
}

function DarkCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-5 bg-white border border-gray-100 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
      <p className="text-xs text-gray-500 mb-4">{subtitle}</p>
      {children}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PCT_TOOLTIP = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const total: number = payload[0]?.payload?._total ?? 0;
  return (
    <div className="rounded-lg shadow-lg p-2.5 text-xs border border-gray-200 bg-white">
      <p className="font-medium text-gray-800 mb-1">{label}</p>
      {payload
        .filter((p: { value: number }) => p.value > 0)
        .map((p: { name: string; value: number; fill: string; dataKey: string }) => {
          const count = total ? Math.round((p.value / 100) * total) : null;
          return (
            <div key={p.name} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: p.fill }} />
              <span className="text-gray-500">{p.name}:</span>
              <span className="font-medium text-gray-800">{p.value}%</span>
              {count !== null && (
                <span className="text-gray-400">({count})</span>
              )}
            </div>
          );
        })}
    </div>
  );
};

function StackedChart({
  data,
  segments,
  height,
}: {
  data: Record<string, number | string>[];
  segments: readonly { key: string; label: string; color: string }[];
  height: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 4, right: 12, top: 2, bottom: 2 }}>
        <XAxis
          type="number"
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
          tick={{ fontSize: 10, fill: AXIS_COLOR }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          dataKey="cargo"
          type="category"
          width={72}
          tick={{ fontSize: 10, fill: AXIS_COLOR }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={PCT_TOOLTIP} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
        {segments.map((s) => (
          <Bar key={s.key} dataKey={s.key} stackId="a" fill={s.color} name={s.label} radius={0} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function StatsCharts({ edu, exp, activos, civiles, condena }: Props) {
  const n = edu.length;
  const tallHeight = Math.max(n * 36 + 20, 160);
  const shortHeight = Math.max(n * 32 + 20, 140);

  return (
    <div className="space-y-4">
      {/* Top row: 2 wide charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DarkCard title="Nivel educativo máximo" subtitle="Por cargo postulado">
          <StackedChart data={edu as unknown as Record<string, number | string>[]} segments={EDU_SEGMENTS} height={tallHeight} />
          <Legend segments={EDU_SEGMENTS} />
        </DarkCard>

        <DarkCard title="Experiencia laboral" subtitle="Sector público, privado o mixto">
          <StackedChart data={exp as unknown as Record<string, number | string>[]} segments={EXP_SEGMENTS} height={tallHeight} />
          <Legend segments={EXP_SEGMENTS} />
        </DarkCard>
      </div>

      {/* Bottom row: 3 narrow charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <DarkCard title="Procesos judiciales activos" subtitle="En curso por cargo postulado">
          <StackedChart data={activos as unknown as Record<string, number | string>[]} segments={ACTIVOS_SEGMENTS} height={shortHeight} />
          <Legend segments={ACTIVOS_SEGMENTS} />
        </DarkCard>

        <DarkCard title="Sentencias civiles" subtitle="Registradas por cargo postulado">
          <StackedChart data={civiles as unknown as Record<string, number | string>[]} segments={CIVILES_SEGMENTS} height={shortHeight} />
          <Legend segments={CIVILES_SEGMENTS} />
        </DarkCard>

        <DarkCard title="Condena firme" subtitle="Sentencia ejecutoriada por cargo">
          <StackedChart data={condena as unknown as Record<string, number | string>[]} segments={CONDENA_SEGMENTS} height={shortHeight} />
          <Legend segments={CONDENA_SEGMENTS} />
        </DarkCard>
      </div>
    </div>
  );
}
