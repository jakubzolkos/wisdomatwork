import { Bell } from 'lucide-react'
import { requireUser } from '@/lib/auth-server'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/top-bar'
import {
  NotificationsFeed,
  type FeedItemView,
} from '@/components/notifications/notifications-feed'
import { getNotificationFeedForUser } from '@/lib/notifications/feed'
import type { NotificationKind } from '@/lib/notifications/types'

export const metadata = {
  title: 'Notifications | Leadership Fellowship',
  description:
    'Announcements, reminders, and alerts from the fellowship team.',
}

export const dynamic = 'force-dynamic'

function initialsFor(name: string | null | undefined): string {
  if (!name) return 'WF'
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || 'WF'
}

/**
 * /notifications - the full inbox. Renders every notification the
 * user can see (RLS-scoped) along with read state, kind badges, and
 * any pinned curriculum item or call-to-action.
 *
 * The dashboard surfaces the most recent five with a "View all" link
 * that lands here.
 */
export default async function NotificationsInboxPage() {
  const user = await requireUser()
  const items = await getNotificationFeedForUser(user.id, { limit: 100 })

  // Hydrate author display names in one round trip - the feed loader
  // intentionally returns raw rows so it can stay cheap.
  const authorIds = Array.from(
    new Set(items.map((i) => i.author_id).filter((v): v is string => !!v)),
  )
  const authorById = new Map<string, { name: string; initials: string }>()
  if (authorIds.length > 0) {
    const supabase = await createClient()
    const { data: authors } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', authorIds)
    for (const a of authors ?? []) {
      authorById.set(a.id, {
        name: a.full_name ?? 'Team',
        initials: initialsFor(a.full_name),
      })
    }
  }

  // Hydrate pinned-content links, also in one round trip.
  const contentIds = Array.from(
    new Set(items.map((i) => i.content_id).filter((v): v is string => !!v)),
  )
  const contentById = new Map<
    string,
    { id: string; title: string; href: string }
  >()
  if (contentIds.length > 0) {
    const supabase = await createClient()
    const { data: rows } = await supabase
      .from('labs')
      .select('id, title, year_id, module_id')
      .in('id', contentIds)
    for (const r of rows ?? []) {
      if (!r.module_id) continue
      contentById.set(r.id, {
        id: r.id,
        title: r.title,
        href: `/phases/${r.year_id}/modules/${r.module_id}/items/${r.id}`,
      })
    }
  }

  const view: FeedItemView[] = items.map((row) => ({
    id: row.id,
    kind: (row.kind ?? 'announcement') as NotificationKind,
    title: row.title,
    body: row.body,
    pinned: row.pinned,
    publishedAt: row.sent_at ?? row.published_at ?? row.created_at,
    readAt: row.read_at,
    author: row.author_id ? authorById.get(row.author_id) ?? null : null,
    ctaLabel: row.cta_label,
    ctaUrl: row.cta_url,
    content: row.content_id ? contentById.get(row.content_id) ?? null : null,
  }))

  return (
    <div className="min-h-screen bg-canvas">
      <TopBar />
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-10">
        <header className="flex flex-col gap-2 border-b border-border pb-6">
          <p className="inline-flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground">
            <Bell className="h-3.5 w-3.5" aria-hidden />
            Inbox
          </p>
          <h1 className="font-serif text-3xl text-foreground text-balance sm:text-4xl">
            Notifications
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Everything the fellowship team has sent your way - announcements,
            reminders, and alerts. Click any item to mark it read, or use{' '}
            <span className="font-medium">Mark all read</span> to clear them at
            once.
          </p>
        </header>

        <div className="pt-8">
          <NotificationsFeed items={view} hideViewAll heading="All notifications" />
        </div>
      </main>
    </div>
  )
}
