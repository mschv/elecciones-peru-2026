"use client";

import { useState, useMemo } from "react";
import type { FormulaSummary, EducationLevel } from "@/lib/supabase/types";
import FormulaFilters from "./FormulaFilters";
import FormulaList from "./FormulaList";
import FormulaDetail from "./FormulaDetail";

export interface FormulaFiltersState {
  preset: "todos" | "sin_procesos" | "con_plan";
  edu_presidente: EducationLevel | "";
  exp_publica: boolean;
}

interface Props {
  formulas: FormulaSummary[];
}

export default function FormulaClient({ formulas }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");
  const [filters, setFilters] = useState<FormulaFiltersState>({
    preset: "todos",
    edu_presidente: "",
    exp_publica: false,
  });

  const filtered = useMemo(() => {
    return formulas.filter((f) => {
      const presidente = f.formula_members.find((m) => m.cargo === "presidente");
      const allMembers = f.formula_members;
      const totalProcesos = allMembers.reduce(
        (acc, m) => acc + m.candidate.procesos_judiciales.length,
        0
      );

      if (filters.preset === "sin_procesos" && totalProcesos > 0) return false;
      if (filters.preset === "con_plan" && (f.partido.plan_gobierno?.length ?? 0) === 0) return false;

      if (filters.edu_presidente && presidente) {
        const EDU_RANK: Record<EducationLevel, number> = {
          sin_estudios: 0, primaria: 1, secundaria: 2, tecnico: 3, universitario: 4, posgrado: 5,
        };
        const presMax = presidente.candidate.education.reduce(
          (acc, e) => Math.max(acc, EDU_RANK[e.nivel] ?? 0),
          0
        );
        const filterRank = EDU_RANK[filters.edu_presidente] ?? 0;
        if (presMax < filterRank) return false;
      }

      if (filters.exp_publica && presidente) {
        const hasPub = presidente.candidate.experience.some((e) => e.sector === "publico");
        if (!hasPub) return false;
      }

      return true;
    });
  }, [formulas, filters]);

  function handleSelect(id: string) {
    setSelectedId(id);
    setMobileView("detail");
  }

  return (
    <div className="flex h-[calc(100svh-57px)] overflow-hidden">
      {/* ── Left panel ── */}
      <div
        className={`flex flex-col w-full md:w-[380px] md:min-w-[380px] border-r border-gray-200 overflow-hidden ${
          mobileView === "detail" ? "hidden md:flex" : "flex"
        }`}
      >
        <FormulaFilters filters={filters} onChange={setFilters} total={formulas.length} filteredCount={filtered.length} />
        <FormulaList
          formulas={filtered}
          selectedId={selectedId}
          onSelect={handleSelect}
        />
      </div>

      {/* ── Right panel ── */}
      <div
        className={`flex-1 overflow-y-auto bg-gray-50 ${
          mobileView === "list" ? "hidden md:block" : "block"
        }`}
      >
        <FormulaDetail
          formulaId={selectedId}
          onBack={() => setMobileView("list")}
        />
      </div>
    </div>
  );
}
