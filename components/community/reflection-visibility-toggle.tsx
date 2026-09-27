'use client'

import { useState, useTransition } from 'react'
import { Eye, EyeOff, Lock } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { setReflectionVisibility } from '@/app/community/reflections/actions'

type Visibility = 'public' | 'cohort' | 'private'

interface Props {
  reflectionId: string
  value: Visibility
}

/**
 * Small dropdown for the reflection author to flip between
 * public / cohort / private. Submits via the
 * `setReflectionVisibility` server action and reverts the local
 * state if the action fails so the UI never lies about persistence.
 */
export function ReflectionVisibilityToggle({ reflectionId, value }: Props) {
  const [current, setCurrent] = useState<Visibility>(value)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function onChange(next: string) {
    if (next === current) return
    if (next !== 'public' && next !== 'cohort' && next !== 'private') return
    const previous = current
    setCurrent(next)
    setError(null)
    startTransition(async () => {
      const result = await setReflectionVisibility({
        reflectionId,
        visibility: next,
      })
      if (!result.ok) {
        // Roll back the optimistic change so the dropdown matches DB.
        setCurrent(previous)
        setError(result.message)
      }
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Select
        value={current}
        onValueChange={onChange}
        disabled={pending}
      >
        <SelectTrigger
          className="h-8 min-w-[8.5rem] gap-1 text-xs"
          aria-label="Reflection visibility"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="public">
            <span className="inline-flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
              Public
            </span>
          </SelectItem>
          <SelectItem value="cohort">
            <span className="inline-flex items-center gap-1.5">
              <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
              Cohort only
            </span>
          </SelectItem>
          <SelectItem value="private">
            <span className="inline-flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              Private
            </span>
          </SelectItem>
        </SelectContent>
      </Select>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
