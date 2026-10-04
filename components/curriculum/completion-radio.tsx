'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toggleContentCompletion } from '@/app/(curriculum)/phases/actions'
import { useCompletion } from './completion-state'
import {
  COMPLETION_GATE_MESSAGES,
  canUnmarkComplete,
  type CompletionGate,
} from '@/lib/completion-gates'
import { useMaybeUser } from '@/lib/user-context'

interface Props {
  contentId: string
  /** Server-rendered initial state. */
  isCompleted: boolean
  /** Item title - used for the screen-reader label. */
  itemTitle: string
  /** What still blocks ticking it; null when it can be ticked. */
  gate?: CompletionGate | null
}

/**
 * Radio-style completion toggle that mirrors the visual in the design
 * brief: an outline circle when incomplete, a filled circle with a
 * check when complete. Optimistically updates local state, then
 * confirms via the server action and refreshes the route.
 *
 * Wrapped in a stop-propagation handler so it doesn't trigger the
 * parent <Link> navigation when the user clicks the radio itself.
 */
export function CompletionRadio({ contentId, isCompleted, itemTitle, gate = null }: Props) {
  const router = useRouter()
  // Shared with the item footer and progress counts; see
  // completion-state.tsx for why it outlives the request.
  const { completed: optimistic, set, reset } = useCompletion(contentId, isCompleted)
  const { user: viewer } = useMaybeUser()
  const [pending, startTransition] = useTransition()

  // When the server rejects (e.g. the fellow hasn't opened the link
  // or submitted a required reflection), we revert the optimistic
  // tick AND surface the message via the button's `title` so they
  // get a hover hint without us having to plumb a toast through the
  // tree. The full UX lives on the item page itself.
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  function onClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault()
    e.stopPropagation()
    setErrorMessage(null)
    const next = !optimistic
    set(next)
    startTransition(async () => {
      const res = await toggleContentCompletion(contentId, next)
      if (!res.ok) {
        reset()
        setErrorMessage(res.message)
        return
      }
      router.refresh()
    })
  }

  // Completion is final for fellows: a done item shows a plain check,
  // and a click falls through to the row's link like the gated state.
  if (optimistic && !canUnmarkComplete(viewer?.role)) {
    return (
      <span
        role="img"
        aria-label={`"${itemTitle}" completed`}
        title="Completed"
        className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-primary bg-primary text-background"
      >
        <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
      </span>
    )
  }

  // Can't be ticked yet: show why instead of a toggle that would tick
  // and bounce back. Not a button, so a click falls through to the
  // row's link and opens the item, where the requirement can be met.
  if (gate && !optimistic) {
    const reason = COMPLETION_GATE_MESSAGES[gate]
    return (
      <span
        role="img"
        aria-label={`"${itemTitle}" can't be completed yet. ${reason}`}
        title={reason}
        className="block h-5 w-5 shrink-0 rounded-full border border-dashed border-muted-foreground/40"
      />
    )
  }

  const label = optimistic
    ? `Mark "${itemTitle}" as not complete`
    : `Mark "${itemTitle}" as complete`

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={optimistic}
      aria-label={label}
      title={errorMessage ?? label}
      onClick={onClick}
      disabled={pending}
      className={cn(
        'grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors',
        optimistic
          ? 'border-primary bg-primary text-background'
          : 'border-muted-foreground/40 bg-transparent hover:border-foreground/70',
        pending && 'opacity-60',
      )}
    >
      {optimistic ? (
        <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
      ) : (
        <span className="sr-only">incomplete</span>
      )}
    </button>
  )
}
