export type ProcesoState = 'activo' | 'condena' | 'limpio'

function isActive(s: string): boolean {
  return s === 'en_curso' || s === 'en_apelacion'
}

export function getCandidatoState(procesos: { status: string }[]): ProcesoState {
  const statuses = procesos.map(p => p.status)
  if (statuses.some(s => isActive(s))) return 'activo'
  if (statuses.some(s => s === 'sentencia_condenatoria' || s === 'sentencia_firme' || s === 'sentencia_civil')) return 'condena'
  return 'limpio'
}

export function countByState(
  procesos: { candidate_id: string; status: string }[],
  state: ProcesoState
): number {
  const byCandidate: Record<string, { status: string }[]> = {}
  for (const p of procesos) {
    if (!byCandidate[p.candidate_id]) byCandidate[p.candidate_id] = []
    byCandidate[p.candidate_id].push({ status: p.status })
  }
  return Object.values(byCandidate).filter(ps => getCandidatoState(ps) === state).length
}
