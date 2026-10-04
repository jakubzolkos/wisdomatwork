/**
 * When a module opens for a fellow - the one place the rule lives.
 *
 * Primarily by DATE: a module with `opensAt` in the future is locked
 * until then (the program runs on its live-session calendar, so each
 * module opens right after the previous session ends). Completion
 * drives progress, not access, so missing one item never stalls a
 * fellow.
 *
 * Optionally by SEQUENCE: a module flagged `isSequential` is also
 * locked while an earlier sequential module in the phase is
 * incomplete (placeholder surveys with no link don't count). Off for
 * every module by default (065).
 *
 * Pure (no I/O) so the tree loader, item page, server actions and the
 * stored-file route all evaluate exactly the same thing.
 */

export interface LockInputModule {
  id: string
  title: string
  isSequential: boolean
  /** ISO time the module opens; null/undefined = open now. */
  opensAt?: string | null
  /** `isPending`: placeholder survey without a link; never blocks. */
  items: ReadonlyArray<{ isCompleted: boolean; isPending?: boolean }>
}

export interface ModuleLock {
  isLocked: boolean
  /** Set while the module's release date is still ahead. */
  opensAt: string | null
  /** Title of the module to finish first (sequential modules only). */
  blockedBy: string | null
}

export function computeModuleLocks(
  modules: ReadonlyArray<LockInputModule>,
  now: number = Date.now(),
): Map<string, ModuleLock> {
  const locks = new Map<string, ModuleLock>()
  // The first unfinished sequential module; sequential modules after
  // it are locked behind it.
  let blocker: LockInputModule | null = null

  for (const m of modules) {
    const release = m.opensAt ? new Date(m.opensAt).getTime() : NaN
    const opensAt = Number.isFinite(release) && release > now ? m.opensAt! : null
    const blockedBy = m.isSequential && blocker ? blocker.title : null
    locks.set(m.id, { isLocked: !!opensAt || !!blockedBy, opensAt, blockedBy })
    if (m.isSequential && !blocker && !m.items.every((i) => i.isCompleted || i.isPending)) {
      blocker = m
    }
  }
  return locks
}

/** "Jan 27" (Eastern time, the program's clock); adds the year when it isn't this year's. */
export function formatOpensAt(iso: string, now: Date = new Date()): string {
  const d = new Date(iso)
  const tz = 'America/New_York'
  const sameYear =
    d.toLocaleDateString('en-US', { year: 'numeric', timeZone: tz }) ===
    now.toLocaleDateString('en-US', { year: 'numeric', timeZone: tz })
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
    timeZone: tz,
  })
}

/** One line saying why a locked module is locked, e.g. "Opens Jan 27". */
export function lockReason(lock: Pick<ModuleLock, 'opensAt' | 'blockedBy'>): string {
  if (lock.opensAt) return `Opens ${formatOpensAt(lock.opensAt)}`
  if (lock.blockedBy) return `Complete ${lock.blockedBy} to unlock`
  return 'Not open yet'
}

/**
 * Whether a scheduled live session counts as complete without a
 * completion row: it has ended and doesn't require a reflection.
 * Mirrors the item page's auto-complete, but doesn't depend on the
 * fellow revisiting the page after the session.
 */
export function liveSessionHasEnded(
  item: {
    resource_type: string | null
    scheduled_at: string | null
    duration_minutes: number | null
    reflection_enabled: boolean
  },
  now: number = Date.now(),
): boolean {
  if (item.resource_type !== 'live_session' || !item.scheduled_at) return false
  if (item.reflection_enabled) return false
  const start = new Date(item.scheduled_at).getTime()
  if (!Number.isFinite(start)) return false
  return now >= start + (item.duration_minutes ?? 60) * 60 * 1000
}
