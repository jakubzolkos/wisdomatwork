import Link from 'next/link'
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatOpensAt } from '@/lib/module-locks'

/**
 * Shown in place of an item whose module hasn't unlocked yet for this
 * fellow (lib/module-locks.ts).
 */
export function LockedModuleNotice({
  moduleTitle,
  opensAt,
  blockedBy,
}: {
  moduleTitle: string
  opensAt: string | null
  blockedBy: string | null
}) {
  return (
    <article className="mx-auto max-w-3xl rounded-xl border border-border bg-card px-6 py-12 text-center shadow-xs sm:px-10">
      <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
        <Lock className="size-6 text-muted-foreground" aria-hidden="true" />
      </div>
      <h1 className="text-xl sm:text-2xl">{moduleTitle} isn&apos;t open yet</h1>
      <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-muted-foreground">
        {opensAt
          ? `It opens on ${formatOpensAt(opensAt)}, right after the previous session.`
          : blockedBy
            ? `Complete everything in ${blockedBy} to unlock this module.`
            : 'It will open soon.'}
      </p>
      <div className="mt-6 flex justify-center">
        <Button asChild>
          <Link href="/dashboard">Back to your curriculum</Link>
        </Button>
      </div>
    </article>
  )
}
