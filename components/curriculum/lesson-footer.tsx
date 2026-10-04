'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toggleContentCompletion } from '@/app/(curriculum)/phases/actions'
import { useCompletion } from './completion-state'
import { canUnmarkComplete } from '@/lib/completion-gates'
import { useMaybeUser } from '@/lib/user-context'

interface Props {
  contentId: string
  isCompleted: boolean
  /** Server-rendered: link present but user hasn't opened it yet. */
  needsLinkClick: boolean
  /**
   * Server-rendered: reflection required AND not yet submitted at
   * the minimum word count. Mirrors the rule the server action
   * enforces on toggle.
   */
  needsReflection: boolean
  /** Next item href, or null when this is the last item. */
  nextHref: string | null
  /**
   * When there's no next item because the next module is still
   * locked: the module to finish first. Shown instead of letting
   * "Go to next item" jump past the lock.
   */
  nextBlockedBy?: string | null
  /**
   * Set while the item can't be completed yet for a reason the fellow
   * can only wait out (a scheduled session that hasn't ended).
   */
  waitMessage?: string | null
  /**
   * When true, the manual "Mark complete" button is suppressed
   * - completion is driven by external state (e.g. a scheduled live
   * session that auto-completes once it has ended). The "Continue
   * to next item" / "Completed" affordances still render once the
   * lesson is complete; this only hides the manual incomplete CTA.
   */
  autoComplete?: boolean
  /**
   * Optional helper sentence shown next to the Mark-as-completed
   * CTA while the item is still incomplete. Used by live-session
   * items to reassure fellows that they should mark complete after
   * attending - even if they joined via Calendar instead of the
   * in-app link.
   */
  incompleteHint?: string | null
}

/**
 * Coursera-style two-state lesson CTA.
 *
 *  Not yet completed:  primary [ Mark complete ] button.
 *                      Disabled with an inline hint until the link
 *                      has been opened (when present) and a
 *                      reflection meeting the minimum word count has
 *                      been submitted (when required).
 *
 *  Already completed:  primary [ Go to next item ] button next to a
 *                      neutral "Completed" indicator. (No green - we
 *                      keep the success tone in muted/foreground per
 *                      project rule.) The button is just navigation;
 *                      it never re-toggles the server state.
 *
 *  Final lesson, completed: only the "Completed" indicator - there
 *                      is nowhere to continue to.
 */
