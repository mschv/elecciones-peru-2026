"use client";

import type { CongresoMember } from "@/lib/supabase/types";

interface Props {
  member: CongresoMember;
  selected: boolean;
  onClick: () => void;
}

function InitialsSquare({ name, color }: { name: string; color: string }) {
  const initials = name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <div
      className="w-11 h-11 rounded-lg flex items-center justify-center text-white text-[11px] font-medium shrink-0 select-none"
      style={{ backgroundColor: color }}
    >
      {initials}
    </div>
  );
}

export default function CandidateCard({ member, selected, onClick }: Props) {
  const { candidate, formula, region, is_incumbent, is_first_time } = member;
  const partido = formula.partido;
  const color = partido.color_hex ?? "#6b7280";
  const fullName = `${candidate.nombres} ${candidate.apellidos}`;
  const statuses = candidate.procesos_judiciales.map((p) => p.status);
  const hasActivo  = statuses.some((s) => ["en_curso", "en_apelacion"].includes(s));
  const hasCondena = statuses.some((s) => ["sentencia_condenatoria", "sentencia_firme", "pena_cumplida"].includes(s));
  const hasCivil   = statuses.some((s) => s === "sentencia_civil");
  const isClean    = statuses.length === 0;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-center gap-3 pl-8 pr-3 py-3 border-b border-gray-100 transition-colors hover:bg-gray-50 ${
        selected ? "bg-gray-50 hover:bg-gray-50" : ""
      }`}
    >
      {partido.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={partido.logo_url}
          alt=""
          className="w-11 h-11 rounded-lg object-contain shrink-0 bg-white p-1"
          style={{ border: "0.5px solid #e5e7eb" }}
        />
      ) : (
        <InitialsSquare name={partido.nombre_corto ?? partido.nombre} color={color} />
      )}

      <div className="flex-1 min-w-0">
        <div
          className="font-medium text-gray-900 leading-snug truncate"
          style={{ fontSize: 13, lineHeight: 1.3 }}
        >
          {fullName}
        </div>
        <div className="text-[11px] text-gray-500 truncate">
          {[region, partido.nombre_corto ?? partido.nombre].filter(Boolean).join(" · ")}
        </div>
        <div className="flex gap-1 mt-1 flex-wrap">
          {is_incumbent && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700">
              En ejercicio
            </span>
          )}
          {is_first_time && !is_incumbent && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700">
              Primera vez
            </span>
          )}
          {hasCondena && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700">
              Condena firme
            </span>
          )}
          {hasActivo && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700">
              Proceso penal
            </span>
          )}
          {hasCivil && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-100 text-orange-700">
              Sentencia civil
            </span>
          )}
          {isClean && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700">
              Sin sentencias
            </span>
          )}
        </div>
      </div>

      <span className="text-gray-300 text-xs shrink-0">›</span>
    </button>
  );
}
