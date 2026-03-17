"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCompareStore } from "@/lib/store/compareStore";
import CompareTable, { type CompareTableData } from "./CompareTable";
import type { PartidoDetail, FormulaFull, CongresoMemberFull } from "@/lib/supabase/types";

interface Props {
  type: string;
  ids: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[];
}

const TABS = [
  { key: "formulas", label: "Fórmulas" },
  { key: "congresistas", label: "Diputados" },
  { key: "partidos", label: "Partidos" },
  { key: "plan_gobierno", label: "Plan de Gobierno" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function CompareClient({ type, ids, data }: Props) {
  const router = useRouter();
  const { clearAll } = useCompareStore();
  const [copied, setCopied] = useState(false);

  const activeTab = (TABS.find((t) => t.key === type)?.key ?? "formulas") as TabKey;

  function handleTabChange(tab: TabKey) {
    if (tab === activeTab) return;
    clearAll();
    router.push(`/comparar?type=${tab}`);
  }

  function handleShare() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  let tableData: CompareTableData | null = null;
  if (data.length > 0) {
    if (activeTab === "partidos")
      tableData = { type: "partidos", items: data as PartidoDetail[] };
    else if (activeTab === "formulas")
      tableData = { type: "formulas", items: data as FormulaFull[] };
    else if (activeTab === "congresistas")
      tableData = { type: "congresistas", items: data as CongresoMemberFull[] };
    else if (activeTab === "plan_gobierno")
      tableData = { type: "plan_gobierno", items: data as FormulaFull[] };
  }

  const activeTabLabel = TABS.find((t) => t.key === activeTab)?.label ?? "";

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#faf9f7" }}>
      {/* Sticky tab bar */}
      <div className="bg-white border-b border-gray-200 sticky top-[57px] z-30">
        <div className="max-w-6xl mx-auto px-4 flex items-center">
          <div className="flex overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  tab.key === activeTab
                    ? "border-[#e53935] text-[#e53935]"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="ml-auto pl-4 py-2 shrink-0">
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-medium text-gray-700 transition-colors"
            >
              {copied ? "Copiado" : "Compartir"}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {ids.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
            <span className="text-5xl text-gray-300">—</span>
            <h1 className="text-xl font-bold text-gray-900">Comparar {activeTabLabel}</h1>
            <p className="text-sm text-gray-500 max-w-xs">
              Usa el botón{" "}
              <span className="font-medium text-gray-700">&ldquo;+ Comparar&rdquo;</span> en las
              páginas de {activeTabLabel.toLowerCase()} para agregar hasta 3 ítems al comparador.
            </p>
          </div>
        ) : tableData ? (
          <CompareTable data={tableData} />
        ) : (
          <div className="flex items-center justify-center py-24 text-gray-400 text-sm">
            No se pudo cargar la comparación.
          </div>
        )}
      </div>
    </div>
  );
}
