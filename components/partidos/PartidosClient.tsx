"use client";

import { useState, useMemo } from "react";
import type { PartidoSummary } from "@/lib/supabase/types";
import PartyFilters from "./PartyFilters";
import PartyList from "./PartyList";
import PartyDetail from "./PartyDetail";

export interface Filters {
  procesos: "todos" | "sentencia_civil" | "con_activos" | "con_condena";
  participacion: "todos" | "completa" | "solo_congreso";
}

export type ProcesosStats = Record<string, { activos: number; condenas: number; civiles: number }>;

interface Props {
  partidos: PartidoSummary[];
  compromisosCounts: Record<string, number>;
  procesosStats: ProcesosStats;
  formulaNamesByPartido: Record<string, string[]>;
  presidentialByPartido: Record<string, string>;
}

function normalize(s: string) {
  return s.toLowerCase()
    .replace(/[áàäâã]/g, "a").replace(/[éèëê]/g, "e")
    .replace(/[íìïî]/g, "i").replace(/[óòöôõ]/g, "o")
    .replace(/[úùüû]/g, "u").replace(/ñ/g, "n");
}

export default function PartidosClient({ partidos, compromisosCounts, procesosStats, formulaNamesByPartido, presidentialByPartido }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters>({
    procesos: "todos",
    participacion: "todos",
  });

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return partidos.filter((p) => {
      const stats = procesosStats[p.id] ?? { activos: 0, condenas: 0, civiles: 0 };
      if (filters.procesos === "sentencia_civil" && stats.civiles === 0) return false;
      if (filters.procesos === "con_activos"     && stats.activos === 0) return false;
      if (filters.procesos === "con_condena"     && stats.condenas === 0) return false;
      if (filters.participacion === "completa" && !p.has_formula) return false;
      if (filters.participacion === "solo_congreso" && p.has_formula) return false;
      if (q) {
        const name = normalize(p.nombre);
        const short = normalize(p.nombre_corto ?? "");
        const candidates = (formulaNamesByPartido[p.id] ?? []).map(normalize);
        if (!name.includes(q) && !short.includes(q) && !candidates.some((c) => c.includes(q))) return false;
      }
      return true;
    });
  }, [partidos, filters, procesosStats, query, formulaNamesByPartido]);

  function handleSelect(id: string) {
    setSelectedId(id);
    setMobileView("detail");
  }

  return (
    <div className="flex h-[calc(100svh-57px)] overflow-hidden">
      {/* ── Left panel: list ── */}
      <div
        className={`flex flex-col w-full md:w-[380px] md:min-w-[380px] border-r border-gray-200 overflow-hidden ${
          mobileView === "detail" ? "hidden md:flex" : "flex"
        }`}
      >
        <PartyFilters
          total={partidos.length}
          filteredCount={filtered.length}
          filters={filters}
          onChange={setFilters}
          query={query}
          onQueryChange={setQuery}
        />
        <PartyList
          partidos={filtered}
          selectedId={selectedId}
          onSelect={handleSelect}
          compromisosCounts={compromisosCounts}
          procesosStats={procesosStats}
          formulaNamesByPartido={formulaNamesByPartido}
          presidentialByPartido={presidentialByPartido}
        />
      </div>

      {/* ── Right panel: detail ── */}
      <div
        className={`flex-1 overflow-y-auto bg-gray-50 ${
          mobileView === "list" ? "hidden md:block" : "block"
        }`}
      >
        <PartyDetail
          partyId={selectedId}
          onBack={() => setMobileView("list")}
        />
      </div>
    </div>
  );
}
