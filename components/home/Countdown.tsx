"use client";

import { useEffect, useState, Fragment } from "react";

// April 12, 2026 08:00 Peru time (UTC-5) = 13:00 UTC
const TARGET = new Date("2026-04-12T13:00:00Z").getTime();

export default function Countdown() {
  const [diff, setDiff] = useState<number | null>(null);

  useEffect(() => {
    const update = () => setDiff(TARGET - Date.now());
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  if (diff === null) return <div className="h-10" />;

  if (diff <= 0) {
    return (
      <span className="text-green-400 font-semibold text-sm">
        Votaciones en curso
      </span>
    );
  }

  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1_000);

  const units = [
    { v: d, u: "días" },
    { v: h, u: "horas" },
    { v: m, u: "min" },
    { v: s, u: "seg" },
  ] as const;

  return (
    <div className="flex items-center gap-0.5">
      <span className="text-gray-400 text-xs mr-2">Faltan</span>
      {units.map(({ v, u }, i) => (
        <Fragment key={u}>
          {i > 0 && <span className="text-gray-600 text-sm mx-1">:</span>}
          <div className="flex flex-col items-center min-w-[36px]">
            <span className="text-white font-bold text-lg leading-none tabular-nums">
              {String(v).padStart(2, "0")}
            </span>
            <span className="text-gray-500 text-[9px] uppercase tracking-wide">
              {u}
            </span>
          </div>
        </Fragment>
      ))}
    </div>
  );
}
