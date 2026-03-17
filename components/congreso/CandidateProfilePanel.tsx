"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CongresoMemberFull } from "@/lib/supabase/types";
import CandidateProfile from "./CandidateProfile";

async function fetchMemberFull(candidateId: string): Promise<CongresoMemberFull | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("candidates")
    .select(`
      id, slug, nombres, apellidos, foto_url,
      dni, cargo, region, is_incumbent, is_first_time,
      education ( * ),
      experience ( * ),
      procesos_judiciales ( * ),
      anotaciones_jne ( * ),
      cargo_eleccion ( * ),
      patrimonio ( * ),
      partido:partido_id (
        id, slug, nombre, nombre_corto, logo_url, color_hex
      )
    `)
    .eq("id", candidateId)
    .in("cargo", ["senador", "congresista"])
    .single();

  if (error) { console.error("[CandidateProfilePanel] fetch error:", error); return null; }

  const FALLBACK_PARTIDO = { id: "", slug: "", nombre: "Sin partido", nombre_corto: null, logo_url: null, color_hex: null };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;

  return {
    cargo: d.cargo,
    orden: d.orden ?? 0,
    region: d.region ?? null,
    is_incumbent: d.is_incumbent ?? false,
    is_first_time: d.is_first_time ?? false,
    candidate: {
      id: d.id,
      slug: d.slug,
      nombres: d.nombres,
      apellidos: d.apellidos,
      foto_url: d.foto_url,
      fecha_nacimiento: null,
      lugar_nacimiento: null,
      dni: d.dni,
      bio: null,
      education: (data as any).education ?? [],
      experience: (data as any).experience ?? [],
      procesos_judiciales: (data as any).procesos_judiciales ?? [],
      patrimonio: (data as any).patrimonio ?? [],
      anotaciones_jne: (data as any).anotaciones_jne ?? [],
      cargo_eleccion: (data as any).cargo_eleccion ?? [],
    },
    formula: {
      numero_lista: null,
      partido: (data as any).partido ?? FALLBACK_PARTIDO,
    },
  } as unknown as CongresoMemberFull;
}

interface Props {
  candidateId: string | null;
  onBack: () => void;
}

export default function CandidateProfilePanel({ candidateId, onBack }: Props) {
  const [member, setMember] = useState<CongresoMemberFull | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!candidateId) { setMember(null); return; }
    setLoading(true);
    fetchMemberFull(candidateId).then((d) => {
      setMember(d);
      setLoading(false);
    });
  }, [candidateId]);

  if (!candidateId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8 text-gray-400 gap-3">
        <span className="text-5xl text-gray-300">—</span>
        <p className="text-sm">Selecciona un candidato para ver su perfil</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-6 h-6 border-2 border-gray-300 border-t-[#e53935] rounded-full" />
      </div>
    );
  }

  if (!member) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        No se pudo cargar el perfil.
      </div>
    );
  }

  return <CandidateProfile member={member} onBack={onBack} />;
}
