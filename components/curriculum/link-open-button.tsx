'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { recordLinkClick } from '@/app/(curriculum)/phases/actions'
import { isStoredFileUrl } from '@/lib/stored-files'

interface Props {
  contentId: string
  url: string
  /** Renders different copy ("Join now" vs "Open") for live sessions. */
  isLiveSession: boolean
  /**
   * Custom button label. When omitted falls back to the live
   * session / non-live default copy. Used to put the resource
   * type into the CTA so the button is self-describing without
   * a separate "Open this resource" header above it.
   */
  label?: string
  /** Whether the current user has already opened this link. */
  alreadyClicked: boolean
}

/**
 * "Open the resource" CTA. Opens the link in a new tab and, on the
 * first click, also records the open via the `recordLinkClick`
 * server action so the completion gate (link must be clicked before
 * the item can be marked complete) can clear.
 *
 * Optimistic - the green checkmark flips immediately and reverts on
 * server failure.
 */
export function LinkOpenButton({
  contentId,
  url,
  isLiveSession,
  label,
  alreadyClicked,
}: Props) {
  const router = useRouter()
  const [optimistic, setOptimistic] = useState(alreadyClicked)
  const [pending, startTransition] = useTransition()

  // Re-sync if the server state changes after a refresh.
  if (!pending && optimistic !== alreadyClicked && !optimistic) {
    setOptimistic(alreadyClicked)
  }

  function handleClick() {
    // Stored files open in the in-app viewer, so stay in this tab.
    // Record the open before navigating away, or the gate could miss it.
    if (isStoredFileUrl(url)) {
      startTransition(async () => {
        if (!optimistic) {
          setOptimistic(true)
          await recordLinkClick(contentId)
        }
        router.push(url)
      })
      return
    }
    // Open first so the popup blocker treats this as a user gesture.
    window.open(url, '_blank', 'noopener,noreferrer')
    if (optimistic) return
    setOptimistic(true)
    startTransition(async () => {
      const res = await recordLinkClick(contentId)
      if (!res.ok) {
        setOptimistic(false)
        return
      }
      router.refresh()
    })
  }

  // No visible "Opened" indicator - the click is tracked internally
  // (`optimistic` + `recordLinkClick`) so the lesson footer's gate
  // can clear, but nothing is surfaced inline on the link card.
  // The label is rendered verbatim (no `capitalize` transform) since
  // it's now typically the article title, which arrives already
  // correctly title-cased and would be mangled by CSS capitalize on
  // its lowercase connectors ("of", "for", "the").
  const text = label ?? (isLiveSession ? 'Join now' : 'Open')
  return (
    <Button onClick={handleClick} className="inline-flex items-center gap-1.5">
      <span className="line-clamp-1 text-left">{text}</span>
      {!isStoredFileUrl(url) && (
        <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      )}
    </Button>
  )
}
