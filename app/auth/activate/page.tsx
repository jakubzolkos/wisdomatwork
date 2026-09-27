'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { KeyRound, Mail } from 'lucide-react'
import { activateWithPasswordAction } from './actions'
import {
  requestSignInCodeAction,
  verifyEmailLoginCodeAction,
} from '../login/actions'
import {
  AuthCard,
  AuthFootnote,
  AuthNotice,
  MethodCard,
  authLinkClass,
} from '../_components/auth-ui'

type Method = 'password' | 'code'
type CodeStep = 'request' | 'verify'

/**
 * The activation page is reached from the link inside the invitation
 * email:
 *
 *   /auth/activate?token_hash=...&type=invite&email=...&next=/
 *
 * The link itself MUST NOT authenticate the recipient. The recipient
 * stays unauthenticated until they either:
 *
 *   1. Create a password - we verify the one-time invite token AND
 *      set the password in the same server action; only then is a
 *      session minted.
 *   2. Email me a code - we issue a 6-digit code into our own
 *      `email_login_codes` table and email it via Resend. The
 *      recipient stays on THIS page, types the code, and only on
 *      successful `verifyEmailLoginCodeAction` is a session minted.
 *
 * Why we keep the code flow on /auth/activate (not bouncing to
 * /auth/login like before): the proxy at lib/supabase/proxy.ts
 * redirects any signed-in user away from /auth/login to /dashboard.
 * If the recipient's browser happens to carry ANY session cookie
 * (admin preview, leftover from a prior test, the Vercel toolbar's
 * own auth cookie, etc.) the proxy treats them as authenticated and
 * dumps them on the dashboard the instant we navigate to /auth/login,
 * which the recipient experiences as "Email me a code logged me in
 * before I typed the code." Staying on /auth/activate avoids that
 * navigation entirely.
 *
 * Belt-and-braces: we also sign out any existing browser-side
 * Supabase session on mount, so the recipient is guaranteed to be
 * unauthenticated before they pick a method.
 */
function isOtpType(value: string | null): value is EmailOtpType {
  return (
    value === 'invite' ||
    value === 'magiclink' ||
    value === 'recovery' ||
    value === 'email' ||
    value === 'signup' ||
    value === 'email_change'
  )
}

