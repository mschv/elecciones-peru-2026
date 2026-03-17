import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import type { CongresoMemberFull } from "@/lib/supabase/types";
import CandidateProfile from "@/components/congreso/CandidateProfile";
import { notFound } from "next/navigation";

interface Props {
  params: { slug: string };
}

async function getMember(slug: string): Promise<CongresoMemberFull | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("formula_members")
    .select(`
      cargo, orden, region, is_incumbent, is_first_time,
      candidate:candidate_id (
        id, slug, nombres, apellidos, foto_url,
        dni,
        education ( * ),
        experience ( * ),
        procesos_judiciales ( * )
      ),
      formula:formula_id (
        numero_lista,
        partido:partido_id (
          id, slug, nombre, nombre_corto, logo_url, color_hex
        )
      )
    `)
    .eq("candidate.slug", slug)
    .in("cargo", ["senador", "congresista"])
    .single();

  if (error) return null;
  return data as unknown as CongresoMemberFull;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const member = await getMember(params.slug);
  if (!member) return { title: "Candidato — Elecciones Perú 2026" };

  const { candidate, formula, cargo, region } = member;
  const fullName = `${candidate.nombres} ${candidate.apellidos}`;
  const cargoLabel = cargo === "senador" ? "Senador" : "Diputado";
  const procesos = candidate.procesos_judiciales?.length ?? 0;

  const description = [
    `${cargoLabel} por ${formula.partido.nombre}`,
    region,
    procesos > 0 ? `${procesos} proceso${procesos !== 1 ? "s" : ""} judicial${procesos !== 1 ? "es" : ""}` : "Sin procesos judiciales",
  ]
    .filter(Boolean)
    .join(" · ");

  const ogUrl = new URL(`/api/og`, process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");
  ogUrl.searchParams.set("name", fullName);
  ogUrl.searchParams.set("cargo", cargoLabel);
  ogUrl.searchParams.set("partido", formula.partido.nombre);
  ogUrl.searchParams.set("region", region ?? "");
  ogUrl.searchParams.set("procesos", String(procesos));
  ogUrl.searchParams.set("color", formula.partido.color_hex ?? "#6b7280");

  return {
    title: `${fullName} — Elecciones Perú 2026`,
    description,
    openGraph: {
      title: `${fullName} — Elecciones Perú 2026`,
      description,
      images: [{ url: ogUrl.toString(), width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${fullName} — Elecciones Perú 2026`,
      description,
      images: [ogUrl.toString()],
    },
  };
}

export default async function CandidatoCongresoPage({ params }: Props) {
  const member = await getMember(params.slug);
  if (!member) notFound();

  return (
    <div className="min-h-screen bg-gray-50">
      <CandidateProfile member={member} standalone />
    </div>
  );
}
