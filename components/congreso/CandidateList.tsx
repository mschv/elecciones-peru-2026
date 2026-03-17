"use client";

import { useState, useEffect } from "react";
import type { CongresoMember } from "@/lib/supabase/types";
import CandidateCard from "./CandidateCard";

const PAGE_SIZE = 150;

interface Props {
  members: CongresoMember[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function CandidateList({ members, selectedId, onSelect }: Props) {
  const [visible, setVisible] = useState(PAGE_SIZE);

  useEffect(() => { setVisible(PAGE_SIZE); }, [members]);

  const displayed = members.slice(0, visible);

  if (members.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-gray-400 p-6 text-center">
        No se encontraron candidatos con esos filtros.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      {displayed.map((member) => (
        <CandidateCard
          key={member.candidate.id}
          member={member}
          selected={member.candidate.id === selectedId}
          onClick={() => onSelect(member.candidate.id)}
        />
      ))}
      {visible < members.length && (
        <button
          onClick={() => setVisible((v) => v + PAGE_SIZE)}
          className="w-full py-3 text-xs text-gray-500 hover:text-gray-800 hover:bg-gray-50 border-t border-gray-100 transition-colors"
        >
          Cargar más ({members.length - visible} restantes)
        </button>
      )}
    </div>
  );
}
