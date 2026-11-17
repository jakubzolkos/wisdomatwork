import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AuthCard, AuthNotice, authLinkClass } from '../_components/auth-ui'
import { ResendLinkForm } from './resend-link-form'

/**
 * Landing page for auth failures. Called from two places:
 *  - `/auth/callback` when the invite / recovery / OAuth code fails.
 *  - Supabase's hosted templates which pass `?error=...`.
 *
 * We accept either `message` or `error` so both flows render sensibly.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>
}) {
  const params = await searchParams
  const detail = params?.message ?? params?.error ?? null

  return (
    <div className="w-full max-w-sm">
      <AuthCard title="We couldn't sign you in">
        <AuthNotice tone="error" role="alert">
          {detail
            ? `Reason: ${detail}`
            : 'An unspecified error occurred.'}
        </AuthNotice>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Email links expire after 24 hours and can only be used once. Enter
          your email below for a fresh one, or contact{' '}
          <a className={authLinkClass} href="mailto:waw@abigailadamsinstitute.org">
            waw@abigailadamsinstitute.org
          </a>
          .
        </p>
        <ResendLinkForm />
        <Button asChild size="lg" className="w-full">
          <Link href="/auth/login">Back to sign in</Link>
        </Button>
      </AuthCard>
    </div>
  )
}
