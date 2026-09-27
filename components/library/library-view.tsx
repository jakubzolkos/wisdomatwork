'use client'

import { useMemo, useState, type ReactNode } from 'react'
import {
  ArrowDownAZ,
  ArrowDownWideNarrow,
  BookOpen,
  Check,
  FileText,
  Filter,
  Layers,
  LayoutGrid,
  Link2,
  List,
  PlayCircle,
  Search,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { AddResourceDialog } from '@/components/library/add-resource-dialog'
import { PageHeader } from '@/components/page-header'
// Lives in a leaf module so AddResourceDialog can also import it
// without creating a circular dependency on this file (which would
// throw a TDZ ReferenceError at module evaluation time).
import { PWF_PROTOCOLS_LABEL } from '@/lib/library/labels'

/**
 * Shape returned by the server page after cohort gating. The server
 * keeps two slices (cohort-gated + universal) and hands both to this
 * client view; the tab bar drives which slice is rendered.
 */
export interface LibraryResource {
  id: string
  title: string
  /**
   * Display attribution (book author, video creator, podcast host).
   * Required for new rows; nullable here only because legacy rows
   * created before migration 043 may still carry a NULL value.
   */
  author: string | null
  description: string | null
  url: string
  resourceType: 'document' | 'video' | 'link' | 'reading'
  tags: string[]
  /** Which cohorts the row was released for. Empty for legacy rows. */
  cohorts: string[]
  /** True when the row lives on the Further Reading tab. */
  isUniversal: boolean
  /** ISO timestamp; null when the underlying row is missing one. */
  createdAt: string | null
  /** Public URL of the cover image. Null falls back to a type-icon panel. */
  coverUrl: string | null
}

export interface LibraryViewProps {
  /** Cohort-gated resources, already filtered by cumulative access. */
  myResources: LibraryResource[]
  /** Universal "Further Reading" resources, visible to everyone. */
  furtherReading: LibraryResource[]
  /** Whether to render the admin-only "Add resource" affordance. */
  canManage: boolean
  /**
   * Whether to render the per-card "Cohort A / B / C" badges. Admin-
   * only - cohort labels are program-internal staging metadata, not
   * something fellows should see surfaced on every resource. The
   * server passes this in based on `user.role === 'admin'`.
   */
  showCohort?: boolean
}

type TypeFilter = 'all' | 'document' | 'video' | 'link' | 'reading'
type SortMode = 'newest' | 'alpha'
type TabId = 'mine' | 'further'

/** Keep label + icon decisions in one place so cards and filters
 *  stay consistent without prop-drilling. Labels are ReactNode so
 *  "PWF Protocols" can render its TM as a real <sup>. */
const TYPE_META: Record<
  LibraryResource['resourceType'],
  { label: ReactNode; Icon: typeof FileText; cta: string }
> = {
  // The legacy enum values stay (`document` / `link` / `video` /
  // `reading`) so the DB / CHECK constraint don't have to move.
  // Only the user-visible labels change:
  //   document -> PWF Protocols, link -> Field Guides.
  document: { label: PWF_PROTOCOLS_LABEL, Icon: FileText,   cta: 'Open' },
  link:     { label: 'Field Guides',      Icon: Link2,      cta: 'Open' },
  video:    { label: 'Video',             Icon: PlayCircle, cta: 'Watch' },
  reading:  { label: 'Reading',           Icon: BookOpen,   cta: 'Read' },
}

// Filter pills for Recommended Resources (Further Reading):
// Only show Reading, Video, and Audio options
const RECOMMENDED_TYPE_FILTERS: Array<{ id: TypeFilter; label: ReactNode }> = [
  { id: 'all',     label: 'All' },
  { id: 'video',   label: 'Video' },
  { id: 'reading', label: 'Reading' },
]

// Filter pill order matches the user's preferred reading order:
// All, PWF Protocols, Field Guides, Video, Readings.
const TYPE_FILTERS: Array<{ id: TypeFilter; label: ReactNode }> = [
  { id: 'all',      label: 'All' },
  { id: 'document', label: PWF_PROTOCOLS_LABEL },
  { id: 'link',     label: 'Field Guides' },
  { id: 'video',    label: 'Video' },
  { id: 'reading',  label: 'Reading' },
]

export function LibraryView({
  myResources,
  furtherReading,
  canManage,
  showCohort = false,
}: LibraryViewProps) {
  const [tab, setTab] = useState<TabId>('mine')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [tagFilter, setTagFilter] = useState<string[]>([])
  const [sort, setSort] = useState<SortMode>('newest')
  const [query, setQuery] = useState('')

  // The active tab decides which slice we filter against. We keep
  // the search/filter state shared across tabs because the user is
  // usually looking for a single thing; switching tabs preserves
  // the narrowing they've already typed.
  const activeSource =
    tab === 'mine' ? myResources : furtherReading

  // Tags are derived from the visible slice so the dropdown only
  // ever offers tags that can actually narrow the result set.
  const availableTags = useMemo(() => {
    const set = new Set<string>()
    for (const r of activeSource) for (const t of r.tags) set.add(t)
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [activeSource])

  // Three-stage transformation: filter -> search -> sort. Memoised
  // on inputs only so the table doesn't re-render when an unrelated
  // piece of state (e.g. the dialog) toggles.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = activeSource

    if (typeFilter !== 'all') {
      list = list.filter((r) => r.resourceType === typeFilter)
    }

    if (tagFilter.length > 0) {
      // OR semantics: a row matches if ANY of its tags is in the
      // selected set. This is the friendlier default - users tend
      // to read multi-select tag pickers as "show me anything in
      // these buckets" rather than "show me items at the
      // intersection of these buckets".
      const want = new Set(tagFilter)
      list = list.filter((r) => r.tags.some((t) => want.has(t)))
    }

    if (q) {
      list = list.filter((r) => {
        const hay = (
          r.title +
          ' ' +
          (r.description ?? '') +
          ' ' +
          r.tags.join(' ')
        ).toLowerCase()
        return hay.includes(q)
      })
    }

    return [...list].sort((a, b) => {
      if (sort === 'alpha') {
        return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
      }
      // newest first
      const at = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return bt - at
    })
  }, [activeSource, typeFilter, tagFilter, sort, query])

  function toggleTag(tag: string) {
    setTagFilter((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header: title, subtitle, admin Add button */}
      <PageHeader
        className="mb-2"
        title="Library"
        description="Curated books, videos, podcasts, and other resources. Use the tabs to switch between your cohort resources and recommended resources."
        actions={canManage ? <AddResourceDialog /> : undefined}
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)} className="flex flex-col gap-6">
        <TabsList className="grid h-10 w-full grid-cols-2 rounded-lg border border-border bg-muted/70 p-1 sm:inline-grid sm:w-auto">
          <TabsTrigger
            value="mine"
            className="gap-2 px-4 text-muted-foreground hover:text-foreground data-[state=active]:text-foreground data-[state=active]:shadow-xs"
          >
            My Resources
            <span className="rounded-full bg-muted px-1.5 py-px text-[11px] font-medium tabular-nums text-muted-foreground">
              {myResources.length}
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="further"
            className="gap-2 px-4 text-muted-foreground hover:text-foreground data-[state=active]:text-foreground data-[state=active]:shadow-xs"
          >
            <span className="sm:hidden">Recommended</span>
            <span className="hidden sm:inline">Recommended Resources</span>
            <span className="rounded-full bg-muted px-1.5 py-px text-[11px] font-medium tabular-nums text-muted-foreground">
              {furtherReading.length}
            </span>
          </TabsTrigger>
        </TabsList>

        {/* Per-tab caption strip. Sits between the tab list and the
            search/filter row so the user always has a one-line frame
            for the slice they're looking at. The two tabs explain
            very different things - cohort-gated progress materials
            vs. universal extended-learning - and a contextual
            caption keeps the toggle from feeling arbitrary. */}
        <p
          className="-mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground"
          aria-live="polite"
        >
          {tab === 'mine'
            ? 'Resources released to your cohort - books, videos, podcasts, and other materials tied to the labs you are working through right now.'
            : 'Curated books, videos, podcasts, and other recommendations from the program team. These materials sit alongside the curriculum and are available to every fellow, regardless of cohort or pace.'}
        </p>

        {/* Search + filter row. Visible on both tabs since the state
            is shared. */}
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title, description, or tag..."
              aria-label="Search the library"
              className="h-10 bg-card pl-9 shadow-xs"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              role="tablist"
              aria-label="Filter by type"
              className="flex flex-wrap items-center gap-1.5"
            >
              {(tab === 'further' ? RECOMMENDED_TYPE_FILTERS : TYPE_FILTERS).map((f) => {
                const active = typeFilter === f.id
                return (
                  <button
                    key={f.id}
                    role="tab"
                    aria-selected={active}
                    onClick={() => setTypeFilter(f.id)}
                    className={cn(
                      'inline-flex h-8 items-center rounded-full border px-3.5 text-sm font-medium transition-colors',
                      active
                        ? 'border-primary/25 bg-primary-soft text-primary'
                        : 'border-border bg-card text-muted-foreground hover:border-border-strong hover:bg-accent hover:text-foreground',
                    )}
                  >
                    {f.label}
                  </button>
                )
              })}
            </div>

            <div className="flex items-center gap-2">
              <TagFilterPopover
                available={availableTags}
                selected={tagFilter}
                onToggle={toggleTag}
                onClear={() => setTagFilter([])}
              />
              <SortToggle value={sort} onChange={setSort} />
              <div
                role="group"
                aria-label="View mode"
                className="inline-flex h-8 items-center rounded-md border border-border bg-card p-0.5 shadow-xs"
              >
                <ViewToggleButton
                  active={view === 'grid'}
                  onClick={() => setView('grid')}
                  label="Grid view"
                  Icon={LayoutGrid}
                />
                <ViewToggleButton
                  active={view === 'list'}
                  onClick={() => setView('list')}
                  label="List view"
                  Icon={List}
                />
              </div>
            </div>
          </div>

          {/* Selected tag chips, with quick-remove. Mirrors the
              popover state so users always know what's narrowing
              the results without opening the dropdown. */}
          {tagFilter.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Filtering by:</span>
              {tagFilter.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTag(t)}
                  className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/15"
                  aria-label={`Remove tag ${t}`}
                >
                  {t}
                  <span aria-hidden="true">×</span>
                </button>
              ))}
              {tagFilter.length > 1 && (
                <button
                  type="button"
                  onClick={() => setTagFilter([])}
                  className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                >
                  Clear all
                </button>
              )}
            </div>
          )}
        </div>

        {/* Same results body for both tabs - the active source is
            already swapped at the top of this component. */}
        <TabsContent value="mine" className="mt-0">
          <ResultsBody
            tab="mine"
            view={view}
            filtered={filtered}
            totalForTab={myResources.length}
            query={query}
            typeFilter={typeFilter}
            tagFilter={tagFilter}
            showCohort={showCohort}
          />
        </TabsContent>
        <TabsContent value="further" className="mt-0">
          <ResultsBody
            tab="further"
            view={view}
            filtered={filtered}
            totalForTab={furtherReading.length}
            query={query}
            typeFilter={typeFilter}
            tagFilter={tagFilter}
            showCohort={showCohort}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ResultsBody({
  tab,
  view,
  filtered,
  totalForTab,
  query,
  typeFilter,
  tagFilter,
  showCohort,
}: {
  tab: TabId
  view: 'grid' | 'list'
  filtered: LibraryResource[]
  totalForTab: number
  query: string
  typeFilter: TypeFilter
  tagFilter: string[]
  showCohort: boolean
}) {
  if (filtered.length === 0) {
    return (
      <EmptyState
        tab={tab}
        query={query}
        typeFilter={typeFilter}
        tagFilter={tagFilter}
        totalForTab={totalForTab}
      />
    )
  }
  if (view === 'grid') {
    // Denser grid: 2 columns on phones, 3 on tablets, 4 on desktop.
    // Smaller per-card footprint so curated stacks read as a wall
    // of options rather than three giant tiles.
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        {filtered.map((r) => (
          <GridCard key={r.id} resource={r} showCohort={showCohort} />
        ))}
      </div>
    )
  }
  return (
    <ul className="flex flex-col gap-2">
      {filtered.map((r) => (
        <ListRow key={r.id} resource={r} showCohort={showCohort} />
      ))}
    </ul>
  )
}

