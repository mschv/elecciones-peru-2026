"use client";

import { useEffect, useState } from "react";

// Election day: April 12, 2026 at 8:00 AM Peru time (UTC-5)
const ELECTION_DATE = new Date("2026-04-12T13:00:00Z");

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function getTimeLeft() {
  const diff = ELECTION_DATE.getTime() - Date.now();
  if (diff <= 0) return null;
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds };
}

export default function Countdown() {
  const [time, setTime] = useState<ReturnType<typeof getTimeLeft>>(null);

  useEffect(() => {
    setTime(getTimeLeft());
    const id = setInterval(() => setTime(getTimeLeft()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!time) return null;

  return (
    <div className="flex items-start gap-2 text-white">
        <Unit value={pad(time.days)} label="días" />
        <span className="text-white/60 text-lg font-light leading-none pt-[2px]">:</span>
        <Unit value={pad(time.hours)} label="horas" />
        <span className="text-white/60 text-lg font-light leading-none pt-[2px]">:</span>
        <Unit value={pad(time.minutes)} label="min" />
        <span className="text-white/60 text-lg font-light leading-none pt-[2px]">:</span>
        <Unit value={pad(time.seconds)} label="seg" />
    </div>
  );
}

function Unit({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center leading-none gap-[3px]">
      <span className="text-[20px] font-bold tabular-nums tracking-tight leading-none">{value}</span>
      <span className="text-[8px] text-white/60 tracking-[0.12em]">{label}</span>
    </div>
  );
}
