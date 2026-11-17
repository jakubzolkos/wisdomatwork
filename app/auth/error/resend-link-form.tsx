'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { requestPasswordSetupAction } from '../login/actions'
import { EMAIL_LINK_EXPIRY_LABEL } from '@/lib/auth/link-expiry'
import { AuthNotice } from '../_components/auth-ui'

/**
 * Self-serve "send me a fresh link" form for expired / used links.
 *
 * Reuses `requestPasswordSetupAction`, which emails a new one-time link
 * to /auth/activate and answers identically whether or not the email
 * matches an account (no account enumeration).
 */
export function ResendLinkForm() {
  const [email, setEmail] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const res = await requestPasswordSetupAction(email)
      if (res.ok) setSentTo(res.email)
      else setError(res.error)
    })
  }

  if (sentTo) {
    return (
      <AuthNotice tone="success" role="status">
        <p className="font-medium">Check your inbox</p>
        <p className="mt-1 text-foreground">
          If an account exists for <span className="font-medium">{sentTo}</span>,
          we sent a new link. It expires in {EMAIL_LINK_EXPIRY_LABEL}.
        </p>
      </AuthNotice>
    )
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <Label htmlFor="resend-email">Need a new link?</Label>
      <Input
        id="resend-email"
        type="email"
        autoComplete="email"
        placeholder="Your program email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      {error ? (
        <AuthNotice tone="error" role="alert">
          {error}
        </AuthNotice>
      ) : null}
      <Button type="submit" size="lg" variant="outline" disabled={pending || !email}>
        {pending ? 'Sending…' : 'Email me a new link'}
      </Button>
    </form>
  )
}
