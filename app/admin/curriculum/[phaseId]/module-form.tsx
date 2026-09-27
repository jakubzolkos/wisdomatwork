'use client'

import { useId, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CohortAccessField } from '@/components/admin/cohort-access-field'
import { createModule, updateModule } from '../actions'

export interface ModuleDraft {
  id?: string
  title: string
  description: string
  /**
   * `null`  -> inherit from the phase
   * `[]`    -> locked (no fellows)
   * `[...]` -> override with this exact list
   */
  cohorts: string[] | null
}

interface Props {
  phaseId: string
  phaseCohorts: string[]
  initial?: ModuleDraft
  onSaved?: () => void
}

export function ModuleForm({
  phaseId,
  phaseCohorts,
  initial,
  onSaved,
}: Props) {
  const router = useRouter()
  const isEdit = !!initial?.id
  const titleId = useId()
  const descId = useId()

  const [inherit, setInherit] = useState<boolean>(
    initial ? initial.cohorts === null : true,
  )
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function onSubmit(formData: FormData) {
    setError(null)
    formData.set('phase_id', phaseId)
    if (inherit) formData.set('cohorts_inherit', 'on')
    if (isEdit) formData.set('id', initial!.id!)

    startTransition(async () => {
      const res = isEdit
        ? await updateModule(formData)
        : await createModule(formData)
      if (!res.ok) {
        setError(res.message)
        return
      }
      onSaved?.()
      router.refresh()
    })
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-5">
      <div className="space-y-2">
        <Label htmlFor={titleId}>Title</Label>
        <Input
          id={titleId}
          name="title"
          required
          autoFocus
          defaultValue={initial?.title ?? ''}
          placeholder="e.g. Foundations of Wisdom"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={descId}>Description (optional)</Label>
        <Textarea
          id={descId}
          name="description"
          rows={3}
          defaultValue={initial?.description ?? ''}
          placeholder="A short summary fellows see when browsing this phase."
        />
      </div>

      <div className="space-y-2 rounded-lg bg-muted/60 p-4">
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
              defaultValue={
                Array.isArray(initial?.cohorts) ? initial!.cohorts! : []
              }
              idPrefix={`module-cohort-${initial?.id ?? 'new'}`}
              label="Override cohort access"
              description="Tick the cohorts that should see this module. Leaving all unchecked hides this module from every fellow even if they can see the phase."
            />
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="flex justify-end pt-1">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving...' : isEdit ? 'Save changes' : 'Create module'}
        </Button>
      </div>
    </form>
  )
}
