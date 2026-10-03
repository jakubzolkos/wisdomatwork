'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CompletionRadio } from './completion-radio'
import type { CurriculumItem, CurriculumPhase } from '@/lib/curriculum-tree'
import { getCategory, type ContentCategory } from '@/lib/curriculum'

/**
 * Categories that map to the lab session structure. Items in these
 * buckets get a small eyebrow heading inside the module.
 * Order here is the order they're rendered.
 */
const LAB_CATEGORIES: readonly ContentCategory[] = [
  'before_lab',
  'during_lab',
  'after_lab',
] as const
const LAB_CATEGORY_SET = new Set<ContentCategory>(LAB_CATEGORIES)

/**
 * Split a module's items into the three lab buckets plus an "other"
 * bucket for everything else. Returns groups in render order.
 *
 * Lab buckets that end up empty are dropped so we never render an
 * orphan heading. The "other" bucket has no heading - those items
 * just render as a flat list (per design: "if it is any other
 * category, just display it like that").
 */
function groupItemsByCategory(items: readonly CurriculumItem[]) {
  const buckets = new Map<ContentCategory, CurriculumItem[]>()
  const other: CurriculumItem[] = []
  for (const it of items) {
    if (LAB_CATEGORY_SET.has(it.category)) {
      const list = buckets.get(it.category) ?? []
      list.push(it)
      buckets.set(it.category, list)
    } else {
      other.push(it)
    }
  }
  return {
    labGroups: LAB_CATEGORIES.flatMap((cat) => {
      const list = buckets.get(cat)
      return list && list.length > 0 ? [{ category: cat, items: list }] : []
    }),
    other,
  }
}

interface Props {
  phases: CurriculumPhase[]
}

