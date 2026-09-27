'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { KeyRound, Mail } from 'lucide-react'
import { AuthCard, AuthNotice, MethodCard } from '../_components/auth-ui'

type Method = 'password' | 'code'

/**
 * Invite landing page. `/auth/callback` has already exchanged the
 * invite token for a real session cookie before routing here, so the
 * invitee is already authenticated when this component mounts.
 *
 * The invitee picks how they want to sign in going forward:
 *   • Password - sets a real password via updateUser() and routes to
 *                /dashboard. Future logins use email + password.
 *   • Code     - skips password setup. They're already signed in from
 *                the invite exchange, so we just hand them off to
 *                /dashboard. Future logins use one-time email codes
 *                via signInWithOtp() on /auth/login.
 */
export default function AcceptInvitePage() {
  const router = useRouter()
  const [method, setMethod] = useState<Method>('password')

  const [firstName, setFirstName] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [bootstrapped, setBootstrapped] = useState(false)
  const [bootstrapError, setBootstrapError] = useState<string | null>(null)

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const supabase = createClient()
        const { data } = await supabase.auth.getUser()
        if (cancelled) return
        if (!data.user) {
          setBootstrapError(
            'Your invite link is no longer valid. Ask your program admin to resend it.',
          )
          setBootstrapped(true)
          return
        }
        const meta = (data.user.user_metadata ?? {}) as { full_name?: string }
        const first = meta.full_name?.trim().split(/\s+/)[0] ?? null
        setFirstName(first)
        setEmail(data.user.email ?? null)
        setBootstrapped(true)
      } catch (err) {
        // If Supabase client creation fails (e.g., during build or with missing env vars),
        // set a bootstrap error. This is safe because useEffect only runs on client-side.
        if (!cancelled) {
          setBootstrapError(
            'Unable to initialize. Please refresh the page.',
          )
          setBootstrapped(true)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)

    if (password.length < 8) {
      setSubmitError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setSubmitError('Passwords do not match.')
      return
    }

    setIsSubmitting(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      // Send through "/" so admins go to /admin and fellows to
      // /dashboard, picked server-side by the root page.
      router.push('/')
      router.refresh()
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Unable to set password')
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleCodeContinue() {
    // No password set. The invite exchange already gave us a live
    // session, so we just forward through "/" so the root page picks
    // /admin or /dashboard based on role.
    setSubmitError(null)
    setIsSubmitting(true)
    router.push('/')
    router.refresh()
  }

  const canSubmit = bootstrapped && !bootstrapError && !isSubmitting

  return (
    <div className="w-full max-w-md">
      <AuthCard
        title={firstName ? `Welcome, ${firstName}` : 'Welcome to Wisdom At Work'}
        description={
          email ? (
            <>
              You&apos;re accepting an invite for{' '}
              <span className="font-medium break-all text-foreground">{email}</span>. Choose how
              you&apos;d like to sign in from now on.
            </>
          ) : (
            "Choose how you'd like to sign in from now on."
          )
        }
      >
        {bootstrapError && (
          <AuthNotice tone="error" role="alert">
            {bootstrapError}
          </AuthNotice>
        )}

        <MethodPicker method={method} onChange={setMethod} disabled={!canSubmit} />

        {method === 'password' ? (
          <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-5">
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">At least 8 characters.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            {submitError && (
              <AuthNotice tone="error" role="alert">
                {submitError}
              </AuthNotice>
            )}
            <Button type="submit" size="lg" className="w-full" disabled={!canSubmit}>
              {isSubmitting ? 'Saving...' : 'Set password and continue'}
            </Button>
          </form>
        ) : (
          <div className="flex flex-col gap-5">
            <AuthNotice tone="info">
              <p className="font-medium">No password needed.</p>
              <p className="mt-1 text-muted-foreground">
                Every time you sign in, we&apos;ll email a one-time code to{' '}
                <span className="font-medium break-all text-foreground">
                  {email ?? 'your invited address'}
                </span>
                . Click the link in the email or paste the code to log in &mdash;
                nothing to memorize.
              </p>
            </AuthNotice>
            {submitError && (
              <AuthNotice tone="error" role="alert">
                {submitError}
              </AuthNotice>
            )}
            <Button
              type="button"
              size="lg"
              className="w-full"
              onClick={handleCodeContinue}
              disabled={!canSubmit}
            >
              {isSubmitting ? 'Loading...' : 'Continue to dashboard'}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              You can always add a password later from your profile.
            </p>
          </div>
        )}
      </AuthCard>
    </div>
  )
}

function MethodPicker({
  method,
  onChange,
  disabled,
}: {
  method: Method
  onChange: (m: Method) => void
  disabled?: boolean
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Sign-in method"
      className="grid grid-cols-1 gap-2 sm:grid-cols-2"
    >
      <MethodCard
        icon={<KeyRound className="size-4" />}
        label="Create a password"
        description="Sign in with email + password."
        selected={method === 'password'}
        onSelect={() => onChange('password')}
        disabled={disabled}
      />
      <MethodCard
        icon={<Mail className="size-4" />}
        label="Use email codes"
        description="We email a login code every time."
        selected={method === 'code'}
        onSelect={() => onChange('code')}
        disabled={disabled}
      />
    </div>
  )
}
