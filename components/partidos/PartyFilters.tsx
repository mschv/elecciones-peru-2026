"use client";

import { useState, useRef, useEffect } from "react";
import type { Filters } from "./PartidosClient";

interface Props {
  total: number;
  filteredCount: number;
  filters: Filters;
  onChange: (f: Filters) => void;
  query: string;
  onQueryChange: (q: string) => void;
}

const PROCESOS_OPTIONS: { value: Filters["procesos"]; label: string }[] = [
  { value: "todos",          label: "Todos" },
  { value: "sentencia_civil", label: "Sentencia civil" },
  { value: "con_activos",    label: "Procesos penales activos" },
  { value: "con_condena",    label: "Condena firme" },
];

const PARTICIPACION_OPTIONS: { value: Filters["participacion"]; label: string }[] = [
  { value: "todos",        label: "Todos" },
  { value: "completa",     label: "Participación completa" },
  { value: "solo_congreso", label: "Solo Congreso" },
];

function Dropdown<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = value !== "todos";
  const selectedLabel = options.find((o) => o.value === value)?.label ?? label;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1 px-3 py-[5px] rounded-full text-[12px] transition-colors whitespace-nowrap ${
          active
            ? "border-[1.5px] border-[#e53935] text-gray-900 bg-white font-medium"
            : "border border-gray-300 text-gray-500 bg-white hover:border-gray-400"
        }`}
      >
        {active ? selectedLabel : label}
        <span className="text-[10px] opacity-60">▾</span>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 min-w-[180px]">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-gray-50 transition-colors ${
                value === opt.value ? "text-[#e53935] font-medium" : "text-gray-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PartyFilters({ total, filteredCount, filters, onChange, query, onQueryChange }: Props) {
  const allActive = filters.procesos === "todos" && filters.participacion === "todos";

  return (
    <div className="border-b border-gray-200 pl-8 pr-4 py-2.5 bg-white shrink-0 space-y-2">
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange({ procesos: "todos", participacion: "todos" })}
          className={`shrink-0 px-3 py-[5px] rounded-full text-[12px] font-medium transition-colors ${
            allActive
              ? "bg-[#B31B1B] text-white"
              : "border border-gray-300 text-gray-500 hover:border-gray-400"
          }`}
        >
          Todos ({filteredCount})
        </button>

        <Dropdown
          label="Procesos"
          value={filters.procesos}
          options={PROCESOS_OPTIONS}
          onChange={(v) => onChange({ ...filters, procesos: v })}
        />

        <Dropdown
          label="Participación"
          value={filters.participacion}
          options={PARTICIPACION_OPTIONS}
          onChange={(v) => onChange({ ...filters, participacion: v })}
        />
      </div>

      <div className="relative">
        <svg
          className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <circle cx="11" cy="11" r="8" />
          <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="text"
          placeholder="Buscar partido o candidato"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-gray-300 placeholder:text-gray-400"
        />
      </div>

      {(!allActive || query) && (
        <p className="text-[11px] text-gray-400">
          Mostrando {filteredCount} de {total} partidos
        </p>
      )}
    </div>
  );
}