export function LessonFooter({
  contentId,
  isCompleted,
  needsLinkClick,
  needsReflection,
  nextHref,
  nextBlockedBy = null,
  waitMessage = null,
  autoComplete = false,
  incompleteHint,
}: Props) {
  const router = useRouter()
  // Shared with the sidebar radio; see completion-state.tsx for why
  // it outlives the request.
  const { completed: optimistic, set, reset } = useCompletion(contentId, isCompleted)
  const { user: viewer } = useMaybeUser()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const blocked = !optimistic && (needsLinkClick || needsReflection || !!waitMessage)
  // The link gate is enforced silently - the button is just disabled
  // until the fellow opens the resource, with no inline hint. The
  // reflection gate still surfaces a hint because the textarea sits
  // right above the footer and a nudge there is helpful.
  const blockMessage = needsReflection
    ? 'Submit your reflection above before you can mark this complete.'
    : waitMessage && !autoComplete
      ? waitMessage
      : null

  function handleMarkComplete() {
    setError(null)
    set(true)
    startTransition(async () => {
      const res = await toggleContentCompletion(contentId, true)
      if (!res.ok) {
        reset()
        setError(res.message)
        return
      }
      router.refresh()
    })
  }

  // Re-open a lesson the fellow has already finished. Server gates
  // only block incomplete -> complete, so flipping back to false is
  // always allowed and won't trip the link/reflection checks.
  function handleReopen() {
    setError(null)
    set(false)
    startTransition(async () => {
      const res = await toggleContentCompletion(contentId, false)
      if (!res.ok) {
        reset()
        setError(res.message)
        return
      }
      router.refresh()
    })
  }

  function handleContinue() {
    if (!optimistic && !blocked) {
      // Item not yet completed, no gates blocking - mark complete
      // then navigate. This is for reflection items that have met
      // the minimum but no link gate to click.
      setError(null)
      set(true)
      startTransition(async () => {
        const res = await toggleContentCompletion(contentId, true)
        if (!res.ok) {
          reset()
          setError(res.message)
          return
        }
        if (nextHref) router.push(nextHref)
      })
    } else if (nextHref) {
      // Already completed - just navigate.
      router.push(nextHref)
    }
  }

  // "Completed" indicator. Doubles as the re-open affordance: hover
  // surfaces a "Mark as not completed" hint and clicking it flips
  // the lesson back to incomplete. Neutral tones only - no green.
  const completedBadge = !canUnmarkComplete(viewer?.role) ? (
    // Completion is final for fellows: a plain indicator, no re-open.
    <span className="inline-flex h-9 items-center gap-1.5 px-2.5 text-sm font-medium text-muted-foreground">
      <span className="grid size-5 place-items-center rounded-full bg-muted">
        <Check className="size-3" strokeWidth={3} aria-hidden="true" />
      </span>
      Completed
    </span>
  ) : (
    <button
      type="button"
      onClick={handleReopen}
      disabled={pending}
      title="Mark incomplete"
      aria-label="Mark incomplete"
      className="group inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-60"
    >
      <span className="grid size-5 place-items-center rounded-full bg-muted group-hover:bg-background">
        <Check className="size-3" strokeWidth={3} aria-hidden="true" />
      </span>
      <span className="group-hover:hidden">Completed</span>
      <span className="hidden group-hover:inline">Mark incomplete</span>
    </button>
  )

  // Whether the page passed in a per-item helper hint to show
  // beside the Mark CTA. Only relevant while the lesson is still
  // incomplete and not gated by reflection/link clicks. When the
  // item auto-completes externally we also skip the hint - the
  // status block above the footer is the source of truth.
  const showIncompleteHint =
    !optimistic && !blocked && !autoComplete && !!incompleteHint

  return (
    <div className="flex flex-col gap-3 border-t border-border bg-muted/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-8">
      <div className="min-w-0 space-y-1 sm:flex-1">
      {!optimistic && blocked && blockMessage && (
        <p className="text-sm text-muted-foreground" role="status">
          {blockMessage}
        </p>
      )}

      {showIncompleteHint && (
        <p className="text-sm text-muted-foreground" role="status">
          {incompleteHint}
        </p>
      )}

      {!nextHref && nextBlockedBy && !blocked && (
        <p className="text-sm text-muted-foreground" role="status">
          Finish every item in {nextBlockedBy} to unlock the next module.
        </p>
      )}

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 sm:shrink-0">
        {optimistic ? (
          // Completed state. When there IS a next item we render
          // the primary nav CTA. When this is the final item in the
          // module we still want a way out, so a quiet "Back to
          // dashboard" link replaces the dead-end - alongside the
          // neutral Completed indicator either way.
          <>
            {completedBadge}
            {nextHref ? (
              <Button
                type="button"
                onClick={handleContinue}
                className="inline-flex items-center gap-2"
              >
                Go to next item
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/dashboard')}
                className="inline-flex items-center gap-2"
              >
                Back to dashboard
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            )}
          </>
        ) : needsLinkClick ? (
          // Link gate is active but reflection (if required) is cleared.
          // Show the Mark complete button as disabled with the link hint.
          <Button
            type="button"
            onClick={handleMarkComplete}
            disabled={pending || blocked}
          >
            {pending ? 'Marking...' : 'Mark complete'}
          </Button>
        ) : needsReflection ? (
          // Reflection gate is active. Show disabled Mark complete
          // with the reflection hint.
          <Button
            type="button"
            onClick={handleMarkComplete}
            disabled={pending || blocked}
          >
            {pending ? 'Marking...' : 'Mark complete'}
          </Button>
        ) : waitMessage && !autoComplete ? (
          // Session hasn't ended yet and needs a manual tick after it
          // (e.g. it has a reflection): visible but disabled.
          <Button type="button" disabled>
            Mark complete
          </Button>
        ) : autoComplete ? (
          // Completion is owned by an external mechanism (e.g. the
          // scheduled live-session block above auto-marks the item
          // complete once the session ends). No manual CTA needed.
          null
        ) : nextHref ? (
          // All gates cleared, no auto-complete: show "Go to next item"
          // which will mark complete and navigate.
          <Button
            type="button"
            onClick={handleContinue}
            className="inline-flex items-center gap-2"
            disabled={pending}
          >
            Go to next item
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        ) : (
          // Final item, all gates cleared - just show Mark complete.
          <Button
            type="button"
            onClick={handleMarkComplete}
            disabled={pending}
          >
            {pending ? 'Marking...' : 'Mark complete'}
          </Button>
        )}
      </div>
    </div>
  )
}
