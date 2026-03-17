"use client";

import type { FormulaSummary } from "@/lib/supabase/types";
import FormulaCard from "./FormulaCard";

interface Props {
  formulas: FormulaSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function FormulaList({ formulas, selectedId, onSelect }: Props) {
  if (formulas.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-gray-400 p-6 text-center">
        No se encontraron fórmulas con esos filtros.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      {formulas.map((formula) => (
        <FormulaCard
          key={formula.id}
          formula={formula}
          selected={formula.id === selectedId}
          onClick={() => onSelect(formula.id)}
        />
      ))}
    </div>
  );
}
