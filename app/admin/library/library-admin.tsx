'use client'

import { useMemo, useState, useTransition, type ReactNode } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  BookOpen,
  ExternalLink,
  FileText,
  Layers,
  Link2,
  Pencil,
  PlayCircle,
  Search,
  Trash2,
} from 'lucide-react'
import { deleteLibraryResource } from '@/app/resources/actions'
import { AddResourceDialog } from '@/components/library/add-resource-dialog'
import type { LibraryResource } from '@/components/library/library-view'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { PWF_PROTOCOLS_LABEL } from '@/lib/library/labels'

/**
 * Row shape accepted by the admin Library list. Matches
 * LibraryResource one-for-one so we can pass rows straight into
 * AddResourceDialog without a second mapping step.
 */
export type AdminLibraryRow = LibraryResource

/** Type icon + user-visible label - same source of truth as the
 *  fellow Library so the two surfaces stay consistent. */
const TYPE_META: Record<
  AdminLibraryRow['resourceType'],
  { label: ReactNode; Icon: typeof FileText }
> = {
  document: { label: PWF_PROTOCOLS_LABEL, Icon: FileText },
  link: { label: 'Field Guides', Icon: Link2 },
  video: { label: 'Video', Icon: PlayCircle },
  reading: { label: 'Readings', Icon: BookOpen },
}

interface Props {
  resources: AdminLibraryRow[]
}

/**
 * Admin-only catalogue view of Library resources.
 *
 * Two grouped lists, each rendered as a compact table-style row:
 *   1. Recommended Resources (`is_universal`) - books, videos,
 *      podcasts, and other materials surfaced to everyone.
 *   2. Cohort-gated, ordered by which cohorts they target.
 *
 * Each row exposes inline Edit + Delete affordances. Edit reuses
 * `AddResourceDialog` in controlled mode (`hideTrigger` + initial
 * row); Delete pops a confirm dialog and calls the server action.
 *
 * The "Add resource" button at the page header reuses the same
 * dialog in its uncontrolled / add mode.
 */
