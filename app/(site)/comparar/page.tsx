import { createClient } from "@/lib/supabase/server";
import CompareClient from "@/components/comparar/CompareClient";
import type { Metadata } from "next";

const TYPE_LABELS: Record<string, string> = {
  formulas: "Fórmulas",
  congresistas: "Diputados",
  partidos: "Partidos",
  plan_gobierno: "Plan de Gobierno",
};

interface PageProps {
  searchParams: { type?: string; ids?: string };
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const type = searchParams.type ?? "formulas";
  const ids = searchParams.ids?.split(",").filter(Boolean) ?? [];
  const label = TYPE_LABELS[type] ?? "Candidatos";
  const count = ids.length;

  return {
    title: `Comparar ${label} — Elecciones Perú 2026`,
    description:
      count > 0
        ? `Comparación de ${count} ${label.toLowerCase()} — Elecciones Generales Perú 2026. Datos oficiales del JNE.`
        : `Compara ${label.toLowerCase()} para las Elecciones Generales Perú 2026.`,
    openGraph: {
      title: `Comparar ${label} — Elecciones Perú 2026`,
      description: `Comparación de ${label.toLowerCase()} para las Elecciones Generales Perú 2026. Datos del JNE.`,
    },
  };
}

export default async function CompararPage({ searchParams }: PageProps) {
  const type = searchParams.type ?? "formulas";
  const ids = searchParams.ids?.split(",").filter(Boolean) ?? [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any[] = [];

  if (ids.length > 0) {
    const supabase = createClient();

    if (type === "formulas" || type === "plan_gobierno") {
      const { data: rows } = await supabase
        .from("formulas")
        .select(`
          id, slug, activa, numero_lista,
          partido:partido_id (
            id, nombre, nombre_corto, logo_url, color_hex,
            fundacion_year, ideologia,
            plan_gobierno ( eje, titulo, descripcion, orden )
          ),
          formula_members (
            cargo, orden,
            candidate:candidate_id (
              id, slug, nombres, apellidos, foto_url, dni,
              education ( * ),
              experience ( * ),
              procesos_judiciales ( * )
            )
          )
        `)
        .in("id", ids);
      data = rows ?? [];
    } else if (type === "partidos") {
      const { data: rows } = await supabase
        .from("partidos")
        .select(`
          id, slug, nombre, nombre_corto, logo_url, color_hex,
          ideologia, fundacion_year, descripcion, jne_url,
          formulas (
            id, activa,
            formula_members (
              cargo, orden,
              candidate:candidate_id (
                id, nombres, apellidos, foto_url,
                education ( nivel ),
                procesos_judiciales ( status )
              )
            )
          ),
          plan_gobierno ( eje, titulo, descripcion, orden )
        `)
        .in("id", ids);
      data = rows ?? [];
    } else if (type === "congresistas") {
      const { data: rows } = await supabase
        .from("formula_members")
        .select(`
          cargo, orden, region, is_incumbent, is_first_time,
          candidate:candidate_id (
            id, slug, nombres, apellidos, foto_url, dni,
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
        .in("candidate_id", ids)
        .in("cargo", ["senador", "congresista"]);

      // Deduplicate by candidate_id (keep first match per candidate)
      const seen = new Set<string>();
      const deduped = (rows ?? []).filter((r: any) => {
        const cid = r.candidate?.id;
        if (!cid || seen.has(cid)) return false;
        seen.add(cid);
        return true;
      });
      // Preserve original ID order
      deduped.sort(
        (a: any, b: any) => ids.indexOf(a.candidate?.id) - ids.indexOf(b.candidate?.id)
      );
      data = deduped;
    }
  }

  return <CompareClient type={type} ids={ids} data={data} />;
}
