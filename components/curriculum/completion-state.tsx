'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

/**
 * Optimistic completion state shared by everything in the curriculum
 * layout (sidebar radios, progress counts, the item footer), so a tick
 * in one place shows everywhere at once.
 *
 * An override is the value the fellow just chose. It stays until the
 * server-rendered value catches up and agrees, instead of being
 * dropped when the request finishes: the action resolves before
 * router.refresh() delivers new props, and dropping it then made the
 * tick flicker back for a moment.
 */
type Overrides = ReadonlyMap<string, boolean>

const CompletionContext = createContext<{
  overrides: Overrides
  setOverride: (id: string, value: boolean | null) => void
} | null>(null)

export function CompletionStateProvider({ children }: { children: React.ReactNode }) {
  const [overrides, setOverrides] = useState<Overrides>(new Map())
  const setOverride = useCallback((id: string, value: boolean | null) => {
    setOverrides((prev) => {
      if (value === null ? !prev.has(id) : prev.get(id) === value) return prev
      const next = new Map(prev)
      if (value === null) next.delete(id)
      else next.set(id, value)
      return next
    })
  }, [])
  const value = useMemo(() => ({ overrides, setOverride }), [overrides, setOverride])
  return <CompletionContext.Provider value={value}>{children}</CompletionContext.Provider>
}

/** Effective completion for any item: the pending choice, else the server value. */
export function useCompletionLookup(): (id: string, serverValue: boolean) => boolean {
  const ctx = useContext(CompletionContext)
  return useCallback(
    (id, serverValue) => ctx?.overrides.get(id) ?? serverValue,
    [ctx],
  )
}

/**
 * Completion for one item. `set` records the fellow's choice, `reset`
 * drops it (when the server refuses). Works without the provider too,
 * with state local to the component.
 */
export function useCompletion(contentId: string, serverValue: boolean) {
  const ctx = useContext(CompletionContext)
  const [local, setLocal] = useState<boolean | null>(null)
  const override = ctx ? (ctx.overrides.get(contentId) ?? null) : local
  const write = useCallback(
    (value: boolean | null) => (ctx ? ctx.setOverride(contentId, value) : setLocal(value)),
    [ctx, contentId],
  )

  // The server agrees now: the override has done its job.
  useEffect(() => {
    if (override !== null && override === serverValue) write(null)
  }, [override, serverValue, write])

  return {
    completed: override ?? serverValue,
    set: useCallback((value: boolean) => write(value), [write]),
    reset: useCallback(() => write(null), [write]),
  }
}
