/**
 * Sequential module unlocking - the one place the rule lives.
 *
 * Within a phase, modules are walked in display order. A module that
 * is part of the sequence (`isSequential`) is locked while any earlier
 * sequential module in the same phase is incomplete. Modules outside
 * the sequence are always open and never block anything.
 *
 * A module is complete when every item the fellow can see in it is
 * complete. An empty module counts as complete so it never blocks.
 *
 * Pure (no I/O) so the tree loader, item page, server actions and the
 * stored-file route all evaluate exactly the same thing.
 */

export interface LockInputModule {
  id: string
  title: string
  isSequential: boolean
  items: ReadonlyArray<{ isCompleted: boolean }>
}

export interface ModuleLock {
  isLocked: boolean
  /** Title of the module that has to be finished first, when locked. */
  blockedBy: string | null
}

export function computeModuleLocks(
  modules: ReadonlyArray<LockInputModule>,
): Map<string, ModuleLock> {
  const locks = new Map<string, ModuleLock>()
  // The first unfinished sequential module; everything sequential
  // after it is locked behind it.
  let blocker: LockInputModule | null = null

  for (const m of modules) {
    if (!m.isSequential) {
      locks.set(m.id, { isLocked: false, blockedBy: null })
      continue
    }
    if (blocker) {
      locks.set(m.id, { isLocked: true, blockedBy: blocker.title })
      continue
    }
    locks.set(m.id, { isLocked: false, blockedBy: null })
    if (!m.items.every((i) => i.isCompleted)) blocker = m
  }
  return locks
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
