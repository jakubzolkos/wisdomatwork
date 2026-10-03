'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  researchId: string
  /** Line under the ID explaining where to use it. */
  hint?: string
}

/**
 * Shows the fellow's research participant ID with a copy button.
 * Fellows paste it into every Google Form survey and often forget it,
 * so it sits on the profile and next to each survey link.
 */
export function ResearchIdCard({
  researchId,
  hint = 'Paste this into every program survey. It keeps your responses confidential.',
}: Props) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(researchId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard can be blocked (insecure context, permissions); the
      // ID stays visible and selectable either way.
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Your Unique ID
        </p>
        <p className="select-all font-mono text-lg tracking-wider">{researchId}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={copy}>
        {copied ? (
          <Check className="size-4" aria-hidden="true" />
        ) : (
          <Copy className="size-4" aria-hidden="true" />
        )}
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  )
}
