"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Senadores", href: "/congreso/senadores", key: "senadores" },
  { label: "Diputados", href: "/congreso/congresistas", key: "congresistas" },
];

interface Props {
  activeTab: "senadores" | "congresistas";
  children: React.ReactNode;
}

export default function CongresoLayout({ activeTab, children }: Props) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-[calc(100svh-57px)] overflow-hidden">
      {/* Subnav */}
      <div className="bg-white border-b border-gray-200 pl-8 flex gap-0 shrink-0">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key || pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.key}
              href={tab.href}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                isActive
                  ? "border-[#e53935] text-[#e53935]"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Content fills remaining height */}
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
