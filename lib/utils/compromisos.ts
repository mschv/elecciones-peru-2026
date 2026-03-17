import type { PlanEje } from '@/lib/supabase/types'

const EJE_ORDER: PlanEje[] = [
  'social', 'economico', 'economia', 'ambiental', 'medio_ambiente',
  'institucional', 'salud', 'educacion_eje', 'seguridad', 'infraestructura', 'otro',
]

type ProposalRow = {
  eje?: string
  problema?: string | null
  objetivo?: string | null
  indicador?: string | null
  meta?: string | null
  orden?: number
}

function stripLeadingNumber(s: string): string {
  return s.replace(/^(\d+[\.\)]\s*)+/, '').trim()
}

function sameAs(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  const sa = stripLeadingNumber(a)
  const sb = stripLeadingNumber(b)
  if (sa === sb) return true
  const shorter = sa.length <= sb.length ? sa : sb
  const longer  = sa.length <= sb.length ? sb : sa
  return shorter.length >= 30 && longer.startsWith(shorter)
}

function is4Field(p: ProposalRow): boolean {
  return p.problema != null && p.objetivo != null && p.indicador != null && p.meta != null
}

function isHeaderRow(p: ProposalRow): boolean {
  return !!(p.indicador && p.indicador.toLowerCase().trim() === 'indicadores')
}

/**
 * Count distinct commitments using the same grouping logic as the detail panel:
 * 1. Removes header rows
 * 2. Sorts by EJE_ORDER + orden
 * 3. Consecutive 4-field rows with the same `problema` form one group; all others count individually
 *
 * This is equivalent to `groupProposals(propuestas).length` in PartyDetail.tsx.
 */
export function countGroupedProposals(rows: ProposalRow[]): number {
  const filtered = rows
    .filter(r => !isHeaderRow(r))
    .sort((a, b) => {
      const ai = EJE_ORDER.indexOf((a.eje ?? '') as PlanEje)
      const bi = EJE_ORDER.indexOf((b.eje ?? '') as PlanEje)
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi) || (a.orden ?? 0) - (b.orden ?? 0)
    })

  let count = 0
  let lastGroupFirstIs4Field = false
  let lastRowProblema: string | null | undefined = undefined

  for (const row of filtered) {
    if (!is4Field(row)) {
      count++
      lastGroupFirstIs4Field = false
      lastRowProblema = undefined
      continue
    }
    if (lastGroupFirstIs4Field && sameAs(lastRowProblema, row.problema)) {
      lastRowProblema = row.problema // extend group
    } else {
      count++
      lastGroupFirstIs4Field = true
      lastRowProblema = row.problema
    }
  }
  return count
}