function ActivateForm() {
  const router = useRouter()
  const params = useSearchParams()
  const tokenHash = params.get('token_hash') ?? ''
  const typeRaw = params.get('type')
  const type: EmailOtpType = isOtpType(typeRaw) ? typeRaw : 'invite'
  const email = (params.get('email') ?? '').trim().toLowerCase()
  const next = params.get('next') ?? '/'
  // `mode=password-only` is set by the login page's "Set or reset
  // password" flow. We use it (and also `type=recovery`, which the
  // same flow always sets) to hide the "Email me a code" choice and
  // re-skin this page as a password setup / reset screen instead of
  // an activation screen.
  const modeRaw = params.get('mode')
  const isPasswordOnly = modeRaw === 'password-only' || type === 'recovery'

  const [method, setMethod] = useState<Method>('password')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Code-path UI state. We render request -> verify in-place on this
  // same page so the proxy can never intercept a cross-page nav and
  // honor a stale session cookie.
  const [codeStep, setCodeStep] = useState<CodeStep>('request')
  const [code, setCode] = useState('')
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null)

  // We need at least the email to do anything useful (the code path
  // doesn't strictly need token_hash, but the password path does).
  // Surface a friendly error if the link is mangled.
  const linkLooksValid = !!email && !!tokenHash

  // Belt-and-braces: clear any pre-existing browser-side Supabase
  // session on mount. The activation link is a trust handoff to a
  // (potentially) brand-new identity; we must not honor whatever
  // session the recipient's browser was carrying from a prior test
  // or admin preview, otherwise the proxy will treat them as
  // already-authenticated the moment we navigate anywhere.
  const didSignOutRef = useRef(false)
  useEffect(() => {
    if (didSignOutRef.current) return
    didSignOutRef.current = true
    try {
      const supabase = createClient()
      // `local` scope: just clear THIS browser's tokens. Don't fan out
      // to other devices, and don't hit the global signout endpoint
      // (which would 401 if there is no session - perfectly fine, but
      // noisy in the network tab).
      supabase.auth.signOut({ scope: 'local' }).catch(() => {
        // Best-effort. If signout fails (e.g. there was no session to
        // begin with) we still want activation to proceed.
      })
    } catch (err) {
      // If Supabase client creation fails (e.g., during build or with missing env vars),
      // skip the sign-out attempt. This is safe because we're just trying to clear
      // any pre-existing session as a belt-and-braces measure.
    }
  }, [])

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setIsSubmitting(true)
    try {
      const result = await activateWithPasswordAction({
        tokenHash,
        type,
        password,
      })
      if (!result.ok) throw new Error(result.error)
      // Send through `next` (defaults to "/") so the root page picks
      // /admin or /dashboard based on role.
      router.replace(next.startsWith('/') ? next : '/')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not activate account.')
      setIsSubmitting(false)
    }
  }

  async function handleSendCode() {
    setError(null)
    if (!email) {
      setError('This activation link is missing an email address. Ask your admin to resend.')
      return
    }

    setIsSubmitting(true)
    try {
      // Issues a fresh 6-digit code into our own email_login_codes
      // table (any prior open code is invalidated) and emails just
      // the digits via Resend. NO session is created here - the user
      // remains unauthenticated until verifyEmailLoginCodeAction
      // succeeds.
      const result = await requestSignInCodeAction(email)
      if (!result.ok) throw new Error(result.error)
      setCodeSentTo(result.email)
      setCode('')
      setCodeStep('verify')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not send sign-in code.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const trimmed = code.replace(/\D/g, '')
    if (trimmed.length !== 6) {
      setError('Enter the 6-digit code from your email.')
      return
    }

    setIsSubmitting(true)
    try {
      // Verifies the typed code against our table, then mints a
      // Supabase session AND flips the invitation row to accepted -
      // ALL of which only happens on a correct, unexpired code.
      const result = await verifyEmailLoginCodeAction(email, trimmed, {
        fromInvite: true,
      })
      if (!result.ok) throw new Error(result.error)
      router.replace(next.startsWith('/') ? next : '/')
      router.refresh()
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'That code was invalid or has expired. Try requesting a new one.',
      )
      setIsSubmitting(false)
    }
  }

  return (
    <AuthCard
      title={isPasswordOnly ? 'Set your password' : 'Activate your account'}
      description={
        isPasswordOnly ? (
          email ? (
            <>
              Choose a new password for{' '}
              <span className="font-medium break-all text-foreground">{email}</span>. After
              this, you can sign in with either your password or a one-time email
              code.
            </>
          ) : (
            'Choose a new password for your Wisdom At Work account.'
          )
        ) : email ? (
          <>
            You&apos;re activating{' '}
            <span className="font-medium break-all text-foreground">{email}</span>. Choose how
            you&apos;d like to sign in.
          </>
        ) : (
          "Choose how you'd like to sign in to the Wisdom At Work portal."
        )
      }
    >
      {!linkLooksValid && (
        <AuthNotice tone="error" role="alert">
          This activation link is missing or malformed. Ask your program admin to
          resend your invitation.
        </AuthNotice>
      )}

      {!isPasswordOnly && (
        <MethodPicker
          method={method}
          onChange={(m) => {
            setMethod(m)
            setError(null)
            // Switching methods resets the code-path step so the
            // recipient can't accidentally land on the verify form
            // for a code that hasn't been requested yet.
            setCodeStep('request')
            setCode('')
            setCodeSentTo(null)
          }}
          disabled={isSubmitting}
        />
      )}

      {method === 'password' ? (
        <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-5">
          <div className="space-y-2">
            <Label htmlFor="password">Create a password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
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
              disabled={isSubmitting}
            />
          </div>
          {error && (
            <AuthNotice tone="error" role="alert">
              {error}
            </AuthNotice>
          )}
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={!linkLooksValid || isSubmitting}
          >
            {isSubmitting
              ? isPasswordOnly
                ? 'Saving...'
                : 'Activating...'
              : isPasswordOnly
                ? 'Save password and sign in'
                : 'Set password and sign in'}
          </Button>
        </form>
      ) : codeStep === 'request' ? (
        <div className="flex flex-col gap-5">
          <AuthNotice tone="info">
            <p className="font-medium">No password needed.</p>
            <p className="mt-1 text-muted-foreground">
              We&apos;ll email a 6-digit code to{' '}
              <span className="font-medium break-all text-foreground">
                {email || 'your invited address'}
              </span>
              . Enter it on the next step to finish activating your account.
              Future logins also use a one-time code.
            </p>
          </AuthNotice>
          {error && (
            <AuthNotice tone="error" role="alert">
              {error}
            </AuthNotice>
          )}
          <Button
            type="button"
            size="lg"
            className="w-full"
            onClick={handleSendCode}
            disabled={!email || isSubmitting}
          >
            {isSubmitting ? 'Sending code...' : 'Email me a sign-in code'}
          </Button>
        </div>
      ) : (
        <form onSubmit={handleVerifyCode} className="flex flex-col gap-5">
          <AuthNotice tone="info" role="status">
            We sent a 6-digit code to{' '}
            <span className="font-medium break-all">{codeSentTo ?? email}</span>. Enter it
            below to finish activating your account.
          </AuthNotice>
          <div className="space-y-2">
            <Label htmlFor="otp-code">Sign-in code</Label>
            <Input
              id="otp-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="123456"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="h-12 text-center font-mono text-xl tracking-[0.5em] md:text-xl"
              disabled={isSubmitting}
            />
          </div>
          {error && (
            <AuthNotice tone="error" role="alert">
              {error}
            </AuthNotice>
          )}
          <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Verifying...' : 'Verify code and activate'}
          </Button>
          <div className="flex items-center justify-between gap-3 text-sm">
            <button
              type="button"
              onClick={() => {
                setCodeStep('request')
                setCode('')
                setError(null)
              }}
              className={authLinkClass}
              disabled={isSubmitting}
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => {
                setCode('')
                void handleSendCode()
              }}
              className={authLinkClass}
              disabled={isSubmitting}
            >
              Resend code
            </button>
          </div>
        </form>
      )}

      <AuthFootnote>
        Need help? Contact{' '}
        <a href="mailto:waw@abigailadamsinstitute.org" className={authLinkClass}>
          waw@abigailadamsinstitute.org
        </a>
      </AuthFootnote>
    </AuthCard>
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
      aria-label="Activation method"
      className="grid grid-cols-1 gap-2 sm:grid-cols-2"
    >
      <MethodCard
        icon={<KeyRound className="size-4" />}
        label="Create a password"
        description="Sign in with email + password going forward."
        selected={method === 'password'}
        onSelect={() => onChange('password')}
        disabled={disabled}
      />
      <MethodCard
        icon={<Mail className="size-4" />}
        label="Email me a sign-in code"
        description="We email a 6-digit code each time you sign in."
        selected={method === 'code'}
        onSelect={() => onChange('code')}
        disabled={disabled}
      />
    </div>
  )
}

export default function Page() {
  return (
    <div className="w-full max-w-md">
      <Suspense fallback={null}>
        <ActivateForm />
      </Suspense>
    </div>
  )
}
