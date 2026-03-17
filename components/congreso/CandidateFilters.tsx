"use client";

import { useState, useRef, useEffect } from "react";
import type { CongresoMember, CargoType } from "@/lib/supabase/types";
import type { CongresoFilters } from "./CongresoClient";

interface Props {
  members: CongresoMember[];
  cargo: CargoType;
  filters: CongresoFilters;
  onChange: (f: CongresoFilters) => void;
  filteredCount: number;
}

const EDUCACION_OPTIONS: { value: string; label: string }[] = [
  { value: "",              label: "Educación" },
  { value: "posgrado",      label: "Posgrado" },
  { value: "universitario", label: "Universitario" },
  { value: "tecnico",       label: "Técnico" },
  { value: "secundaria",    label: "Secundaria" },
  { value: "primaria",      label: "Primaria" },
  { value: "sin_estudios",  label: "Sin estudios" },
];

const INCUMBENTE_OPTIONS: { value: CongresoFilters["incumbente"]; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "si",    label: "Sí" },
  { value: "no",    label: "No" },
];

const PROCESOS_OPTIONS: { value: CongresoFilters["procesos"]; label: string }[] = [
  { value: "todos",          label: "Todos" },
  { value: "sentencia_civil", label: "Sentencia civil" },
  { value: "con_activos",    label: "Procesos penales activos" },
  { value: "con_condena",    label: "Condena firme" },
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
  const active = value !== "" && value !== "todos";
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
        className={`flex items-center gap-1 px-2.5 py-[4px] rounded-full text-[11px] transition-colors whitespace-nowrap ${
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
              className={`w-full text-left px-3 py-1.5 text-[11px] hover:bg-gray-50 transition-colors ${
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

export default function CandidateFilters({ members, cargo, filters, onChange, filteredCount }: Props) {
  const isSenado = cargo === "senador";
  const regions = Array.from(new Set(members.map((m) => m.region).filter(Boolean))) as string[];
  const partidos = Array.from(
    new Map(members.map((m) => [m.formula.partido.id, m.formula.partido])).values()
  ).sort((a, b) => (a.nombre_corto ?? a.nombre).localeCompare(b.nombre_corto ?? b.nombre));

  const regionOptions: { value: string; label: string }[] = [
    { value: "", label: isSenado ? "Tipo de distrito" : "Región" },
    ...(isSenado
      ? [
          { value: "__unico__", label: "Distrito Único" },
          { value: "__multiple__", label: "Distrito Múltiple" },
        ]
      : regions.map((r) => ({ value: r, label: r }))),
  ];

  const partidoOptions: { value: string; label: string }[] = [
    { value: "", label: "Partido" },
    ...partidos.map((p) => ({ value: p.id, label: p.nombre_corto ?? p.nombre })),
  ];

  const allActive = filters.procesos === "todos" && filters.educacion === "" && filters.incumbente === "todos" && filters.region === "" && filters.partido === "";

  return (
    <div className="border-b border-gray-200 pl-8 pr-4 py-2.5 bg-white shrink-0 space-y-2">
      {/* Filter row */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => onChange({ ...filters, procesos: "todos", educacion: "", incumbente: "todos", region: "", partido: "" })}
          className={`shrink-0 px-2.5 py-[4px] rounded-full text-[11px] font-medium transition-colors ${
            allActive
              ? "bg-[#B31B1B] text-white"
              : "border border-gray-300 text-gray-500 hover:border-gray-400"
          }`}
        >
          Todos ({filteredCount})
        </button>

        <Dropdown
          label="Partido"
          value={filters.partido}
          options={partidoOptions}
          onChange={(v) => onChange({ ...filters, partido: v })}
        />

        <Dropdown
          label={isSenado ? "Tipo de distrito" : "Región"}
          value={filters.region}
          options={regionOptions}
          onChange={(v) => onChange({ ...filters, region: v })}
        />

        <Dropdown
          label="Procesos"
          value={filters.procesos}
          options={PROCESOS_OPTIONS}
          onChange={(v) => onChange({ ...filters, procesos: v })}
        />

        <Dropdown
          label="Congreso 2021-25"
          value={filters.incumbente}
          options={INCUMBENTE_OPTIONS}
          onChange={(v) => onChange({ ...filters, incumbente: v })}
        />

        <Dropdown
          label="Educación"
          value={filters.educacion}
          options={EDUCACION_OPTIONS}
          onChange={(v) => onChange({ ...filters, educacion: v })}
        />
      </div>

      {/* Search */}
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
          placeholder="Buscar candidato"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-gray-300 placeholder:text-gray-400"
        />
      </div>

      {(!allActive || filters.search) && (
        <p className="text-[11px] text-gray-400">
          Mostrando {filteredCount} de {members.length} candidatos
        </p>
      )}
    </div>
  );
}
