"use client";

import { useRouter } from "next/navigation";
import { useCompareStore } from "@/lib/store/compareStore";

const TYPE_URL: Record<string, string> = {
  partido: "partidos",
  formula: "formulas",
  candidato: "congresistas",
};

export default function CompareTray() {
  const { items, removeItem, clearAll } = useCompareStore();
  const router = useRouter();

  if (items.length === 0) return null;

  const canCompare = items.length >= 2;
  const urlType = TYPE_URL[items[0]?.type] ?? "formulas";

  function handleCompare() {
    const ids = items.map((i) => i.id).join(",");
    router.push(`/comparar?type=${urlType}&ids=${ids}`);
  }

  const SLOTS = [0, 1, 2] as const;

  return (
    <div className="fixed bottom-16 md:bottom-0 left-0 right-0 z-40 pointer-events-none">
      <div className="max-w-5xl mx-auto px-4 pb-3 md:pb-4">
        <div className="pointer-events-auto bg-[#111111] border border-gray-700 rounded-xl shadow-2xl p-3 flex items-center gap-3">
          {/* Slots */}
          <div className="flex gap-2 flex-1 min-w-0">
            {SLOTS.map((i) => {
              const item = items[i];
              if (item) {
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-1.5 bg-gray-800 rounded-lg px-2.5 py-1.5 min-w-0"
                  >
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] font-bold shrink-0"
                      style={{ backgroundColor: item.color }}
                    >
                      {item.initials}
                    </div>
                    <span className="text-xs text-gray-100 truncate max-w-[72px]">
                      {item.name}
                    </span>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="ml-0.5 text-gray-500 hover:text-white text-xs shrink-0 leading-none"
                      aria-label="Quitar"
                    >
                      ✕
                    </button>
                  </div>
                );
              }
              return (
                <div
                  key={`empty-${i}`}
                  className="flex items-center justify-center w-9 h-8 rounded-lg border border-dashed border-gray-600 text-gray-600 text-base shrink-0"
                >
                  +
                </div>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {!canCompare && (
              <span className="text-[11px] text-gray-500 hidden sm:block whitespace-nowrap">
                Selecciona al menos 2
              </span>
            )}
            <button
              onClick={handleCompare}
              disabled={!canCompare}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed bg-[#e53935] hover:bg-red-700 text-white"
            >
              Comparar →
            </button>
            <button
              onClick={clearAll}
              className="text-gray-600 hover:text-gray-200 text-xs px-1 transition-colors"
              aria-label="Limpiar selección"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