function ViewToggleButton({
  active,
  onClick,
  label,
  Icon,
}: {
  active: boolean
  onClick: () => void
  label: string
  Icon: typeof LayoutGrid
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      className={cn(
        'inline-flex h-full w-7 items-center justify-center rounded-sm transition-colors',
        active
          ? 'bg-primary-soft text-primary'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}

function SortToggle({
  value,
  onChange,
}: {
  value: SortMode
  onChange: (next: SortMode) => void
}) {
  // Two-state pill button: clicking flips sort. Compact enough to
  // sit beside the view toggle without crowding the bar; the icon
  // changes to communicate the active mode.
  const isAlpha = value === 'alpha'
  return (
    <button
      type="button"
      onClick={() => onChange(isAlpha ? 'newest' : 'alpha')}
      aria-label={`Sort: ${isAlpha ? 'A to Z' : 'Newest first'} (click to switch)`}
      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-sm text-muted-foreground shadow-xs transition-colors hover:bg-accent hover:text-foreground"
    >
      {isAlpha ? (
        <ArrowDownAZ className="h-4 w-4" aria-hidden="true" />
      ) : (
        <ArrowDownWideNarrow className="h-4 w-4" aria-hidden="true" />
      )}
      <span className="hidden sm:inline">{isAlpha ? 'A–Z' : 'Newest'}</span>
    </button>
  )
}

function TagFilterPopover({
  available,
  selected,
  onToggle,
  onClear,
}: {
  available: string[]
  selected: string[]
  onToggle: (tag: string) => void
  onClear: () => void
}) {
  // When there are no tags on any visible row the dropdown becomes
  // a no-op, so we render it disabled rather than pop up an empty
  // panel. Common case once the library has just a few items.
  const empty = available.length === 0
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={empty}
          className="inline-flex h-8 items-center gap-1.5 px-2.5"
          aria-label="Filter by tag"
        >
          <Filter className="h-4 w-4" />
          <span className="hidden sm:inline">Tags</span>
          {selected.length > 0 && (
            <Badge
              variant="secondary"
              className="ml-1 h-5 min-w-[20px] justify-center px-1 text-[10px]"
            >
              {selected.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-xs font-medium text-foreground">
            Filter by tag
          </span>
          {selected.length > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              Clear
            </button>
          )}
        </div>
        <ul className="max-h-64 overflow-y-auto p-1" role="listbox">
          {available.map((tag) => {
            const active = selected.includes(tag)
            return (
              <li key={tag}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => onToggle(tag)}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent',
                    active && 'bg-primary-soft text-primary',
                  )}
                >
                  <span className="truncate">{tag}</span>
                  {active && (
                    <Check
                      className="h-3.5 w-3.5 text-primary"
                      aria-hidden="true"
                    />
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

/** Compact card surfaced in grid view - the primary library
 *  affordance. The cover image is the visual anchor; when missing,
 *  we render an icon-tinted panel so the layout stays uniform across
 *  the grid (no "some cards have an image, some are blank text"). */
function GridCard({
  resource,
  showCohort,
}: {
  resource: LibraryResource
  showCohort: boolean
}) {
  const meta = TYPE_META[resource.resourceType]
  const Icon = meta.Icon

  return (
    <a
      href={resource.url}
      target="_blank"
      rel="noreferrer"
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs transition hover:border-border-strong hover:shadow-md"
    >
      {/* Hero: cover image or icon fallback. We use object-contain
          inside a generously-padded muted frame so the entire cover
          (book jacket, landscape thumbnail, square logo, whatever)
          is shown in full without cropping. The padding creates a
          deliberate matte "border" around the artwork - the framed
          look the curator preferred over edge-to-edge bleed. The
          fixed 4:5 portrait wrapper keeps every tile aligned no
          matter the source image's aspect. */}
      <div className="relative aspect-[4/5] w-full overflow-hidden border-b border-border bg-muted/60">
        {resource.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resource.coverUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-contain p-3 transition-transform duration-300 group-hover:scale-[1.02]"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center">
            <span className="flex size-12 items-center justify-center rounded-xl bg-card text-muted-foreground shadow-xs">
              <Icon className="size-5" aria-hidden="true" />
            </span>
          </div>
        )}
        <Badge
          variant="secondary"
          className="absolute left-2.5 top-2.5 border-border bg-card/95 text-[11px] font-medium text-foreground shadow-xs backdrop-blur"
        >
          <Icon className="mr-1 h-3 w-3" aria-hidden="true" />
          {meta.label}
        </Badge>
      </div>

      {/* Compacter padding so 4-up doesn't feel cramped despite
          smaller cells. */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-1 flex-col gap-1">
          <h3 className="line-clamp-2 text-[15px] leading-snug text-foreground transition-colors group-hover:text-primary">
            {resource.title}
          </h3>
          {/* Author byline. Sits directly under the title (book-jacket
              convention) so attribution reads as part of the resource
              identity, not as metadata. Hidden when the row predates
              migration 043 and has no author recorded. */}
          {resource.author && (
            <p className="text-xs text-muted-foreground">
              by {resource.author}
            </p>
          )}
          {resource.description && (
            <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
              {resource.description}
            </p>
          )}
        </div>

        {showCohort && <CohortBadgeRow resource={resource} />}

        {resource.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {/* Cap at 3 tags now that cards are narrower - more than
                that wraps to a third row and breaks the rhythm. */}
            {resource.tags.slice(0, 3).map((t) => (
              <Badge key={t} variant="secondary" className="text-[11px] font-normal">
                {t}
              </Badge>
            ))}
          </div>
        )}

      </div>
    </a>
  )
}

/** Dense one-per-row layout used by the List view. Renders a small
 *  thumbnail using the same cover image so users get a consistent
 *  visual cue regardless of which view mode they prefer. */
function ListRow({
  resource,
  showCohort,
}: {
  resource: LibraryResource
  showCohort: boolean
}) {
  const meta = TYPE_META[resource.resourceType]
  const Icon = meta.Icon

  return (
    <li>
      <a
        href={resource.url}
        target="_blank"
        rel="noreferrer"
        className="group flex items-start gap-4 rounded-xl border border-border bg-card p-4 shadow-xs transition hover:border-border-strong hover:shadow-md"
      >
        {/* Portrait thumbnail mirrors the 3:4 hero used by the grid
            cards so users see the same orientation regardless of
            view mode. */}
        <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-md border border-border bg-muted/60">
          {resource.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={resource.coverUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center">
              <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <h3 className="text-[15px] leading-snug text-foreground transition-colors group-hover:text-primary">
              {resource.title}
            </h3>
            <Badge variant="outline" className="text-[11px] font-medium text-muted-foreground">
              {meta.label}
            </Badge>
            {showCohort && <CohortBadgeRow resource={resource} compact />}
          </div>
          {/* Compact byline sits between the title row and the
              description. We tuck it into the same horizontal flow as
              the description on dense lists so authorship is always
              one glance away from the title. */}
          {resource.author && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              by {resource.author}
            </p>
          )}
          {resource.description && (
            <p className="mt-1 line-clamp-1 text-sm leading-relaxed text-muted-foreground">
              {resource.description}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {resource.tags.slice(0, 4).map((t) => (
              <Badge key={t} variant="secondary" className="text-[11px] font-normal">
                {t}
              </Badge>
            ))}
          </div>
        </div>
        {/* No trailing "Open" button - the entire row is a link, so
            a duplicated CTA would just be visual noise. */}
      </a>
    </li>
  )
}

/** Cohort label chips. Suppressed for universal rows because every
 *  Further Reading item is, by definition, visible to all cohorts -
 *  the chips would just be noise. Cohort-gated rows render one chip
 *  per assigned label (A / B / C). */
function CohortBadgeRow({
  resource,
  compact = false,
}: {
  resource: LibraryResource
  compact?: boolean
}) {
  if (resource.isUniversal) return null
  if (resource.cohorts.length === 0) return null
  return (
    <div className={cn('flex flex-wrap gap-1.5', compact && 'inline-flex')}>
      {resource.cohorts.map((c) => (
        <Badge
          key={c}
          variant="outline"
          className="text-[11px] font-medium text-muted-foreground"
        >
          Cohort {c}
        </Badge>
      ))}
    </div>
  )
}

function EmptyState({
  tab,
  query,
  typeFilter,
  tagFilter,
  totalForTab,
}: {
  tab: TabId
  query: string
  typeFilter: TypeFilter
  tagFilter: string[]
  totalForTab: number
}) {
  // Three subtly-different empty messages keep the page from
  // misleading users. The first message wins so we order from most-
  // specific (active narrowing) to least (genuinely empty tab).
  const isNarrowing =
    !!query.trim() || typeFilter !== 'all' || tagFilter.length > 0

  let message: string
  if (totalForTab === 0) {
    message =
      tab === 'mine'
          ? 'No cohort resources have been published for you yet. Check back soon, or try Recommended Resources.'
        : "There's no recommended reading yet. New resources will show up here when published."
  } else if (isNarrowing) {
    message =
      'No resources match your current filters. Try clearing a filter or searching for something else.'
  } else {
    message = 'No resources to show.'
  }

  return (
    <div className="rounded-xl border border-dashed border-border-strong p-10 text-center">
      <span className="mx-auto flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
        <Layers className="size-[18px]" aria-hidden="true" />
      </span>
      <p className="mx-auto mt-4 max-w-md text-sm text-muted-foreground">{message}</p>

    </div>
  )
}
