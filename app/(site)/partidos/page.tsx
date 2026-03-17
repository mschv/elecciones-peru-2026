import { createClient } from '@/lib/supabase/server'
import type { PartidoSummary } from '@/lib/supabase/types'
import PartidosClient from '@/components/partidos/PartidosClient'
import { countGroupedProposals } from '@/lib/utils/compromisos'


export default async function PartidosPage() {
  const supabase = createClient()

  // Paginate congress candidates (senadores + congresistas) — same pattern as senadores/page.tsx
  const allCandidates: any[] = []
  let candOffset = 0
  const PAGE = 1000
  while (true) {
    const { data: batch } = await (supabase as any)
      .from('candidates')
      .select('id, partido_id, procesos_judiciales(status)')
      .not('partido_id', 'is', null)
      .in('cargo', ['senador', 'congresista'])
      .range(candOffset, candOffset + PAGE - 1)
    allCandidates.push(...(batch ?? []))
    if ((batch ?? []).length < PAGE) break
    candOffset += PAGE
  }

  const [{ data, error }, { data: planData }, { data: formulaMembersData }] = await Promise.all([
    // partido_summary is a Supabase view — types are asserted manually
    (supabase as any)
      .from('partido_summary')
      .select('*')
      .eq('is_active', true)
      .gt('total_candidatos', 0)
      .order('nombre', { ascending: true }) as { data: PartidoSummary[] | null; error: unknown },
    (supabase as any)
      .from('plan_gobierno')
      .select('partido_id, eje, problema, objetivo, indicador, meta, orden'),
    (supabase as any)
      .from('formula_members')
      .select('orden, formula:formula_id(partido_id), candidate:candidate_id(id, nombres, apellidos, procesos_judiciales(status))')
      .order('orden', { ascending: true }),
  ])

  if (error) console.error('[PartidosPage] fetch error:', error)

  // ── Compromisos counts ───────────────────────────────────────────────────────
  type PlanRow = { partido_id: string | null; eje: string; problema: string | null; objetivo: string | null; indicador: string | null; meta: string | null; orden: number }
  const byPartido: Record<string, PlanRow[]> = {}
  for (const row of (planData ?? []) as PlanRow[]) {
    if (!row.partido_id) continue
    if (!byPartido[row.partido_id]) byPartido[row.partido_id] = []
    byPartido[row.partido_id].push(row)
  }
  const compromisosCounts: Record<string, number> = {}
  for (const [pid, rows] of Object.entries(byPartido)) {
    compromisosCounts[pid] = countGroupedProposals(rows)
  }

  // ── Formula candidate names per party ────────────────────────────────────────
  type FormulaMemberRow = { orden: number; formula: { partido_id: string } | null; candidate: { id: string; nombres: string; apellidos: string; procesos_judiciales: { status: string }[] } | null }
  const formulaNamesByPartido: Record<string, string[]> = {}   // all names, for search
  const presidentialByPartido: Record<string, string> = {}     // orden=1, for display
  for (const m of (formulaMembersData ?? []) as FormulaMemberRow[]) {
    const pid = m.formula?.partido_id
    const name = [m.candidate?.nombres, m.candidate?.apellidos].filter(Boolean).join(' ')
    if (!pid || !name) continue
    if (!formulaNamesByPartido[pid]) formulaNamesByPartido[pid] = []
    formulaNamesByPartido[pid].push(name)
    if (!presidentialByPartido[pid]) presidentialByPartido[pid] = name
  }

  // ── Procesos stats (activos + condenas) per party ────────────────────────────
  // Track counted candidate IDs per party to avoid double-counting
  const countedIds: Record<string, Set<string>> = {}
  const procesosStats: Record<string, { activos: number; condenas: number; civiles: number }> = {}

  function countCandidate(pid: string, candId: string, procesos: { status: string }[]) {
    if (!countedIds[pid]) countedIds[pid] = new Set()
    if (countedIds[pid].has(candId)) return
    countedIds[pid].add(candId)
    const hasActivo  = procesos.some((p) => ["en_curso", "en_apelacion"].includes(p.status))
    const hasCondena = procesos.some((p) => ["sentencia_condenatoria", "sentencia_firme", "pena_cumplida"].includes(p.status))
    const hasCivil   = procesos.some((p) => p.status === "sentencia_civil")
    if (!hasActivo && !hasCondena && !hasCivil) return
    if (!procesosStats[pid]) procesosStats[pid] = { activos: 0, condenas: 0, civiles: 0 }
    if (hasActivo)  procesosStats[pid].activos++
    if (hasCondena) procesosStats[pid].condenas++
    if (hasCivil)   procesosStats[pid].civiles++
  }

  // Formula members (presidente, vicepresidentes)
  for (const m of (formulaMembersData ?? []) as FormulaMemberRow[]) {
    const pid = m.formula?.partido_id
    if (!pid || !m.candidate?.id) continue
    countCandidate(pid, m.candidate.id, m.candidate.procesos_judiciales ?? [])
  }

  // Congress candidates (senadores, diputados) — paginated from candidates table
  type CandRow = { id: string; partido_id: string; procesos_judiciales: { status: string }[] }
  for (const c of allCandidates as CandRow[]) {
    if (!c.partido_id) continue
    countCandidate(c.partido_id, c.id, c.procesos_judiciales ?? [])
  }


  return (
    <PartidosClient
      partidos={data ?? []}
      compromisosCounts={compromisosCounts}
      procesosStats={procesosStats}
      formulaNamesByPartido={formulaNamesByPartido}
      presidentialByPartido={presidentialByPartido}
    />
  )
}
