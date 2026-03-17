import type { IdeologyType } from '@/lib/supabase/types'

interface Props {
  ideology: IdeologyType
}

const labels: Record<IdeologyType, string> = {
  izquierda: 'Izquierda',
  centro_izquierda: 'Centro-izquierda',
  centro: 'Centro',
  centro_derecha: 'Centro-derecha',
  derecha: 'Derecha',
  populista: 'Populista',
  otro: 'Otro',
  sin_definir: 'Sin definir',
}

export default function IdeologyBadge({ ideology }: Props) {
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
      {labels[ideology]}
    </span>
  )
}
