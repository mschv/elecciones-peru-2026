import { createClient } from "@/lib/supabase/server";
import type { CongresoMember } from "@/lib/supabase/types";
import CongresoLayout from "@/components/congreso/CongresoLayout";
import CongresoClient from "@/components/congreso/CongresoClient";

export const metadata = { title: "Diputados — Elecciones Perú 2026" };

export default async function CongresistasPage({ searchParams }: { searchParams: { partido?: string } }) {
  const supabase = createClient();

  const SELECT = `
    id, slug, nombres, apellidos, foto_url,
    cargo, region, is_incumbent, is_first_time,
    education ( nivel ),
    procesos_judiciales ( status ),
    partido:partido_id (
      id, slug, nombre, nombre_corto, logo_url, color_hex
    )
  `;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allData: any[] = [];
  let error = null;
  let offset = 0;
  const PAGE = 1000;
  while (true) {
    const { data: batch, error: err } = await supabase
      .from("candidates")
      .select(SELECT)
      .eq("cargo", "congresista")
      .order("apellidos")
      .range(offset, offset + PAGE - 1);
    if (err) { error = err; break; }
    allData.push(...(batch ?? []));
    if ((batch ?? []).length < PAGE) break;
    offset += PAGE;
  }
  const data = allData;

  if (error) console.error("[CongresistasPage] fetch error:", error);

  const FALLBACK_PARTIDO = { id: "", slug: "", nombre: "Sin partido", nombre_corto: null, logo_url: null, color_hex: null };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const members = (data ?? []).map((c: any) => ({
    cargo: c.cargo,
    orden: c.orden ?? 0,
    region: c.region ?? null,
    is_incumbent: c.is_incumbent ?? false,
    is_first_time: c.is_first_time ?? false,
    candidate: {
      id: c.id,
      slug: c.slug,
      nombres: c.nombres,
      apellidos: c.apellidos,
      foto_url: c.foto_url,
      education: c.education ?? [],
      procesos_judiciales: c.procesos_judiciales ?? [],
    },
    formula: {
      numero_lista: null,
      partido: c.partido ?? FALLBACK_PARTIDO,
    },
  })) as CongresoMember[];

  return (
    <CongresoLayout activeTab="congresistas">
      <CongresoClient members={members} cargo="congresista" initialPartido={searchParams.partido} />
    </CongresoLayout>
  );
}
