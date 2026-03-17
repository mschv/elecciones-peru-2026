"use client";

import { useState, useMemo } from "react";
import type { CongresoMember, CargoType } from "@/lib/supabase/types";
import CandidateFilters from "./CandidateFilters";
import CandidateList from "./CandidateList";
import CandidateProfilePanel from "./CandidateProfilePanel";

export interface CongresoFilters {
  procesos: "todos" | "sentencia_civil" | "con_activos" | "con_condena";
  educacion: string;
  incumbente: "todos" | "si" | "no";
  region: string;
  partido: string;
  search: string;
}

interface Props {
  members: CongresoMember[];
  cargo: CargoType;
  initialPartido?: string;
}

export default function CongresoClient({ members, cargo, initialPartido }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");
  const [filters, setFilters] = useState<CongresoFilters>({
    procesos: "todos",
    educacion: "",
    incumbente: "todos",
    region: "",
    partido: initialPartido ?? "",
    search: "",
  });

  const filtered = useMemo(() => {
    return members.filter((m) => {
      if (filters.incumbente === "si"  && !m.is_incumbent) return false;
      if (filters.incumbente === "no"  &&  m.is_incumbent) return false;
      if (filters.educacion) {
        const levels = m.candidate.education.map((e) => e.nivel);
        if (!levels.includes(filters.educacion as any)) return false;
      }
      if (filters.procesos !== "todos") {
        const statuses = m.candidate.procesos_judiciales.map((p) => p.status);
        const hasCivil   = statuses.some((s) => s === "sentencia_civil");
        const hasActivo  = statuses.some((s) => ["en_curso", "en_apelacion"].includes(s));
        const hasCondena = statuses.some((s) => ["sentencia_condenatoria", "sentencia_firme", "pena_cumplida"].includes(s));
        if (filters.procesos === "sentencia_civil" && !hasCivil)   return false;
        if (filters.procesos === "con_activos"     && !hasActivo)  return false;
        if (filters.procesos === "con_condena"     && !hasCondena) return false;
      }
      if (filters.region === "__unico__"   && m.region !== null)  return false;
      if (filters.region === "__multiple__" && m.region === null)  return false;
      if (filters.region && !["__unico__", "__multiple__"].includes(filters.region) && m.region !== filters.region) return false;
      if (filters.partido && m.formula.partido.id !== filters.partido) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const fullName = `${m.candidate.nombres} ${m.candidate.apellidos}`.toLowerCase();
        if (!fullName.includes(q)) return false;
      }
      return true;
    });
  }, [members, filters]);

  function handleSelect(id: string) {
    setSelectedId(id);
    setMobileView("detail");
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel */}
      <div
        className={`flex flex-col w-full md:w-[380px] md:min-w-[380px] border-r border-gray-200 overflow-hidden ${
          mobileView === "detail" ? "hidden md:flex" : "flex"
        }`}
      >
        <CandidateFilters
          members={members}
          cargo={cargo}
          filters={filters}
          onChange={setFilters}
          filteredCount={filtered.length}
        />
        <CandidateList
          members={filtered}
          selectedId={selectedId}
          onSelect={handleSelect}
        />
      </div>

      {/* Right panel */}
      <div
        className={`flex-1 overflow-y-auto bg-gray-50 ${
          mobileView === "list" ? "hidden md:block" : "block"
        }`}
      >
        <CandidateProfilePanel
          candidateId={selectedId}
          onBack={() => setMobileView("list")}
        />
      </div>
    </div>
  );
}
