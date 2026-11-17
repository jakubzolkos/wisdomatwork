'use server'

import { requireUser } from '@/lib/auth-server'
import { fellowCanAccess } from '@/lib/cohorts'
import { createClient } from '@/lib/supabase/server'

export interface MyResourcesPwfProtocol {
  id: string
  title: string
}

/**
 * Load PWF Protocols specifically from the user's cohort-gated "My Resources"
 * instead of universal resources. This allows fellows to reference protocols
 * shared within their school's cohort context.
 *
 * Filters to:
 * - Cohort-gated resources (is_universal = false)
 * - Type = 'document' (PWF Protocols)
 * - User has access via fellowCanAccess (strict assignment, not cumulative)
 *
 * Returns sorted by title for a clean dropdown experience.
 */
export async function loadMyResourcesPwfProtocols(): Promise<
  MyResourcesPwfProtocol[]
> {
  const user = await requireUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('community_resources')
    .select('id, title, cohorts, is_universal')
    .eq('resource_type', 'document')
    .eq('is_universal', false)
    .eq('staff_only', false)
    .order('title', { ascending: true })

  if (error) {
    console.error('[v0] loadMyResourcesPwfProtocols error:', error.message)
    return []
  }

  const isFellow = user.role === 'fellow'

  // Filter by strict cohort assignment for fellows; staff see all
  const filtered = (data ?? []).filter((r) => {
    if (!isFellow) return true
    // Strict assignment: fellow only sees if their cohort is explicitly assigned
    return fellowCanAccess(
      (r.cohorts as string[] | null) ?? null,
      user.cohort ?? null,
    )
  })

  return filtered.map((row) => ({
    id: row.id,
    title: row.title,
  }))
}