export function LibraryAdmin({ resources }: Props) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<AdminLibraryRow | null>(null)
  const [deleting, setDeleting] = useState<AdminLibraryRow | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deletePending, startDelete] = useTransition()

  // Light free-text search across title / description / tags so an
  // admin curating a large library can find a specific row without
  // scrolling. Searching applies to both groups simultaneously.
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return resources
    return resources.filter((r) => {
      const hay = (
        r.title +
        ' ' +
        (r.description ?? '') +
        ' ' +
        (r.tags?.join(' ') ?? '')
      ).toLowerCase()
      return hay.includes(q)
    })
  }, [resources, query])

  const universal = matches.filter((r) => r.isUniversal)
  const cohortGated = matches.filter((r) => !r.isUniversal)

  function handleDelete() {
    if (!deleting) return
    setDeleteError(null)
    startDelete(async () => {
      const result = await deleteLibraryResource(deleting.id)
      if (!result.ok) {
        setDeleteError(result.message)
        return
      }
      setDeleting(null)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-serif text-2xl text-foreground">Library</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Curate the resources fellows see. Add new entries, edit details,
            or remove anything that no longer belongs.
          </p>
        </div>
        <AddResourceDialog />
      </header>

      <div className="relative max-w-md">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title, description, or tag..."
          className="pl-9"
          aria-label="Search resources"
        />
      </div>

      {resources.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-card px-4 py-12 text-center text-sm text-muted-foreground">
          No resources yet. Use &ldquo;Add resource&rdquo; to publish the first
          one.
        </p>
      ) : (
        <>
          <ResourceGroup
            title="Recommended Resources"
            description="Books, videos, podcasts, and other recommendations visible to every fellow regardless of cohort."
            rows={universal}
            onEdit={setEditing}
            onDelete={setDeleting}
            emptyMessage={
              query
                ? 'No matches in Recommended Resources.'
                : 'Nothing in Recommended Resources yet.'
            }
          />

          <ResourceGroup
            title="Cohort-gated"
            description="Released to specific cohorts. Fellows see everything assigned to their cohort and earlier ones."
            rows={cohortGated}
            onEdit={setEditing}
            onDelete={setDeleting}
            emptyMessage={
              query
                ? 'No matches in Cohort-gated resources.'
                : 'No cohort-gated resources yet.'
            }
          />
        </>
      )}

      {/* Edit dialog. Controlled mode: we own `open`, AddResourceDialog
          renders no trigger of its own. Closing the dialog resets
          `editing` so the next open re-seeds from a fresh row. */}
      {editing && (
        <AddResourceDialog
          initial={editing}
          open={true}
          onOpenChange={(next) => {
            if (!next) setEditing(null)
          }}
          hideTrigger
        />
      )}

      {/* Delete confirmation. A second dialog so admins can't fat-
          finger the trash icon. */}
      <Dialog
        open={!!deleting}
        onOpenChange={(next) => {
          if (!next) {
            setDeleting(null)
            setDeleteError(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this resource?</DialogTitle>
            <DialogDescription>
              {deleting ? (
                <>
                  &ldquo;{deleting.title}&rdquo; will be removed from the
                  Library for everyone, along with its cover image. This
                  cannot be undone.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>

          {deleteError && (
            <p className="text-sm text-destructive" role="alert">
              {deleteError}
            </p>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleting(null)
                setDeleteError(null)
              }}
              disabled={deletePending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deletePending}
            >
              {deletePending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface GroupProps {
  title: string
  description: string
  rows: AdminLibraryRow[]
  emptyMessage: string
  onEdit: (row: AdminLibraryRow) => void
  onDelete: (row: AdminLibraryRow) => void
}

function ResourceGroup({
  title,
  description,
  rows,
  emptyMessage,
  onEdit,
  onDelete,
}: GroupProps) {
  return (
    <section className="flex flex-col gap-3" aria-label={title}>
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h3 className="font-serif text-lg text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
          {rows.length}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-card px-4 py-8 text-center text-xs text-muted-foreground">
          {emptyMessage}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-md border border-border bg-card">
          {rows.map((row) => (
            <li key={row.id}>
              <ResourceRow row={row} onEdit={onEdit} onDelete={onDelete} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

interface RowProps {
  row: AdminLibraryRow
  onEdit: (row: AdminLibraryRow) => void
  onDelete: (row: AdminLibraryRow) => void
}

function ResourceRow({ row, onEdit, onDelete }: RowProps) {
  const meta = TYPE_META[row.resourceType]
  const Icon = meta.Icon
  return (
    <div className="flex items-start gap-3 px-3 py-3 sm:gap-4 sm:px-4">
      {/* Cover thumb (or type-icon fallback) */}
      <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded border border-border bg-muted sm:h-14 sm:w-20">
        {row.coverUrl ? (
          <Image
            src={row.coverUrl}
            alt=""
            fill
            sizes="80px"
            className="object-cover"
            unoptimized
          />
        ) : (
          <span className="grid h-full w-full place-items-center text-muted-foreground">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <p className="text-sm font-medium text-foreground">{row.title}</p>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Icon className="h-3 w-3" aria-hidden="true" />
            {meta.label}
          </span>
        </div>
        {/* Author byline. Surfaced even on the dense admin row so
            curators can verify attribution without opening the edit
            dialog. Suppressed for legacy rows where author is null. */}
        {row.author && (
          <p className="mt-0.5 text-xs text-muted-foreground">by {row.author}</p>
        )}
        {row.description && (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {row.description}
          </p>
        )}

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          {row.isUniversal ? (
            <Badge variant="secondary" className="gap-1 text-[10px]">
              <Layers className="h-3 w-3" aria-hidden="true" />
              Recommended
            </Badge>
          ) : row.cohorts.length === 0 ? (
            <Badge
              variant="outline"
              className="gap-1 border-dashed text-[10px] text-muted-foreground"
            >
              No cohort
            </Badge>
          ) : (
            row.cohorts.map((c) => (
              <Badge key={c} variant="outline" className="text-[10px]">
                Cohort {c}
              </Badge>
            ))
          )}

          {row.tags?.slice(0, 3).map((t) => (
            <span
              key={t}
              className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px]"
            >
              #{t}
            </span>
          ))}
          {row.tags && row.tags.length > 3 && (
            <span className="text-[10px]">+{row.tags.length - 3}</span>
          )}

          {row.url && (
            <a
              href={row.url}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto inline-flex items-center gap-1 text-xs text-highlight hover:underline"
            >
              Open
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-col gap-1 sm:flex-row sm:items-start">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onEdit(row)}
          aria-label={`Edit ${row.title}`}
        >
          <Pencil className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Edit</span>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onDelete(row)}
          aria-label={`Delete ${row.title}`}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Delete</span>
        </Button>
      </div>
    </div>
  )
}