function formatDuration(mins: number | null): string | null {
  if (!mins || mins <= 0) return null
  if (mins < 60) return `${mins}min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `${h}h` : `${h}h ${m}min`
}

/**
 * Fully collapsible curriculum tree. Phases collapse to show modules,
 * modules collapse to show content items. Only content items are
 * navigable links - phase and module headers are pure expand/collapse
 * toggles.
 *
 * Layout (mirrors the design brief):
 *   <Phase title>                              <-- toggle
 *     1. Module title                          <-- toggle
 *        [radio]  Item title
 *                 55min
 *        [radio]  Item title
 *                 20min
 *     2. Module title                          <-- toggle
 *
 * The first phase is open on first paint so fellows immediately see
 * something. When the URL hash points at a phase (#phase-{id}) we
 * expand and scroll to it - that's how the global sidebar's phase
 * links route to the dashboard tree.
 */
export function CurriculumTree({ phases }: Props) {
  const pathname = usePathname()

  // Derive the active item from the path (works when the tree lives
  // alongside a content viewer, though today it only renders on the
  // dashboard).
  const activeItemId = useMemo(() => {
    const match = pathname?.match(
      /^\/phases\/[^/]+\/modules\/[^/]+\/items\/([^/]+)/,
    )
    return match?.[1] ?? null
  }, [pathname])

  // Open-state is keyed by id so phases and modules share the same
  // Set. Strings collide-free because uuids never look like one
  // another.
  const initialOpen = useMemo(() => {
    const set = new Set<string>()
    if (phases.length > 0) {
      const first = phases[0]
      set.add(first.id)
      // Open the first module too so the very first paint shows the
      // same hierarchy as the design brief.
      if (first.modules.length > 0) set.add(first.modules[0].id)
    }
    return set
  }, [phases])

  const [openIds, setOpenIds] = useState<Set<string>>(initialOpen)

  // Auto-expand the phase + module that contain the active item.
  // Runs whenever the URL changes (back/forward, deep-link, or
  // sibling navigation in the layout) so the user always sees
  // their place in the tree. Wrapped in setOpenIds(prev=>...) so
  // we never clobber phases the user has manually expanded.
  useEffect(() => {
    if (!activeItemId) return
    for (const phase of phases) {
      for (const mod of phase.modules) {
        if (mod.items.some((it) => it.id === activeItemId)) {
          setOpenIds((prev) => {
            if (prev.has(phase.id) && prev.has(mod.id)) return prev
            const next = new Set(prev)
            next.add(phase.id)
            next.add(mod.id)
            return next
          })
          return
        }
      }
    }
  }, [activeItemId, phases])

  // If the URL hash points at a phase (e.g. #phase-abc), open and
  // scroll to it. Runs once after mount and any time the hash
  // changes - used by deep-links from the global sidebar.
  useEffect(() => {
    function applyHash() {
      const hash = window.location.hash.replace(/^#/, '')
      if (!hash) return
      const phaseMatch = hash.match(/^phase-(.+)$/)
      if (!phaseMatch) return
      const phaseId = phaseMatch[1]
      setOpenIds((prev) => {
        if (prev.has(phaseId)) return prev
        const next = new Set(prev)
        next.add(phaseId)
        return next
      })
      // Defer scroll so the phase is rendered open first.
      requestAnimationFrame(() => {
        document
          .getElementById(`phase-${phaseId}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    }
    applyHash()
    window.addEventListener('hashchange', applyHash)
    return () => window.removeEventListener('hashchange', applyHash)
  }, [])

  function toggle(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (phases.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
        No curriculum is available yet.
      </p>
    )
  }

  return (
    <nav aria-label="Curriculum" className="flex flex-col gap-3">
      {phases.map((phase) => {
        // Locked phases render as a flat, non-interactive stub:
        // no children loaded, no toggle, just a clear "you don't
        // have access yet" affordance. Fellows still see the phase
        // exists so they know the rest of the program is coming.
        if (phase.isLocked) {
          return (
            <section
              key={phase.id}
              id={`phase-${phase.id}`}
              aria-label={`${phase.title} (locked)`}
              className="rounded-lg border border-dashed border-border bg-muted/30"
            >
              <div className="flex w-full items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <h3 className="font-serif text-xl leading-tight text-muted-foreground">
                    {phase.title}
                  </h3>
                </div>
                {/* Icon-only lock affordance. The label "Locked"
                    is exposed to screen readers via aria-label /
                    title - sighted users just see the icon. */}
                <span
                  className="inline-flex shrink-0 items-center justify-center rounded-md bg-muted p-1.5 text-muted-foreground"
                  title="Locked"
                  aria-label="Locked"
                >
                  <Lock className="h-4 w-4" aria-hidden="true" />
                </span>
              </div>
            </section>
          )
        }

        const phaseOpen = openIds.has(phase.id)
        return (
          <section
            key={phase.id}
            id={`phase-${phase.id}`}
            className="rounded-lg border border-border bg-card"
          >
            {/* Phase header (collapse toggle, not a link) */}
            <button
              type="button"
              onClick={() => toggle(phase.id)}
              aria-expanded={phaseOpen}
              aria-controls={`phase-${phase.id}-body`}
              className="flex w-full items-center justify-between gap-3 rounded-lg px-5 py-4 text-left transition-colors hover:bg-muted/40"
            >
              <div className="min-w-0 flex-1">
                <h3 className="font-serif text-xl leading-tight text-foreground">
                  {phase.title}
                </h3>
                {phase.description && (
                  <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                    {phase.description}
                  </p>
                )}
                {phase.itemCount > 0 && (
                  <div
                    className="mt-3 h-1 w-full overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-label={`${phase.title} progress`}
                    aria-valuemin={0}
                    aria-valuemax={phase.itemCount}
                    aria-valuenow={phase.completedCount}
                  >
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-500"
                      style={{
                        width: `${Math.round((phase.completedCount / phase.itemCount) * 100)}%`,
                      }}
                    />
                  </div>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-3 self-start text-xs text-muted-foreground">
                {phase.itemCount > 0 && (
                  <span>
                    {phase.completedCount}/{phase.itemCount}
                  </span>
                )}
                <ChevronDown
                  className={cn(
                    'h-4 w-4 transition-transform',
                    phaseOpen ? 'rotate-0' : '-rotate-90',
                  )}
                  aria-hidden="true"
                />
              </div>
            </button>

            {phaseOpen && (
              <div
                id={`phase-${phase.id}-body`}
                className="border-t border-border px-3 pb-3 pt-2"
              >
                {phase.modules.length === 0 ? (
                  <p className="px-2 py-4 text-center text-sm italic text-muted-foreground">
                    No modules yet.
                  </p>
                ) : (
                  <ul className="flex flex-col">
                    {phase.modules.map((module, idx) => {
                      const moduleOpen = openIds.has(module.id)
                      const headerLabel = `${idx + 1}. ${module.title}`
                      // Sequence-locked: a flat, non-interactive row
                      // saying what to finish first. Its items aren't
                      // linked so fellows can't open them early.
                      if (module.isLocked) {
                        return (
                          <li
                            key={module.id}
                            className="border-t border-border first:border-t-0"
                            aria-label={`${headerLabel} (locked)`}
                          >
                            <div className="flex w-full items-start justify-between gap-3 px-3 py-3 text-sm">
                              <span className="min-w-0">
                                <span className="block truncate font-semibold text-muted-foreground">
                                  {headerLabel}
                                </span>
                                {module.blockedBy && (
                                  <span className="mt-0.5 block text-xs text-muted-foreground">
                                    Complete {module.blockedBy} to unlock
                                  </span>
                                )}
                              </span>
                              <Lock
                                className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                                aria-hidden="true"
                              />
                            </div>
                          </li>
                        )
                      }
                      return (
                        <li
                          key={module.id}
                          className="border-t border-border first:border-t-0"
                        >
                          {/* Module header */}
                          <button
                            type="button"
                            onClick={() => toggle(module.id)}
                            aria-expanded={moduleOpen}
                            aria-controls={`module-${module.id}`}
                            className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-3 text-left text-sm font-semibold text-foreground transition-colors hover:bg-muted/60"
                          >
                            <span className="min-w-0 truncate">
                              {headerLabel}
                            </span>
                            <ChevronDown
                              className={cn(
                                'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                                moduleOpen ? 'rotate-0' : '-rotate-90',
                              )}
                              aria-hidden="true"
                            />
                          </button>

                          {moduleOpen && (
                            <ModuleBody
                              moduleId={module.id}
                              items={module.items}
                              activeItemId={activeItemId}
                            />
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )}
          </section>
        )
      })}
    </nav>
  )
}

/**
 * Inner body of an open module. Splits items into Before / During /
 * After Lab groups (each with an eyebrow heading) and a
 * trailing flat list for any other category. Empty groups are
 * skipped so headings only appear when there are items beneath them.
 */
function ModuleBody({
  moduleId,
  items,
  activeItemId,
}: {
  moduleId: string
  items: readonly CurriculumItem[]
  activeItemId: string | null
}) {
  if (items.length === 0) {
    return (
      <ul
        id={`module-${moduleId}`}
        className="flex flex-col pb-2"
      >
        <li className="px-3 py-3 text-xs italic text-muted-foreground">
          No content yet.
        </li>
      </ul>
    )
  }

  const { labGroups, other } = groupItemsByCategory(items)

  return (
    <div id={`module-${moduleId}`} className="flex flex-col gap-3 pb-2 pt-1">
      {labGroups.map((group) => (
        <div key={group.category} className="flex flex-col">
          {/* Stage label (Before / During / After the Lab). */}
          <p className="px-3 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {getCategory(group.category).label}
          </p>
          <ul className="flex flex-col">
            {group.items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                isActive={activeItemId === item.id}
              />
            ))}
          </ul>
        </div>
      ))}

      {other.length > 0 && (
        // Items in non-lab categories render as a plain flat list,
        // no heading - per design spec these "just display like
        // that".
        <ul className="flex flex-col">
          {other.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              isActive={activeItemId === item.id}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function ItemRow({
  item,
  isActive,
}: {
  item: CurriculumItem
  isActive: boolean
}) {
  const duration = formatDuration(item.durationMinutes)
  return (
    <li>
      <Link
        href={item.href}
        className={cn(
          'flex items-start gap-3 rounded-md px-3 py-2.5 transition-colors',
          isActive ? 'bg-muted' : 'hover:bg-muted/40',
        )}
      >
        <span className="mt-0.5">
          <CompletionRadio
            contentId={item.id}
            isCompleted={item.isCompleted}
            itemTitle={item.title}
          />
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              'block text-sm leading-snug text-foreground',
              isActive && 'font-medium',
            )}
          >
            {item.title}
          </span>
          {duration && (
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {duration}
            </span>
          )}
        </span>
      </Link>
    </li>
  )
}
