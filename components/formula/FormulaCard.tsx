"use client";

import type { FormulaSummary, EducationLevel } from "@/lib/supabase/types";

const EDU_LEVEL_LABELS: Record<EducationLevel, string> = {
  sin_estudios: "Sin estudios",
  primaria: "Primaria",
  secundaria: "Secundaria",
  tecnico: "Técnico",
  universitario: "Universitario",
  posgrado: "Posgrado",
};

const EDU_RANK: Record<EducationLevel, number> = {
  sin_estudios: 0, primaria: 1, secundaria: 2, tecnico: 3, universitario: 4, posgrado: 5,
};

interface Props {
  formula: FormulaSummary;
  selected: boolean;
  onClick: () => void;
}

function InitialsSquare({ name, color }: { name: string; color: string }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <div
      className="w-11 h-11 rounded-lg flex items-center justify-center text-white text-[11px] font-medium shrink-0 select-none"
      style={{ backgroundColor: color }}
    >
      {initials}
    </div>
  );
}

export default function FormulaCard({ formula, selected, onClick }: Props) {
  const color = formula.partido.color_hex ?? "#6b7280";
  const presidente = formula.formula_members.find((m) => m.cargo === "presidente");
  const totalProcesos = formula.formula_members.reduce(
    (acc, m) => acc + m.candidate.procesos_judiciales.length,
    0
  );
  const propuestasCount = formula.partido.plan_gobierno?.length ?? 0;
  const presEdu = presidente?.candidate.education ?? [];
  const topEdu = presEdu.length
    ? presEdu.reduce((best, e) =>
        (EDU_RANK[e.nivel] ?? 0) > (EDU_RANK[best.nivel] ?? 0) ? e : best
      )
    : null;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-center gap-3 px-3 py-3 border-b border-gray-100 transition-colors hover:bg-gray-50 ${
        selected ? "bg-gray-50 hover:bg-gray-50" : ""
      }`}
      style={{
        borderLeftWidth: 4,
        borderLeftColor: color,
        borderLeftStyle: "solid",
      }}
    >
      {formula.partido.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={formula.partido.logo_url}
          alt=""
          className="w-11 h-11 rounded-lg object-contain shrink-0 bg-white p-1"
          style={{ border: "0.5px solid #e5e7eb" }}
        />
      ) : (
        <InitialsSquare name={formula.partido.nombre_corto ?? formula.partido.nombre} color={color} />
      )}

      <div className="flex-1 min-w-0">
        <div
          className="font-medium text-gray-900 leading-snug truncate"
          style={{ fontSize: 13, lineHeight: 1.3 }}
        >
          {formula.partido.nombre_corto ?? formula.partido.nombre}
        </div>
        {presidente && (
          <div className="text-xs text-gray-500 truncate">
            {presidente.candidate.nombres} {presidente.candidate.apellidos}
          </div>
        )}
        <div className="flex gap-1.5 mt-1 flex-wrap">
          {totalProcesos === 0 && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700">
              Sin sentencias
            </span>
          )}
          {topEdu && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700">
              {EDU_LEVEL_LABELS[topEdu.nivel]}
            </span>
          )}
          {propuestasCount > 0 && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700">
              {propuestasCount} compromisos
            </span>
          )}
          {formula.numero_lista && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500">
              Lista {formula.numero_lista}
            </span>
          )}
        </div>
      </div>

      <span className="text-gray-300 text-xs shrink-0">›</span>
    </button>
  );
}
