"use client";

import type { PartidoSummary } from "@/lib/supabase/types";

interface Props {
  partido: PartidoSummary;
  selected: boolean;
  onClick: () => void;
  compromisosCount: number;
  procesosStats: { activos: number; condenas: number };
  candidateNames?: string[];
  presidentialName?: string;
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

export default function PartyCard({ partido, selected, onClick, compromisosCount, procesosStats, candidateNames, presidentialName }: Props) {
  const color = partido.color_hex || "#6b7280";
  const { activos, condenas } = procesosStats;

  let procesosBadge: React.ReactNode;
  if (activos > 0) {
    procesosBadge = (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700">
        {activos} con procesos activos
      </span>
    );
  } else if (condenas > 0) {
    procesosBadge = (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700">
        {condenas} con condena firme
      </span>
    );
  } else {
    procesosBadge = (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700">
        Sin procesos activos
      </span>
    );
  }

  return (
    <button
      onClick={onClick}
      title={partido.nombre}
      className={`w-full text-left flex items-center gap-3 pl-8 pr-3 py-3 border-b border-gray-100 transition-colors hover:bg-gray-50 ${
        selected ? "bg-gray-50 hover:bg-gray-50" : ""
      }`}
    >
      {/* Logo or initials */}
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

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div
          className="font-medium text-gray-900 leading-snug"
          style={{ fontSize: 13, lineHeight: 1.3 }}
          title={partido.nombre}
        >
          {partido.nombre}
        </div>
        {presidentialName && (
          <div className="text-[11px] text-gray-400 mt-0.5 leading-tight truncate">
            {presidentialName}
          </div>
        )}
        <div className="flex gap-1.5 mt-1 flex-wrap">
          {procesosBadge}
          {compromisosCount > 0 ? (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600">
              {compromisosCount} compromisos
            </span>
          ) : (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium text-gray-400">
              Sin plan de gobierno
            </span>
          )}
        </div>
      </div>

      {/* Chevron */}
      <span className="text-gray-300 text-xs shrink-0">›</span>
    </button>
  );
}
