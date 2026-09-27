'use client'

import { useId, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  deleteReflection,
  submitReflection,
} from '@/app/(curriculum)/phases/actions'

interface Props {
  contentId: string
  prompt: string
  /**
   * The user's previously-submitted response, or `null` when they
   * haven't responded yet. When present, the form starts in a
   * locked "submitted" state with an "Edit" button to re-open it.
   */
  initialResponse: string | null
}

/**
 * Reflection prompt + response form. Required when an item has
 * `reflection_enabled = true`; the fellow can't mark the item
 * complete until they've submitted a non-empty response.
 *
 * Designed to feel like a small journal entry: read-only "submitted"
 * state with an Edit button, expanding into a textarea + Save when
 * the user wants to revise.
 */
export function ReflectionForm({
  contentId,
  prompt,
  initialResponse,
}: Props) {
  const router = useRouter()
  const inputId = useId()
  const [response, setResponse] = useState(initialResponse ?? '')
  const [savedResponse, setSavedResponse] = useState(initialResponse)
  const [editing, setEditing] = useState(initialResponse === null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // Live word count is only for feedback - no minimum enforced

  // When the fellow blurs the textarea while it's empty AND a
  // reflection had been saved before, wipe the saved row from the
  // database. Clearing the box has to "count" - we want them to
  // re-write the reflection from scratch and the completion gate
  // to re-engage. Server-side the same call also drops any
  // dependent completion row.
  function handleBlur() {
    if (!savedResponse) return
    if (response.trim().length > 0) return
    setError(null)
    startTransition(async () => {
      const res = await deleteReflection(contentId)
      if (!res.ok) {
        setError(res.message)
        return
      }
      setSavedResponse(null)
      setEditing(true)
      router.refresh()
    })
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const value = response.trim()
    if (!value) {
      setError('Please write a reflection before saving.')
      return
    }
    startTransition(async () => {
      // Pass markComplete so the server tries to mark the item
      // complete in the same call - eliminates the old "Submit
      // reflection" + "Mark as completed" two-step. If a separate
      // gate is still pending the server will silently skip
      // completion; the lesson footer takes over from there.
      const res = await submitReflection(contentId, value, {
        markComplete: true,
      })
      if (!res.ok) {
        setError(res.message)
        return
      }
      setSavedResponse(value)
      setEditing(false)
      router.refresh()
    })
  }

  return (
    <section className="space-y-4 rounded-lg bg-muted/60 p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
          <Pencil className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 space-y-1">
          <p className="eyebrow">Reflection</p>
          <p className="text-pretty text-[15px] leading-relaxed text-foreground">
            {prompt}
          </p>
        </div>
      </div>

      {!editing && savedResponse ? (
        // Submitted state.
        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="whitespace-pre-wrap font-serif text-[15px] leading-relaxed text-foreground">
              {savedResponse}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              Reflection submitted
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditing(true)
                setResponse(savedResponse)
              }}
            >
              Edit
            </Button>
          </div>
        </div>
      ) : (
        // Edit state.
        <form onSubmit={handleSubmit} className="space-y-2">
          <Label htmlFor={inputId} className="sr-only">
            Your reflection
          </Label>
          <Textarea
            id={inputId}
            rows={6}
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            onBlur={handleBlur}
            placeholder=""
            disabled={pending}
            className="bg-card"
          />
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            {savedResponse && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setResponse(savedResponse)
                  setEditing(false)
                  setError(null)
                }}
                disabled={pending}
              >
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={pending}>
              {pending
                ? 'Saving...'
                : savedResponse
                  ? 'Save changes'
                  : 'Submit & mark complete'}
            </Button>
          </div>
        </form>
      )}
    </section>
  )
}
