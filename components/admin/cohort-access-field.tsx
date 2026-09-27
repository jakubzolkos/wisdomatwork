'use client'

import { useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { COHORTS, type Cohort } from '@/lib/cohorts'

type Props = {
  /** Comma-separated form field name (e.g. "cohorts"). */
  name?: string
  /** Initial selected cohorts. */
  defaultValue?: readonly string[]
  /** Optional id prefix so multiple instances on a page have unique inputs. */
  idPrefix?: string
  /** Override the small explanatory copy under the checkboxes. */
  description?: string
  label?: string
}

/**
 * Reusable A / B / C cohort selector for the admin UI.
 *
 * Strict assigned-only behavior, app-wide:
 *  - Zero boxes checked  -> no fellows can see it (unassigned)
 *  - Any box checked     -> visible only to fellows in those cohorts
 *
 * Admins / facilitators always see every piece of content regardless,
 * and are never themselves bound to a cohort.
 *
 * The component renders one hidden input per selected cohort using
 * `name` (default "cohorts"), so server actions can read the field
 * with `formData.getAll(name)` and write the resulting array straight
 * to a Postgres `text[]` column.
 */
export function CohortAccessField({
  name = 'cohorts',
  defaultValue = [],
  idPrefix = 'cohort',
  description = 'Tick one or more cohorts to assign this content. Fellows only see content assigned to their cohort - leaving all unchecked hides it from every fellow.',
  label = 'Cohort access',
}: Props) {
  const [selected, setSelected] = useState<Set<Cohort>>(
    () => new Set(defaultValue.filter((c): c is Cohort => COHORTS.includes(c as Cohort))),
  )

  function toggle(cohort: Cohort, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(cohort)
      else next.delete(cohort)
      return next
    })
  }

  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex flex-wrap gap-3" role="group" aria-label={label}>
        {COHORTS.map((c) => {
          const id = `${idPrefix}-${c}`
          const isChecked = selected.has(c)
          return (
            <label
              key={c}
              htmlFor={id}
              className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                isChecked
                  ? 'border-primary/40 bg-primary-soft text-foreground'
                  : 'border-border bg-background text-muted-foreground hover:border-border-strong hover:text-foreground'
              }`}
            >
              <Checkbox
                id={id}
                checked={isChecked}
                onCheckedChange={(v) => toggle(c, v === true)}
              />
              <span>Cohort {c}</span>
            </label>
          )
        })}
      </div>

      {/* Hidden inputs that submit with the form. One per checked cohort. */}
      {Array.from(selected).map((c) => (
        <input key={c} type="hidden" name={name} value={c} />
      ))}

      <FieldDescription>{description}</FieldDescription>
    </Field>
  )
}

/**
 * Compact read-only badge showing which cohorts content is assigned to.
 * Renders an "Unassigned" pill when nothing is selected so admins can
 * tell at a glance that no fellows can currently see the row.
 */
export function CohortBadge({ cohorts }: { cohorts: readonly string[] | null | undefined }) {
  if (!cohorts || cohorts.length === 0) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full border border-dashed border-border bg-muted/50 px-2 py-0.5 text-xs font-medium text-muted-foreground"
        title="No cohorts assigned - hidden from every fellow"
      >
        <span className="sr-only">Cohort assignment:</span>
        Unassigned
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
      title="Visible only to assigned cohorts"
    >
      <span className="sr-only">Assigned cohorts:</span>
      {cohorts.join(' · ')}
    </span>
  )
}
