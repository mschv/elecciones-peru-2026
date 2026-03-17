"use client";

import { useState } from "react";

interface Props {
  title: string;
  summary?: string;
  icon?: string;
  defaultOpen?: boolean;
  color?: string;
  children: React.ReactNode;
}

/** Returns true if the hex color is light enough to need dark text */
function isLight(hex: string): boolean {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 160;
}

export default function Accordion({ title, summary, icon, defaultOpen = false, color, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const headerBg   = open && color ? color : undefined;
  const textColor  = open && color ? (isLight(color) ? "#1f2937" : "#ffffff") : undefined;
  const mutedColor = open && color ? (isLight(color) ? "#4b5563" : "rgba(255,255,255,0.7)") : undefined;
  const chevronColor = open && color ? (isLight(color) ? "#6b7280" : "rgba(255,255,255,0.8)") : undefined;

  return (
    <div
      className="border border-gray-200 rounded-lg overflow-hidden"
      style={!open ? { borderLeft: "3px solid #9ca3af", borderTopLeftRadius: 0, borderBottomLeftRadius: 0 } : undefined}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 transition-colors text-left"
        style={{ backgroundColor: headerBg ?? "white" }}
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 font-medium text-sm" style={{ color: textColor ?? "#1f2937" }}>
          {icon && <span aria-hidden="true">{icon}</span>}
          {title}
          {summary && <span className="font-normal" style={{ color: mutedColor ?? "#6b7280" }}>{summary}</span>}
        </span>
        <span
          className="transition-transform duration-200 shrink-0"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", color: chevronColor ?? "#9ca3af" }}
          aria-hidden="true"
        >
          ▾
        </span>
      </button>

      <div
        className="overflow-hidden transition-all duration-200 bg-white"
        style={{ maxHeight: open ? "9999px" : "0px" }}
      >
        <div className="px-4 py-3">{children}</div>
      </div>
    </div>
  );
}
