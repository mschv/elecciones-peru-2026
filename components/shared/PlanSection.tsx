"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import type { ReactNode } from "react";
import type { PlanEje, PlanGobiernoSlim } from "@/lib/supabase/types";
import { countGroupedProposals } from "@/lib/utils/compromisos";

// ─── EJE constants ────────────────────────────────────────────────────────────

export const EJE_LABELS: Record<PlanEje, string> = {
  social: "Social",
  economico: "Económico",
  economia: "Económico",
  ambiental: "Ambiental",
  medio_ambiente: "Ambiental",
  institucional: "Institucional",
  salud: "Salud",
  educacion_eje: "Educación",
  seguridad: "Seguridad",
  infraestructura: "Infraestructura",
  otro: "Otro",
};

export const EJE_ORDER: PlanEje[] = [
  "social", "economico", "economia", "ambiental", "medio_ambiente",
  "institucional", "salud", "educacion_eje", "seguridad", "infraestructura", "otro",
];

// ─── Search helpers ───────────────────────────────────────────────────────────

function normalizeForSearch(str: string): string {
  return str
    .toLowerCase()
    .replace(/[áàäâã]/g, "a")
    .replace(/[éèëê]/g, "e")
    .replace(/[íìïî]/g, "i")
    .replace(/[óòöôõ]/g, "o")
    .replace(/[úùüû]/g, "u")
    .replace(/ñ/g, "n");
}

