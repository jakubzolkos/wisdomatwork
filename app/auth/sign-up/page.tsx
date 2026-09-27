import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AuthCard } from '../_components/auth-ui'

export default function SignUpRetiredPage() {
  return (
    <div className="w-full max-w-sm">
      <AuthCard
        title="Invite-only program"
        description="Wisdom At Work Fellows are enrolled by program administrators."
      >
        <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
          <p>
            If you&apos;ve been accepted into the program, watch your inbox
            for an invitation from your program administrator. The email
            will include a link to set your password and sign in.
          </p>
          <p>
            Haven&apos;t received an invite? Reach out to your school team
            facilitator or the program office.
          </p>
        </div>
        <Button asChild variant="outline" size="lg" className="w-full">
          <Link href="/auth/login">Back to sign in</Link>
        </Button>
      </AuthCard>
    </div>
  )
}
