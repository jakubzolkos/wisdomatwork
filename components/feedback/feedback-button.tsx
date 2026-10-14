'use client'

import { useState, useTransition } from 'react'
import { usePathname } from 'next/navigation'
import { CheckCircle2, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import { sendFeedback } from '@/lib/feedback/actions'
import { FEEDBACK_KINDS, type FeedbackKind } from '@/lib/email/templates/feedback'
import { cn } from '@/lib/utils'

/**
 * Floating chat bubble for fellows: feedback, problem reports and
 * questions, emailed to the WaW team with the page they were on
 * (lib/feedback/actions.ts).
 */
export function FeedbackButton() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<FeedbackKind>('feedback')
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [pending, startTransition] = useTransition()

  function onOpenChange(next: boolean) {
    setOpen(next)
    // A fresh form next time once a message went through.
    if (!next && sent) {
      setSent(false)
      setMessage('')
      setKind('feedback')
    }
    if (!next) setError(null)
  }

  function submit() {
    setError(null)
    const fd = new FormData()
    fd.set('kind', kind)
    fd.set('message', message)
    fd.set('page', pathname ?? '')
    startTransition(async () => {
      const res = await sendFeedback(fd)
      if (res.ok) setSent(true)
      else setError(res.message)
    })
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Send feedback or report a problem"
          title="Send feedback or report a problem"
          className="fixed right-4 bottom-4 z-40 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none sm:right-6 sm:bottom-6"
        >
          <MessageCircle className="size-5" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" sideOffset={12} className="w-[min(22rem,calc(100vw-2rem))] p-4">
        {sent ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center" role="status">
            <CheckCircle2 className="size-8 text-primary" aria-hidden="true" />
            <p className="text-sm font-medium text-foreground">Thank you, it&rsquo;s been sent.</p>
            <p className="text-xs text-muted-foreground">The WaW team will reply to your email if needed.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Send a message to the WaW team</p>
              <p className="text-xs text-muted-foreground">Feedback, a problem with the portal, or a question.</p>
            </div>

            <div role="radiogroup" aria-label="Kind of message" className="grid grid-cols-3 gap-1 rounded-md bg-muted p-1">
              {(Object.keys(FEEDBACK_KINDS) as FeedbackKind[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={kind === k}
                  onClick={() => setKind(k)}
                  className={cn(
                    'rounded px-2 py-1.5 text-xs font-medium transition-colors',
                    kind === k ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {FEEDBACK_KINDS[k]}
                </button>
              ))}
            </div>

            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                kind === 'problem'
                  ? 'What happened, and what did you expect?'
                  : kind === 'question'
                    ? 'What would you like to know?'
                    : 'What would you like to tell us?'
              }
              aria-label="Your message"
              rows={5}
              maxLength={5000}
              className="resize-none text-sm"
            />

            {error && (
              <p className="text-xs text-destructive" role="alert">
                {error}
              </p>
            )}

            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] leading-snug text-muted-foreground">
                Goes to waw@abigailadamsinstitute.org with this page&rsquo;s address.
              </p>
              <Button type="button" size="sm" onClick={submit} disabled={pending || message.trim().length < 3}>
                {pending ? 'Sending…' : 'Send'}
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
