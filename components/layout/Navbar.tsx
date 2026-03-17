"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Countdown from "./Countdown";

const navLinks = [
  { href: "/", label: "Inicio" },
  { href: "/partidos", label: "Partidos" },
  { href: "/congreso", label: "Congreso" },
  { href: "/comparar", label: "Comparar" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <header>
      <nav className="bg-[#B31B1B] text-white pl-8 pr-5 pt-5 pb-3">
        <div className="flex items-center justify-between gap-6">

          {/* ── Left: Brand + Countdown ── */}
          <div className="flex items-center gap-4 shrink-0">
            <div className="flex flex-col leading-tight">
              <Link href="/" className="tracking-tight">
                <span className="text-[18px] font-semibold text-white">
                  Elecciones Perú 2026
                </span>
              </Link>
              <span className="text-[10px] text-white/60 tracking-wide mt-0.5">
                Data oficial del JNE
              </span>
            </div>

            <div className="hidden sm:block w-px h-8 bg-white/30 shrink-0" />

            <div className="hidden sm:block">
              <Countdown />
            </div>
          </div>

          {/* ── Right: Nav links (desktop only) ── */}
          <nav className="hidden md:flex items-center gap-0.5 shrink-0">
            {navLinks.map((link) => {
              const active =
                pathname === link.href ||
                (link.href !== "/" && pathname.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-1.5 rounded-md transition-colors text-sm ${
                    active
                      ? "text-white font-semibold bg-white/20"
                      : "text-white/70 font-normal hover:text-white hover:bg-white/10"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

        </div>
      </nav>

    </header>
  );
}
