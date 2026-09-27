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
import { updatePhase, deletePhase } from '../actions'

interface Props {
  phase: {
    id: string
    title: string
    description: string
    cohorts: string[]
  }
}

export function PhaseDetailsForm({ phase }: Props) {
  const router = useRouter()
  const titleId = useId()
  const descId = useId()
  const [errorText, setErrorText] = useState<string | null>(null)
  const [savedOpen, setSavedOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [deleting, startDelete] = useTransition()

  // Bumped on every successful save so the checkbox group remounts with
  // the fresh `defaultValue` from the server. CohortAccessField is
  // uncontrolled internally (useState seeded once) so without a key
  // change the boxes would still show the pre-save state until the user
  // hard-reloads the page.
  const fieldKey = phase.cohorts.join(',')

  function onSave(formData: FormData) {
    setErrorText(null)
    formData.set('id', phase.id)
    startTransition(async () => {
      const res = await updatePhase(formData)
      if (res.ok) {
        // Refresh first so server data is fresh, then open the
        // confirmation dialog matching the delete-confirmation styling.
        router.refresh()
        setSavedOpen(true)
      } else {
        setErrorText(res.message)
      }
    })
  }

  function onDelete() {
    const fd = new FormData()
    fd.set('id', phase.id)
    startDelete(async () => {
      const res = await deletePhase(fd)
      if (res.ok) {
        router.replace('/admin/curriculum')
      } else {
        setErrorText(res.message)
      }
    })
  }

  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-xs">
      <header className="mb-5">
        <p className="eyebrow">
          Phase details
        </p>
        <h2 className="mt-1">
          Edit phase
        </h2>
      </header>

      <form action={onSave} className="flex flex-col gap-5">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor={titleId}>Title</Label>
            <Input
              id={titleId}
              name="title"
              required
              defaultValue={phase.title}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor={descId}>Description</Label>
            <Textarea
              id={descId}
              name="description"
              rows={3}
              defaultValue={phase.description}
              placeholder="A short summary fellows see on their dashboard."
            />
          </div>
        </div>

        <CohortAccessField
          key={fieldKey}
          defaultValue={phase.cohorts}
          idPrefix={`phase-cohort-${phase.id}`}
          description="Assign this phase to one or more cohorts. Only fellows in the assigned cohort(s) can see it. Leaving all unchecked hides the phase from every fellow."
        />

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
                Delete phase
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this phase?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently deletes the phase and every content item
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
                  {deleting ? 'Deleting...' : 'Delete phase'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button type="submit" disabled={pending}>
            {pending ? 'Saving...' : 'Save changes'}
          </Button>
        </div>
      </form>

      {/* Save-confirmation dialog. Styled to match the delete-phase
          AlertDialog so admins get the same visual treatment for both
          destructive and non-destructive confirmations. */}
      <AlertDialog open={savedOpen} onOpenChange={setSavedOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Phase updated</AlertDialogTitle>
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
