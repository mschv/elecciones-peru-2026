"use client";

import { useState } from "react";
import Link from "next/link";

export interface SampleFormula {
  id: string;
  slug: string;
  partidoNombre: string;
  partidoColor: string;
  partidoLogo: string | null;
  presidenteNombre: string;
  presidenteEdu: string;
  activeProcesos: number;
  propuestasCount: number;
}

export interface SamplePartido {
  id: string;
  slug: string;
  nombre: string;
  nombreCorto: string | null;
  color: string;
  logo: string | null;
  totalCandidatos: number;
  conSentencia: number;
  propuestasCount: number;
}

export interface SampleCongresista {
  id: string;
  slug: string;
  nombre: string;
  partidoNombre: string;
  partidoColor: string;
  region: string | null;
  cargo: string;
  educacion: string;
  procesos: number;
}

interface Props {
  formulas: SampleFormula[];
  partidos: SamplePartido[];
  congresistas: SampleCongresista[];
}

const TABS = [
  { key: "formulas", label: "Fórmulas presidenciales" },
  { key: "congresistas", label: "Diputados" },
  { key: "partidos", label: "Partidos" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function getInitials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function FormulaCard({ f }: { f: SampleFormula }) {
  const color = f.partidoColor || "#6b7280";
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3 flex-1">
      <div className="flex items-center gap-3">
        {f.partidoLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={f.partidoLogo}
            alt=""
            className="w-10 h-10 rounded-lg object-contain bg-gray-50 shrink-0"
          />
        ) : (
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
            style={{ backgroundColor: color }}
          >
            {getInitials(f.partidoNombre)}
          </div>
        )}
        <div>
          <p className="text-sm font-semibold text-gray-900 leading-tight">{f.partidoNombre}</p>
          <p className="text-xs text-gray-400">Fórmula Presidencial</p>
        </div>
      </div>
      <div className="border-t border-gray-100 pt-3 space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">Presidente</span>
          <span className="font-medium text-gray-800 truncate max-w-[140px]">
            {f.presidenteNombre}
          </span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">Educación</span>
          <span className="font-medium text-gray-800">{f.presidenteEdu}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">Procesos activos</span>
          <span
            className={`font-medium ${
              f.activeProcesos > 0 ? "text-red-600" : "text-green-600"
            }`}
          >
            {f.activeProcesos > 0 ? `⚠ ${f.activeProcesos}` : "✓ Ninguno"}
          </span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">Compromisos</span>
          <span className="font-medium text-gray-800">{f.propuestasCount}</span>
        </div>
      </div>
    </div>
  );
}

function PartidoCard({ p }: { p: SamplePartido }) {
  const color = p.color || "#6b7280";
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3 flex-1">
      <div className="flex items-center gap-3">
        {p.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.logo}
            alt=""
            className="w-10 h-10 rounded-lg object-contain bg-gray-50 shrink-0"
          />
        ) : (
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
            style={{ backgroundColor: color }}
          >
            {getInitials(p.nombreCorto ?? p.nombre)}
          </div>
        )}
        <div>
          <p className="text-sm font-semibold text-gray-900 leading-tight">
            {p.nombreCorto ?? p.nombre}
          </p>
          <p className="text-xs text-gray-400">Partido político</p>
        </div>
      </div>
      <div className="border-t border-gray-100 pt-3 space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">Candidatos</span>
          <span className="font-medium text-gray-800">{p.totalCandidatos}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">Con sentencia</span>
          <span
            className={`font-medium ${
              p.conSentencia > 0 ? "text-red-600" : "text-green-600"
            }`}
          >
            {p.conSentencia > 0 ? `⚠ ${p.conSentencia}` : "✓ Ninguno"}
          </span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">Compromisos</span>
          <span className="font-medium text-gray-800">{p.propuestasCount}</span>
        </div>
      </div>
    </div>
  );
}

function CongresistaCard({ c }: { c: SampleCongresista }) {
  const color = c.partidoColor || "#6b7280";
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3 flex-1">
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
          style={{ backgroundColor: color }}
        >
          {getInitials(c.nombre)}
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900 leading-tight">{c.nombre}</p>
          <p className="text-xs text-gray-400 truncate max-w-[140px]">{c.partidoNombre}</p>
        </div>
      </div>
      <div className="border-t border-gray-100 pt-3 space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">Cargo</span>
          <span className="font-medium text-gray-800 capitalize">{c.cargo}</span>
        </div>
        {c.region && (
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Región</span>
            <span className="font-medium text-gray-800">{c.region}</span>
          </div>
        )}
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">Educación</span>
          <span className="font-medium text-gray-800">{c.educacion}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">Procesos</span>
          <span
            className={`font-medium ${
              c.procesos > 0 ? "text-red-600" : "text-green-600"
            }`}
          >
            {c.procesos > 0 ? `⚠ ${c.procesos}` : "✓ Ninguno"}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function QuickCompare({ formulas, partidos, congresistas }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>("formulas");

  const compareUrl =
    activeTab === "formulas"
      ? `/comparar?type=formulas`
      : activeTab === "partidos"
      ? `/comparar?type=partidos`
      : `/comparar?type=congresistas`;

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-0 border-b border-gray-200 mb-4 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab.key === activeTab
                ? "border-[#e53935] text-[#e53935]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Cards */}
      <div className="flex gap-4">
        {activeTab === "formulas" &&
          formulas.map((f) => <FormulaCard key={f.id} f={f} />)}
        {activeTab === "partidos" &&
          partidos.map((p) => <PartidoCard key={p.id} p={p} />)}
        {activeTab === "congresistas" &&
          congresistas.map((c) => <CongresistaCard key={c.id} c={c} />)}

        {/* Fallback if empty */}
        {((activeTab === "formulas" && formulas.length === 0) ||
          (activeTab === "partidos" && partidos.length === 0) ||
          (activeTab === "congresistas" && congresistas.length === 0)) && (
          <p className="text-sm text-gray-400 py-8">Sin datos disponibles.</p>
        )}
      </div>

      <div className="mt-4">
        <Link
          href={compareUrl}
          className="inline-flex items-center gap-1.5 text-sm text-[#e53935] hover:underline font-medium"
        >
          Ver comparación completa →
        </Link>
      </div>
    </div>
  );
}
