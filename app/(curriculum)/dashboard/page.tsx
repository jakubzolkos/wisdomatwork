import { getDashboardData } from '@/lib/dashboard-data'
import { loadTeamProgress } from '@/lib/team-progress'
import { LiveSessionCard } from '@/components/dashboard/live-session-card'
import { NotificationsFeed } from '@/components/notifications/notifications-feed'
import { PhaseProgressSection } from '@/components/dashboard/phase-progress-section'
import { PageHeader } from '@/components/page-header'

export const dynamic = 'force-dynamic'

/**
 * Dashboard right pane. The curriculum tree on the left is the
 * primary navigation; this page surfaces:
 *
 *   1. A short welcome
 *   2. Pinned/recent announcements
 *   3. The next live session (when one is within 7 days)
 *   4. Per-phase progress meters - the user's own meter on top of
 *      their cohort teammates' meters, so fellows can see how their
 *      pace compares
 *
 * Both loaders run in parallel; `loadTeamProgress` reuses the cached
 * `loadFullCurriculum` from the layout, so this is one extra round
 * trip for teammate completion rows on top of what the layout
 * already fetches.
 */
export default async function DashboardPage() {
  const [data, teamProgress] = await Promise.all([
    getDashboardData(),
    loadTeamProgress(),
  ])

  return (
    <>
      <div className="space-y-10">
        <PageHeader
          className="mb-0"
          title={<>Welcome back, {data.user.fullName}</>}
          description="Pick up where you left off - choose a content item from the curriculum on the left."
        />

        {/* Unified notifications (announcements, reminders, alerts)
            pinned at the top of the page. Full inbox lives at
            /notifications. */}
        <NotificationsFeed
          items={data.notifications}
          collapsible
          heading="Notifications"
        />

        {/* Upcoming live session (only within 7 days). */}
        {data.upcomingSession && <LiveSessionCard session={data.upcomingSession} />}

        {/* Per-phase progress meters: you + your cohort teammates. */}
        <PhaseProgressSection
          phases={teamProgress.phases}
          meName={data.user.fullName}
          teammateCount={teamProgress.teammateCount}
        />
      </div>
    </>
  )
}
