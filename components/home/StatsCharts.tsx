"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";

export interface EduChartRow {
  cargo: string;
  sinEstudios: number;
  tecnico: number;
  universitario: number;
  posgrado: number;
}

export interface ExpChartRow {
  cargo: string;
  publico: number;
  privado: number;
}

export interface ProcesoChartRow {
  cargo: string;
  enCurso: number;
  enApelacion: number;
  archivado: number;
  sinProcesos: number;
}

interface Props {
  edu: EduChartRow[];
  exp: ExpChartRow[];
  procesos: ProcesoChartRow[];
}

const EDU_SEGMENTS = [
  { key: "sinEstudios", label: "Sin estudios sup.", color: "#9ca3af" },
  { key: "tecnico", label: "Técnico", color: "#fbbf24" },
  { key: "universitario", label: "Universitario", color: "#3b82f6" },
  { key: "posgrado", label: "Posgrado", color: "#8b5cf6" },
] as const;

const EXP_SEGMENTS = [
  { key: "publico", label: "Público", color: "#3b82f6" },
  { key: "privado", label: "Privado", color: "#f59e0b" },
] as const;

const PROC_SEGMENTS = [
  { key: "enCurso", label: "En curso", color: "#ef4444" },
  { key: "enApelacion", label: "En apelación", color: "#f59e0b" },
  { key: "archivado", label: "Archivado", color: "#60a5fa" },
  { key: "sinProcesos", label: "Sin procesos", color: "#e5e7eb" },
] as const;

function Legend({
  segments,
}: {
  segments: readonly { key: string; label: string; color: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 justify-center">
      {segments.map((s) => (
        <div key={s.key} className="flex items-center gap-1.5 text-[11px] text-gray-500">
          <div
            className="w-2.5 h-2.5 rounded-sm shrink-0"
            style={{ backgroundColor: s.color }}
          />
          {s.label}
        </div>
      ))}
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      <p className="text-xs text-gray-400 mb-4">{subtitle}</p>
      {children}
    </div>
  );
}

const PCT_TOOLTIP = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; fill: string }[];
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-2.5 text-xs">
      <p className="font-medium text-gray-900 mb-1">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: p.fill }} />
          <span className="text-gray-600">{p.name}:</span>
          <span className="font-medium text-gray-900">{p.value}%</span>
        </div>
      ))}
    </div>
  );
};

export default function StatsCharts({ edu, exp, procesos }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Education */}
      <ChartCard
        title="Nivel educativo máximo"
        subtitle="Por cargo postulado"
      >
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={edu} layout="vertical" margin={{ left: 4, right: 8 }}>
            <XAxis
              type="number"
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 10, fill: "#9ca3af" }}
            />
            <YAxis
              dataKey="cargo"
              type="category"
              width={82}
              tick={{ fontSize: 10, fill: "#6b7280" }}
            />
            <Tooltip content={PCT_TOOLTIP as any} />
            {EDU_SEGMENTS.map((s) => (
              <Bar key={s.key} dataKey={s.key} stackId="a" fill={s.color} name={s.label} />
            ))}
          </BarChart>
        </ResponsiveContainer>
        <Legend segments={EDU_SEGMENTS} />
      </ChartCard>

      {/* Experience */}
      <ChartCard
        title="Experiencia laboral"
        subtitle="Sector público vs privado por cargo"
      >
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={exp} layout="vertical" margin={{ left: 4, right: 8 }}>
            <XAxis
              type="number"
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 10, fill: "#9ca3af" }}
            />
            <YAxis
              dataKey="cargo"
              type="category"
              width={82}
              tick={{ fontSize: 10, fill: "#6b7280" }}
            />
            <Tooltip content={PCT_TOOLTIP as any} />
            {EXP_SEGMENTS.map((s) => (
              <Bar key={s.key} dataKey={s.key} stackId="a" fill={s.color} name={s.label} />
            ))}
          </BarChart>
        </ResponsiveContainer>
        <Legend segments={EXP_SEGMENTS} />
      </ChartCard>

      {/* Procesos */}
      <ChartCard
        title="Procesos judiciales"
        subtitle="Por estado del proceso"
      >
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={procesos} layout="vertical" margin={{ left: 4, right: 8 }}>
            <XAxis
              type="number"
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 10, fill: "#9ca3af" }}
            />
            <YAxis
              dataKey="cargo"
              type="category"
              width={82}
              tick={{ fontSize: 10, fill: "#6b7280" }}
            />
            <Tooltip content={PCT_TOOLTIP as any} />
            {PROC_SEGMENTS.map((s) => (
              <Bar key={s.key} dataKey={s.key} stackId="a" fill={s.color} name={s.label} />
            ))}
          </BarChart>
        </ResponsiveContainer>
        <Legend segments={PROC_SEGMENTS} />
      </ChartCard>
    </div>
  );
}
