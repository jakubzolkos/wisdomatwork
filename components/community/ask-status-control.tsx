'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { setAskStatus } from '@/app/community/actions'
import {
  ASK_STATUS_LABEL,
  type AskStatus,
} from '@/lib/community/ask-categories'

interface Props {
  postId: string
  currentStatus: AskStatus
}

/**
 * Inline lifecycle picker rendered on the asker / staff view of an
 * Ask post. Emits a server action call on change and revalidates
 * the page server-side; we only flash an error message client-side
 * on failure.
 */
export function AskStatusControl({ postId, currentStatus }: Props) {
  const router = useRouter()
  const [status, setStatus] = useState<AskStatus>(currentStatus)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function onChange(next: string) {
    if (next === status) return
    setError(null)
    const previous = status
    setStatus(next as AskStatus)
    startTransition(async () => {
      const result = await setAskStatus({
        postId,
        status: next as AskStatus,
      })
      if (!result.ok) {
        setError(result.message ?? 'Could not update status.')
        // Roll back the optimistic state if the server rejected us.
        setStatus(previous)
        return
      }
      // Refresh the route so the badge in the post header re-renders
      // from the canonical server state.
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-foreground">
          Status
        </span>
        <Select value={status} onValueChange={onChange} disabled={pending}>
          <SelectTrigger className="h-8 min-w-[8rem]" aria-label="Ask status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(ASK_STATUS_LABEL) as AskStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {ASK_STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {pending && (
          <span className="text-xs text-muted-foreground">Saving…</span>
        )}
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
