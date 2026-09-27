'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, BookOpen, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { CohortBadge } from '@/components/admin/cohort-access-field'
import { effectiveModuleCohorts } from '@/lib/curriculum'
import { ModuleForm } from './module-form'
import { deleteModule } from '../actions'
import type { ModuleRow } from './page'

interface Props {
  phaseId: string
  phaseCohorts: string[]
  modules: ModuleRow[]
  countsByModule: Map<string, number>
}

/**
 * Modules section of a phase. Each module row links into the module
 * detail page (where its content items live), plus inline edit and
 * delete actions for fast management.
 */
export function ModuleList({
  phaseId,
  phaseCohorts,
  modules,
  countsByModule,
}: Props) {
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-5">
        <div>
          <h2 className="text-base">Modules</h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Modules group related content within a phase. Open a module to
            manage the content inside it.
          </p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4" />
              Add module
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>New module</DialogTitle>
              <DialogDescription>
                Modules sit under a phase and contain the actual content
                fellows engage with.
              </DialogDescription>
            </DialogHeader>
            <ModuleForm
              phaseId={phaseId}
              phaseCohorts={phaseCohorts}
              onSaved={() => setCreateOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </header>

      {modules.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted-foreground">
          No modules yet. Click &ldquo;Add module&rdquo; to create the first
          one.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {modules.map((m) => (
            <ModuleRowItem
              key={m.id}
              module={m}
              phaseId={phaseId}
              phaseCohorts={phaseCohorts}
              count={countsByModule.get(m.id) ?? 0}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function ModuleRowItem({
  module,
  phaseId,
  phaseCohorts,
  count,
}: {
  module: ModuleRow
  phaseId: string
  phaseCohorts: string[]
  count: number
}) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [deleting, startDelete] = useTransition()

  // Effective cohorts: explicit override on the module wins; otherwise
  // inherit from the phase. Used purely for the badge display - the
  // server enforces the same rule on read.
  const effective = effectiveModuleCohorts(module.cohorts, phaseCohorts)
  const inherits = module.cohorts === null

  function onDelete() {
    const fd = new FormData()
    fd.set('id', module.id)
    fd.set('phase_id', phaseId)
    startDelete(async () => {
      const res = await deleteModule(fd)
      if (res.ok) router.refresh()
    })
  }

  return (
    <li className="flex flex-wrap items-start gap-3 px-5 py-4 transition-colors hover:bg-accent/60">
      <Link
        href={`/admin/curriculum/${phaseId}/modules/${module.id}`}
        className="group min-w-0 flex-1"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            <BookOpen className="h-3 w-3" aria-hidden="true" />
            {count} {count === 1 ? 'item' : 'items'}
          </span>
          {inherits ? (
            <span
              className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-xs font-medium text-muted-foreground"
              title="Inherits cohort access from the phase"
            >
              Inherits phase
            </span>
          ) : (
            <CohortBadge cohorts={effective} />
          )}
        </div>
        <p className="mt-1 inline-flex items-center gap-1.5 font-medium text-foreground group-hover:underline">
          {module.title}
          <ArrowRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
        </p>
        {module.description && (
          <p className="mt-0.5 line-clamp-2 max-w-2xl text-sm text-muted-foreground">
            {module.description}
          </p>
        )}
      </Link>

      <div className="flex shrink-0 items-center gap-1">
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Edit module">
              <Pencil className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit module</DialogTitle>
              <DialogDescription>
                Update this module&apos;s details and cohort access.
              </DialogDescription>
            </DialogHeader>
            <ModuleForm
              phaseId={phaseId}
              phaseCohorts={phaseCohorts}
              initial={{
                id: module.id,
                title: module.title,
                description: module.description ?? '',
                cohorts: module.cohorts,
              }}
              onSaved={() => setEditOpen(false)}
            />
            <DialogFooter className="mt-2">
              <DialogClose asChild>
                <Button type="button" variant="ghost">
                  Close
                </Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-destructive"
              aria-label="Delete module"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this module?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently removes &ldquo;{module.title}&rdquo; and every
                content item inside it. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={onDelete}
                disabled={deleting}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                {deleting ? 'Deleting...' : 'Delete module'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </li>
  )
}
