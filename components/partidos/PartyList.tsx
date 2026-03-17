"use client";

import type { PartidoSummary } from "@/lib/supabase/types";
import type { ProcesosStats } from "./PartidosClient";
import PartyCard from "./PartyCard";

interface Props {
  partidos: PartidoSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  compromisosCounts: Record<string, number>;
  procesosStats: ProcesosStats;
  formulaNamesByPartido: Record<string, string[]>;
  presidentialByPartido: Record<string, string>;
}

export default function PartyList({ partidos, selectedId, onSelect, compromisosCounts, procesosStats, formulaNamesByPartido, presidentialByPartido }: Props) {
  if (partidos.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-gray-400 p-6 text-center">
        No se encontraron partidos con esos filtros.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      {partidos.map((partido) => (
        <PartyCard
          key={partido.id}
          partido={partido}
          selected={partido.id === selectedId}
          onClick={() => onSelect(partido.id)}
          compromisosCount={compromisosCounts[partido.id] ?? 0}
          procesosStats={procesosStats[partido.id] ?? { activos: 0, condenas: 0 }}
          candidateNames={formulaNamesByPartido[partido.id]}
          presidentialName={presidentialByPartido[partido.id]}
        />
      ))}
    </div>
  );
}