function highlightText(text: string, normalizedQuery: string): ReactNode {
  if (!normalizedQuery || !text) return text;
  const normalizedText = normalizeForSearch(text);
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let pos = 0;
  while (pos <= normalizedText.length - normalizedQuery.length) {
    const idx = normalizedText.indexOf(normalizedQuery, pos);
    if (idx === -1) break;
    if (idx > lastIndex) parts.push(text.slice(lastIndex, idx));
    parts.push(
      <mark
        key={idx}
        style={{
          backgroundColor: "#FFF176",
          color: "#333",
          borderRadius: 2,
          padding: "0 2px",
        }}
      >
        {text.slice(idx, idx + normalizedQuery.length)}
      </mark>
    );
    lastIndex = idx + normalizedQuery.length;
    pos = idx + 1;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length ? <>{parts}</> : text;
}

export function matchesQuery(prop: PlanGobiernoSlim, normalizedQuery: string): boolean {
  if (!normalizedQuery) return true;
  const fields = [
    prop.titulo,
    prop.descripcion,
    prop.problema,
    prop.objetivo,
    prop.indicador,
    prop.meta,
  ];
  return fields.some((f) => f && normalizeForSearch(f).includes(normalizedQuery));
}

// ─── List helpers ─────────────────────────────────────────────────────────────

function hasNumberedList(text: string): boolean {
  return /(?<![.\d])[1-9]\d?\.\s+\w/.test(text) &&
    (text.match(/(?<![.\d])[1-9]\d?\.\s+/g) || []).length > 1;
}

function splitNumberedList(text: string): string[] {
  if (!text) return [];
  return text
    .split(/(?=(?<![.\d])[1-9]\d?\.\s+)/)
    .map((s) => s.replace(/^[1-9]\d?\.\s*/, "").trim())
    .filter(Boolean);
}

function hasBulletList(text: string): boolean {
  return (text.match(/[•·]/g) || []).length > 1;
}

function splitBulletList(text: string): string[] {
  if (!text) return [];
  const stripped = text.replace(/^[1-9]\d?\.\s*/, "").trim();
  return stripped
    .split(/\s*[•·]\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function needsSplit(text: string | null): boolean {
  if (!text) return false;
  return hasBulletList(text) || hasNumberedList(text);
}

function HighlightedText({ text, normalizedQuery }: { text: string | null; normalizedQuery: string }) {
  if (!text) return null;
  return <>{highlightText(text, normalizedQuery)}</>;
}

function FieldText({ text, normalizedQuery }: { text: string | null; normalizedQuery: string }) {
  if (!text) return null;
  if (hasBulletList(text)) {
    const items = splitBulletList(text);
    return (
      <ul className="list-disc list-outside ml-4 space-y-1">
        {items.map((item, i) => (
          <li key={i}>
            <HighlightedText text={item} normalizedQuery={normalizedQuery} />
          </li>
        ))}
      </ul>
    );
  }
  if (hasNumberedList(text)) {
    const items = splitNumberedList(text);
    return (
      <ol className="list-decimal list-outside ml-4 space-y-1">
        {items.map((item, i) => (
          <li key={i}>
            <HighlightedText text={item} normalizedQuery={normalizedQuery} />
          </li>
        ))}
      </ol>
    );
  }
  return <HighlightedText text={text} normalizedQuery={normalizedQuery} />;
}

// ─── Grouping helpers ─────────────────────────────────────────────────────────

function stripLeadingNumber(s: string): string {
  return s.replace(/^(\d+[\.\)]\s*)+/, "").trim();
}

const sameAs = (a: string | null | undefined, b: string | null | undefined): boolean => {
  if (!a || !b) return false;
  const sa = stripLeadingNumber(a);
  const sb = stripLeadingNumber(b);
  if (sa === sb) return true;
  const shorter = sa.length <= sb.length ? sa : sb;
  const longer = sa.length <= sb.length ? sb : sa;
  return shorter.length >= 30 && longer.startsWith(shorter);
};

function is4Field(p: PlanGobiernoSlim) {
  return p.problema != null && p.objetivo != null && p.indicador != null && p.meta != null;
}

function groupProposals(rows: PlanGobiernoSlim[]): PlanGobiernoSlim[][] {
  const groups: PlanGobiernoSlim[][] = [];
  for (const row of rows) {
    if (!is4Field(row)) {
      groups.push([row]);
      continue;
    }
    const last = groups[groups.length - 1];
    if (last && last.length > 0 && is4Field(last[0])) {
      const prev = last[last.length - 1];
      if (sameAs(prev.problema, row.problema)) {
        last.push(row);
        continue;
      }
    }
    groups.push([row]);
  }
  return groups;
}

// ─── Shared cell ──────────────────────────────────────────────────────────────

function SharedCell({
  label, value, normalizedQuery, borderRight,
}: {
  label: string; value: string | null; normalizedQuery: string; borderRight?: boolean;
}) {
  return (
    <div className="p-3" style={{ borderRight: borderRight ? "0.5px solid #e5e7eb" : undefined }}>
      <p className="uppercase text-gray-400 mb-1" style={{ fontSize: 9, letterSpacing: "0.06em" }}>
        {label}
      </p>
      <div className="text-gray-900">
        <FieldText text={value} normalizedQuery={normalizedQuery} />
      </div>
    </div>
  );
}

// ─── Proposal card ────────────────────────────────────────────────────────────

function ProposalCard({
  rows, index, normalizedQuery,
}: {
  rows: PlanGobiernoSlim[]; index: number; normalizedQuery: string;
}) {
  const first = rows[0];

  if (!is4Field(first)) {
    return (
      <div className="border border-gray-200 rounded-lg p-3 relative">
        <span className="absolute top-2 right-2 text-[10px] text-gray-300 select-none">
          {index + 1}
        </span>
        {first.titulo && (
          <p className="text-[14px] font-medium text-gray-900 leading-[1.4] mb-1.5 pr-6">
            <HighlightedText text={first.titulo} normalizedQuery={normalizedQuery} />
          </p>
        )}
        {first.descripcion && (
          <p className="text-[13px] text-gray-500 leading-[1.7]">
            <HighlightedText text={first.descripcion} normalizedQuery={normalizedQuery} />
          </p>
        )}
      </div>
    );
  }

  if (rows.length === 1) {
    const usedSplit = [first.problema, first.objetivo, first.indicador, first.meta].some(needsSplit);
    return (
      <div className="border border-gray-200 rounded-lg overflow-hidden relative text-[13px] leading-[1.7]">
        <span className="absolute top-2 right-2 text-[10px] text-gray-300 select-none">
          {index + 1}
        </span>
        <div className="grid grid-cols-1 md:grid-cols-2">
          {[
            { label: "PROBLEMA", value: first.problema },
            { label: "OBJETIVO ESTRATÉGICO", value: first.objetivo },
            { label: "INDICADORES", value: first.indicador },
            { label: "METAS 2026–2031", value: first.meta },
          ].map((cell, ci) => (
            <div
              key={ci}
              className="p-3"
              style={{
                borderRight: ci % 2 === 0 ? "0.5px solid #e5e7eb" : "none",
                borderBottom: ci < 2 ? "0.5px solid #e5e7eb" : "none",
              }}
            >
              <p className="uppercase text-gray-400 mb-1" style={{ fontSize: 9, letterSpacing: "0.06em" }}>
                {cell.label}
              </p>
              <div className="text-gray-900">
                <FieldText text={cell.value} normalizedQuery={normalizedQuery} />
              </div>
            </div>
          ))}
        </div>
        {usedSplit && (
          <p className="px-3 pb-2.5 text-gray-400 italic" style={{ fontSize: 11 }}>
            Este partido presentó múltiples compromisos en una sola fila del formulario JNE.
          </p>
        )}
      </div>
    );
  }

  // Multi-row grouped card
  const longest = (vals: (string | null)[]): string | null => {
    const nonNull = vals.filter(Boolean) as string[];
    return nonNull.length ? nonNull.reduce((a, b) => (a.length >= b.length ? a : b)) : null;
  };
  const sharedProblema = longest(rows.map((r) => r.problema));

  type ObjSubgroup = { objetivo: string | null; rows: PlanGobiernoSlim[] };
  const objSubgroups: ObjSubgroup[] = [];
  for (const row of rows) {
    const last = objSubgroups[objSubgroups.length - 1];
    if (last && sameAs(last.objetivo, row.objetivo)) {
      last.rows.push(row);
    } else {
      objSubgroups.push({ objetivo: row.objetivo, rows: [row] });
    }
  }
  for (const sg of objSubgroups) {
    sg.objetivo = longest(sg.rows.map((r) => r.objetivo));
  }

  const singleSubgroup = objSubgroups.length === 1;
  const usedSplit = rows.some((r) =>
    [r.problema, r.objetivo, r.indicador, r.meta].some(needsSplit)
  );

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden relative text-[13px] leading-[1.7]">
      <span className="absolute top-2 right-2 text-[10px] text-gray-300 select-none">
        {index + 1}
      </span>

      {singleSubgroup ? (
        <div className="grid grid-cols-1 md:grid-cols-2" style={{ borderBottom: "0.5px solid #e5e7eb" }}>
          <SharedCell label="PROBLEMA" value={sharedProblema} normalizedQuery={normalizedQuery} borderRight />
          <SharedCell label="OBJETIVO ESTRATÉGICO" value={objSubgroups[0].objetivo} normalizedQuery={normalizedQuery} />
        </div>
      ) : (
        <div className="p-3" style={{ borderBottom: "0.5px solid #e5e7eb" }}>
          <p className="uppercase text-gray-400 mb-1" style={{ fontSize: 9, letterSpacing: "0.06em" }}>
            PROBLEMA
          </p>
          <div className="text-gray-900">
            <FieldText text={sharedProblema} normalizedQuery={normalizedQuery} />
          </div>
        </div>
      )}

      {objSubgroups.map((sg, si) => (
        <div key={si} style={{ borderTop: si > 0 ? "0.5px solid #e5e7eb" : undefined }}>
          {!singleSubgroup && (
            <div className="px-3 py-2.5" style={{ backgroundColor: "#faf9f7", borderBottom: "0.5px solid #e5e7eb" }}>
              <p className="uppercase text-gray-400 mb-1" style={{ fontSize: 9, letterSpacing: "0.06em" }}>
                OBJETIVO ESTRATÉGICO
              </p>
              <div className="text-gray-900">
                <FieldText text={sg.objetivo} normalizedQuery={normalizedQuery} />
              </div>
            </div>
          )}
          {sg.rows.map((row, ri) => (
            <div
              key={ri}
              className="grid grid-cols-1 md:grid-cols-2"
              style={{ borderTop: ri > 0 ? "0.5px solid #f3f4f6" : undefined }}
            >
              <div className="p-3" style={{ borderRight: "0.5px solid #e5e7eb" }}>
                <p className="uppercase text-gray-400 mb-1" style={{ fontSize: 9, letterSpacing: "0.06em" }}>
                  INDICADORES
                </p>
                <div className="text-gray-900">
                  <FieldText text={row.indicador} normalizedQuery={normalizedQuery} />
                </div>
              </div>
              <div className="p-3">
                <p className="uppercase text-gray-400 mb-1" style={{ fontSize: 9, letterSpacing: "0.06em" }}>
                  METAS 2026–2031
                </p>
                <div className="text-gray-900">
                  <FieldText text={row.meta} normalizedQuery={normalizedQuery} />
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}

      {usedSplit && (
        <p className="px-3 pb-2.5 text-gray-400 italic" style={{ fontSize: 11 }}>
          Este partido presentó múltiples compromisos en una sola fila del formulario JNE.
        </p>
      )}
    </div>
  );
}

// ─── Eje accordion ────────────────────────────────────────────────────────────

const PROPOSALS_INITIALLY_SHOWN = 5;

function isLight(hex: string): boolean {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 160;
}

function EjeAccordion({
  eje, allProposals, visibleProposals, isOpen, dimmed,
  normalizedQuery, hasMore, remainingCount, color,
  onToggle, onShowMore, refCallback,
}: {
  eje: string;
  allProposals: PlanGobiernoSlim[];
  visibleProposals: PlanGobiernoSlim[];
  isOpen: boolean;
  dimmed: boolean;
  normalizedQuery: string;
  hasMore: boolean;
  remainingCount: number;
  color?: string;
  onToggle: () => void;
  onShowMore: () => void;
  refCallback: (el: HTMLDivElement | null) => void;
}) {
  const headerBg    = isOpen && color ? color : undefined;
  const textColor   = isOpen && color ? (isLight(color) ? "#1f2937" : "#ffffff") : undefined;
  const mutedColor  = isOpen && color ? (isLight(color) ? "#6b7280" : "rgba(255,255,255,0.7)") : undefined;
  const chevronColor = isOpen && color ? (isLight(color) ? "#6b7280" : "rgba(255,255,255,0.8)") : undefined;

  return (
    <div
      ref={refCallback}
      className="border border-gray-200 rounded-lg overflow-hidden"
      style={!isOpen ? { borderLeft: "3px solid #9ca3af", borderTopLeftRadius: 0, borderBottomLeftRadius: 0 } : undefined}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors"
        style={{ backgroundColor: headerBg ?? (isOpen ? "#f9fafb" : "white") }}
      >
        <span className="text-sm font-medium" style={{ color: dimmed ? "#9ca3af" : (textColor ?? "#1f2937") }}>
          {EJE_LABELS[eje as PlanEje] ?? eje}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: dimmed ? "#d1d5db" : (mutedColor ?? "#9ca3af") }}>
            {(() => { const n = countGroupedProposals(allProposals); return `— ${n} compromiso${n !== 1 ? "s" : ""}`; })()}
          </span>
          <svg
            className="w-3.5 h-3.5 transition-transform"
            style={{ color: chevronColor ?? "#9ca3af", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {isOpen && (
        <div className="p-3 space-y-2.5">
          {groupProposals(visibleProposals).map((rows, i) => (
            <ProposalCard key={i} rows={rows} index={i} normalizedQuery={normalizedQuery} />
          ))}
          {hasMore && (
            <button
              onClick={onShowMore}
              className="w-full py-2 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded border border-dashed border-gray-200 transition-colors"
            >
              Ver {remainingCount} compromiso{remainingCount !== 1 ? "s" : ""} más ▼
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

interface PlanSectionProps {
  propuestas: PlanGobiernoSlim[];
  /** Used as React key to reset state when switching parties/formulas */
  entityId: string;
  color?: string;
}

export default function PlanSection({ propuestas, entityId, color }: PlanSectionProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [openEjes, setOpenEjes] = useState<Set<string>>(new Set());
  const [expandedEjes, setExpandedEjes] = useState<Set<string>>(new Set());
  const ejeRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const normalizedQuery = useMemo(
    () => (searchQuery ? normalizeForSearch(searchQuery) : ""),
    [searchQuery]
  );

  const byEje: [string, PlanGobiernoSlim[]][] = useMemo(() => {
    const map = new Map<string, PlanGobiernoSlim[]>();
    EJE_ORDER.forEach((eje) => {
      const group = propuestas.filter((p) => p.eje === eje).sort((a, b) => a.orden - b.orden);
      if (group.length > 0) map.set(eje, group);
    });
    propuestas.forEach((p) => {
      if (!map.has(p.eje)) map.set(p.eje, []);
      if (!EJE_ORDER.includes(p.eje as PlanEje)) map.get(p.eje)!.push(p);
    });
    return Array.from(map.entries());
  }, [propuestas]);

  const totalCards = useMemo(() => countGroupedProposals(propuestas), [propuestas]);

  const totalMatches = useMemo(() => {
    if (!normalizedQuery) return totalCards;
    return propuestas.filter((p) => matchesQuery(p, normalizedQuery)).length;
  }, [normalizedQuery, propuestas, totalCards]);

  useEffect(() => {
    if (!normalizedQuery) {
      setOpenEjes(new Set());
      return;
    }
    const next = new Set<string>();
    byEje.forEach(([eje, proposals]) => {
      if (proposals.some((p) => matchesQuery(p, normalizedQuery))) next.add(eje);
    });
    setOpenEjes(next);
  }, [normalizedQuery, byEje]);

  if (propuestas.length === 0) {
    return (
      <p className="text-[13px] text-gray-400 text-center py-6">
        Este partido no presentó un plan de gobierno al JNE
      </p>
    );
  }

  // entityId is used by the parent as a React key to reset this component
  void entityId;

  return (
    <div>
      <div>
        <div className="relative">
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <circle cx="11" cy="11" r="8" />
            <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Buscar en el plan de gobierno..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-gray-300 placeholder:text-gray-400"
          />
        </div>
        {normalizedQuery && (
          <p className="text-xs text-gray-400 mt-1">
            {totalMatches} compromiso{totalMatches !== 1 ? "s" : ""} encontrado{totalMatches !== 1 ? "s" : ""} para &ldquo;{searchQuery}&rdquo;
          </p>
        )}
      </div>

      <div className="mt-3 space-y-2">
        {byEje.map(([eje, proposals]) => {
          const filtered = normalizedQuery
            ? proposals.filter((p) => matchesQuery(p, normalizedQuery))
            : proposals;
          const isOpen = openEjes.has(eje);
          const hasMatches = filtered.length > 0;
          const dimmed = !!normalizedQuery && !hasMatches;
          const isExpanded = expandedEjes.has(eje);
          const visible = isExpanded ? filtered : filtered.slice(0, PROPOSALS_INITIALLY_SHOWN);
          const hasMore = filtered.length > PROPOSALS_INITIALLY_SHOWN && !isExpanded;

          return (
            <EjeAccordion
              key={eje}
              eje={eje}
              allProposals={proposals}
              visibleProposals={visible}
              isOpen={isOpen}
              dimmed={dimmed}
              normalizedQuery={normalizedQuery}
              hasMore={hasMore}
              remainingCount={filtered.length - PROPOSALS_INITIALLY_SHOWN}
              color={color}
              onToggle={() =>
                setOpenEjes((prev) => {
                  const next = new Set(prev);
                  if (next.has(eje)) next.delete(eje);
                  else next.add(eje);
                  return next;
                })
              }
              onShowMore={() => setExpandedEjes((prev) => { const s = new Set(prev); s.add(eje); return s; })}
              refCallback={(el) => { ejeRefs.current[eje] = el; }}
            />
          );
        })}
      </div>
    </div>
  );
}
