'use client'

import { useId, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { CohortAccessField } from '@/components/admin/cohort-access-field'
import { updateModule, deleteModule } from '../../../actions'

interface Props {
  phaseId: string
  phaseCohorts: string[]
  module: {
    id: string
    title: string
    description: string
    /** null = inherit; [] = locked; [...] = override */
    cohorts: string[] | null
    /** Part of the phase's unlock sequence (lib/module-locks.ts). */
    isSequential: boolean
    /** When the module opens for fellows (ISO); null = open now. */
    opensAt: string | null
  }
}

/** ISO -> the `YYYY-MM-DDTHH:MM` local value a datetime-local input shows. */
function isoToLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * Module-level analogue of PhaseDetailsForm. Same UX patterns:
 *   - Inline title / description / cohort fields
 *   - Inherit-from-phase checkbox for cohort access
 *   - Save-confirmation AlertDialog matching the delete prompt
 *   - Destructive AlertDialog for delete, with redirect on success
 */
export function ModuleDetailsForm({ phaseId, phaseCohorts, module }: Props) {
  const router = useRouter()
  const titleId = useId()
  const descId = useId()
  const opensId = useId()
  const [opensLocal, setOpensLocal] = useState(() => isoToLocalInput(module.opensAt))

  const [inherit, setInherit] = useState<boolean>(module.cohorts === null)
  const [errorText, setErrorText] = useState<string | null>(null)
  const [savedOpen, setSavedOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [deleting, startDelete] = useTransition()

  // Bumped on every successful save so CohortAccessField remounts
  // with fresh defaults, mirroring the trick used on the phase form.
  const fieldKey = `${inherit ? 'inherit' : (module.cohorts ?? []).join(',')}`

  function onSave(formData: FormData) {
    setErrorText(null)
    formData.set('id', module.id)
    formData.set('phase_id', phaseId)
    if (inherit) formData.set('cohorts_inherit', 'on')
    // The picker shows the admin's local time; store an exact instant.
    const opens = opensLocal.trim() ? new Date(opensLocal) : null
    formData.set('opens_at', opens && !Number.isNaN(opens.getTime()) ? opens.toISOString() : '')
    startTransition(async () => {
      const res = await updateModule(formData)
      if (res.ok) {
        router.refresh()
        setSavedOpen(true)
      } else {
        setErrorText(res.message)
      }
    })
  }

  function onDelete() {
    const fd = new FormData()
    fd.set('id', module.id)
    fd.set('phase_id', phaseId)
    startDelete(async () => {
      const res = await deleteModule(fd)
      if (res.ok) {
        router.replace(`/admin/curriculum/${phaseId}`)
      } else {
        setErrorText(res.message)
      }
    })
  }

  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-xs">
      <header className="mb-5">
        <p className="eyebrow">
          Module details
        </p>
        <h2 className="mt-1">Edit module</h2>
      </header>

      <form action={onSave} className="flex flex-col gap-5">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor={titleId}>Title</Label>
            <Input
              id={titleId}
              name="title"
              required
              defaultValue={module.title}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor={descId}>Description</Label>
            <Textarea
              id={descId}
              name="description"
              rows={3}
              defaultValue={module.description}
              placeholder="A short summary fellows see when browsing this phase."
            />
          </div>
        </div>

        <div className="space-y-2 rounded-md border border-border bg-muted/30 p-4">
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={inherit}
              onChange={(e) => setInherit(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium text-foreground">
                Inherit cohort access from this phase
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {phaseCohorts.length === 0
                  ? 'Phase is currently unassigned, so no fellows can see this module.'
                  : `Visible to fellows in ${phaseCohorts
                      .map((c) => `Cohort ${c}`)
                      .join(', ')}.`}
              </span>
            </span>
          </label>
          {!inherit && (
            <div className="pt-2">
              <CohortAccessField
                key={fieldKey}
                defaultValue={
                  Array.isArray(module.cohorts) ? module.cohorts : []
                }
                idPrefix={`module-cohort-${module.id}`}
                label="Override cohort access"
                description="Tick the cohorts that should see this module. Leaving all unchecked hides this module from every fellow even if they can see the phase."
              />
            </div>
          )}
        </div>

        <div className="space-y-2 rounded-md border border-border bg-muted/30 p-4">
          <Label htmlFor={opensId}>Opens for fellows on</Label>
          <Input
            id={opensId}
            type="datetime-local"
            step={300}
            value={opensLocal}
            onChange={(e) => setOpensLocal(e.target.value)}
            className="max-w-xs"
          />
          <p className="text-xs text-muted-foreground">
            In your local time. Until then fellows see the module with a lock and
            &ldquo;Opens [date]&rdquo;. Usually right after the previous session ends.
            Leave blank to open it now.
          </p>
        </div>

        <label className="flex items-start gap-2 rounded-md border border-border bg-muted/30 p-4 text-sm">
          <input
            type="checkbox"
            name="is_sequential"
            defaultChecked={module.isSequential}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium text-foreground">
              Also require finishing earlier modules (rarely needed)
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              On top of the date, fellows can open this module only after
              finishing every earlier module that has this ticked. Off by
              default: modules open by date, and completion only shows progress.
            </span>
          </span>
        </label>

        {errorText && (
          <p className="text-sm text-destructive" role="alert">
            {errorText}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                Delete module
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this module?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently deletes the module and every content item
                  inside it. This cannot be undone.
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

          <Button type="submit" disabled={pending}>
            {pending ? 'Saving...' : 'Save changes'}
          </Button>
        </div>
      </form>

      <AlertDialog open={savedOpen} onOpenChange={setSavedOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Module updated</AlertDialogTitle>
            <AlertDialogDescription>
              Your changes have been saved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setSavedOpen(false)}>
              Done
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
