"use client";

import type { FormulaFiltersState } from "./FormulaClient";

interface Props {
  filters: FormulaFiltersState;
  onChange: (f: FormulaFiltersState) => void;
  total: number;
  filteredCount: number;
}

export default function FormulaFilters({ filters, onChange, total, filteredCount }: Props) {
  return (
    <div className="border-b border-gray-200 px-3 py-2.5 space-y-2 bg-white shrink-0">
      {/* Quick presets */}
      <div className="flex gap-1 flex-wrap">
        {(["todos", "sin_procesos", "con_plan"] as const).map((preset) => (
          <button
            key={preset}
            onClick={() => onChange({ ...filters, preset })}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
              filters.preset === preset
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {preset === "todos" && `Todos (${filteredCount})`}
            {preset === "sin_procesos" && "Sin procesos"}
            {preset === "con_plan" && "Con plan de gobierno"}
          </button>
        ))}
      </div>

      {/* Dropdowns + toggle */}
      <div className="flex gap-2 items-center">
        <select
          value={filters.edu_presidente}
          onChange={(e) =>
            onChange({ ...filters, edu_presidente: e.target.value as FormulaFiltersState["edu_presidente"] })
          }
          className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-400"
        >
          <option value="">Educación (Presidente)</option>
          <option value="tecnico">Técnico o más</option>
          <option value="universitario">Universitario o más</option>
          <option value="posgrado">Posgrado</option>
        </select>

        <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={filters.exp_publica}
            onChange={(e) => onChange({ ...filters, exp_publica: e.target.checked })}
            className="rounded border-gray-300"
          />
          Exp. pública
        </label>
      </div>
    </div>
  );
}
