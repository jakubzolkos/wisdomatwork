/**
 * Per-phase progress meters for the dashboard.
 *
 * Pure server component - takes already-loaded `PhaseProgress` rows
 * and renders one card per phase showing the current user's meter
 * plus a list of cohort teammates with their meters. No data
 * fetching here; that's `lib/team-progress.ts`.
 */

import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { PhaseProgress, TeammateProgress } from '@/lib/team-progress'

interface PhaseProgressSectionProps {
  phases: readonly PhaseProgress[]
  /** Display name used for "You" row labelling. */
  meName: string
  /** Total cohort teammates count for empty-state copy. */
  teammateCount: number
}

export function PhaseProgressSection({
  phases,
  meName,
  teammateCount,
}: PhaseProgressSectionProps) {
  if (phases.length === 0) return null

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
        <h2>Your progress</h2>
        {teammateCount > 0 && (
          <p className="text-xs text-muted-foreground">
            Tracking alongside {teammateCount}{' '}
            {teammateCount === 1 ? 'teammate' : 'teammates'} in your cohort
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {phases.map((phase) => (
          <PhaseCard key={phase.id} phase={phase} meName={meName} />
        ))}
      </div>
    </section>
  )
}

function PhaseCard({
  phase,
  meName,
}: {
  phase: PhaseProgress
  meName: string
}) {
  const hasItems = phase.itemCount > 0

  return (
    <Card className="gap-0 rounded-xl py-0 shadow-xs">
      <CardContent className="space-y-5 p-5 sm:p-6">
        <header className="space-y-1">
          <h3 className="text-pretty">{phase.title}</h3>
          <p className="text-xs text-muted-foreground">
            {hasItems
              ? `${phase.itemCount} ${phase.itemCount === 1 ? 'item' : 'items'}`
              : 'No content yet'}
          </p>
        </header>

        {/* My meter. Per product direction the card communicates
            progress through the bar fill alone - no percentage, no
            "X of Y" counter. The bar still consumes the percent
            value internally to draw the fill. */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">You</p>
          <Progress value={phase.me.percent} className="h-2 bg-muted" />
        </div>

        {/* Teammates list. Hidden when the user is solo. */}
        {phase.teammates.length > 0 && (
          <div className="space-y-3 border-t border-border pt-4">
            <p className="eyebrow">Your team</p>
            <ul className="space-y-3">
              {phase.teammates.map((tm) => (
                <TeammateRow
                  key={tm.id}
                  teammate={tm}
                  totalItems={phase.itemCount}
                />
              ))}
            </ul>
          </div>
        )}

        {/* Solo state - friendly prompt rather than an empty hole. */}
        {phase.teammates.length === 0 && hasItems && (
          <p className="border-t border-border pt-4 text-xs text-muted-foreground">
            {meName.split(' ')[0] ?? 'You'} is the only fellow in this cohort
            so far - your team meters will appear here once others join.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function TeammateRow({
  teammate,
  totalItems,
}: {
  teammate: TeammateProgress
  totalItems: number
}) {
  return (
    <li className="flex items-center gap-3">
      <Avatar className="size-8 shrink-0">
        {teammate.avatarUrl && (
          <AvatarImage src={teammate.avatarUrl} alt="" />
        )}
        <AvatarFallback className="bg-primary-soft text-xs font-medium text-primary">
          {teammate.initials}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1 space-y-1">
        {/* Teammate row mirrors the "You" meter: name + bar,
            no raw percentage or "X of Y" counter. The bar fill
            itself still uses the percent value to draw the meter. */}
        <p className="truncate text-sm text-foreground">{teammate.name}</p>
        <Progress value={teammate.percent} className="h-1.5 bg-muted" />
      </div>
    </li>
  )
}
