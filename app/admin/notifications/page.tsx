import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth-server'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyMedia,
} from '@/components/ui/empty'
import {
  Pin,
  Pencil,
  Trash2,
  Megaphone,
  BookOpen,
  Users,
  Mail,
  Clock,
  CheckCircle2,
  XCircle,
  Send,
} from 'lucide-react'
import {
  NotificationDialog,
  type AudienceScope,
  type ContentOption,
  type FellowOption,
  type SchoolTeamOption,
} from './notification-dialog'
import { NewNotificationButton } from './new-notification-button'
import {
  cancelScheduledNotification,
  deleteNotification,
  sendNotificationNow,
  toggleNotificationPin,
} from './actions'
import {
  NOTIFICATION_KIND_LABELS,
  type NotificationKind,
  type NotificationStatus,
} from '@/lib/notifications/types'

export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NotificationRowDto {
  id: string
  kind: NotificationKind
  status: NotificationStatus
  title: string
  body: string
  pinned: boolean
  audience_scope: AudienceScope | 'year'
  cohort_codes: string[] | null
  school_team_ids: string[] | null
  user_ids: string[] | null
  content_id: string | null
  cta_label: string | null
  cta_url: string | null
  email_enabled: boolean
  email_subject: string | null
  scheduled_for: string | null
  sent_at: string | null
  published_at: string | null
  author: { full_name: string | null } | null
  content: {
    id: string
    title: string
    year_id: string
    module_id: string
  } | null
}

type Tab = 'sent' | 'scheduled' | 'drafts' | 'failed'

const TAB_LABELS: Record<Tab, string> = {
  sent: 'Sent',
  scheduled: 'Scheduled',
  drafts: 'Drafts',
  failed: 'Failed',
}

const TAB_STATUSES: Record<Tab, NotificationStatus[]> = {
  sent: ['sent'],
  scheduled: ['scheduled', 'sending'],
  drafts: ['draft'],
  failed: ['failed', 'cancelled'],
}

function isTab(value: unknown): value is Tab {
  return (
    typeof value === 'string' &&
    (value === 'sent' || value === 'scheduled' || value === 'drafts' || value === 'failed')
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function contentHref(c: { year_id: string; module_id: string; id: string }) {
  return `/phases/${c.year_id}/modules/${c.module_id}/items/${c.id}`
}

function audienceLabel(
  row: NotificationRowDto,
  schoolNameById: Map<string, string>,
  fellowNameById: Map<string, string>,
): string {
  switch (row.audience_scope) {
    case 'global':
      return 'Everyone'
    case 'cohort': {
      const codes = row.cohort_codes ?? []
      if (codes.length === 0) return 'Cohort'
      return `Cohort ${codes.join(', ')}`
    }
    case 'school_team': {
      const ids = row.school_team_ids ?? []
      if (ids.length === 0) return 'School team'
      const names = ids
        .map((id) => schoolNameById.get(id))
        .filter((n): n is string => !!n)
      if (names.length <= 2) return names.join(', ') || 'School team'
      return `${names[0]}, ${names[1]} +${names.length - 2}`
    }
    case 'users': {
      const ids = row.user_ids ?? []
      if (ids.length === 0) return 'Specific fellow'
      const names = ids
        .map((id) => fellowNameById.get(id))
        .filter((n): n is string => !!n)
      if (names.length === 1) return names[0] ?? 'Specific fellow'
      return `${names[0] ?? 'Fellow'} +${names.length - 1}`
    }
    default:
      return 'Custom'
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function timestampForRow(row: NotificationRowDto): string | null {
  switch (row.status) {
    case 'sent':
      return row.sent_at ?? row.published_at
    case 'scheduled':
    case 'sending':
      return row.scheduled_for
    default:
      return row.published_at
  }
}

function timestampLabelForRow(row: NotificationRowDto): string {
  switch (row.status) {
    case 'sent':
      return 'Sent'
    case 'scheduled':
      return 'Scheduled for'
    case 'sending':
      return 'Sending'
    case 'cancelled':
      return 'Cancelled'
    case 'failed':
      return 'Failed'
    case 'draft':
    default:
      return 'Saved'
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function AdminNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  await requireAdmin()
  const supabase = await createClient()
  const params = await searchParams
  const tab: Tab = isTab(params.tab) ? params.tab : 'sent'
  const statuses = TAB_STATUSES[tab]

  const [
    { data: rows },
    { data: counts },
    { data: schoolTeamRows },
    { data: fellowRows },
    { data: yearRows },
    { data: labRows },
    { data: moduleRows },
  ] = await Promise.all([
    supabase
      .from('notifications')
      .select(
        'id, kind, status, title, body, pinned, audience_scope, cohort_codes, school_team_ids, user_ids, content_id, cta_label, cta_url, email_enabled, email_subject, scheduled_for, sent_at, published_at, author:profiles!author_id(full_name), content:labs!content_id(id, title, year_id, module_id)',
      )
      .in('status', statuses)
      .order('pinned', { ascending: false })
      .order(tab === 'scheduled' ? 'scheduled_for' : 'published_at', {
        ascending: tab === 'scheduled',
        nullsFirst: false,
      }),
    supabase
      .from('notifications')
      .select('status', { count: 'exact', head: false }),
    supabase.from('cohorts').select('id, name').order('name'),
    supabase
      .from('profiles')
      .select('id, full_name, email, cohort, role')
      .order('full_name'),
    supabase.from('years').select('id, title, order_index').order('order_index'),
    supabase
      .from('labs')
      .select('id, title, year_id, module_id, order_index')
      .order('order_index', { ascending: true }),
    supabase
      .from('modules')
      .select('id, title, phase_id, order_index')
      .order('order_index', { ascending: true }),
  ])

  // Tab counts
  const statusCounts = new Map<NotificationStatus, number>()
  for (const r of (counts ?? []) as Array<{ status: NotificationStatus }>) {
    statusCounts.set(r.status, (statusCounts.get(r.status) ?? 0) + 1)
  }
  const tabCounts: Record<Tab, number> = {
    sent: TAB_STATUSES.sent.reduce(
      (acc, s) => acc + (statusCounts.get(s) ?? 0),
      0,
    ),
    scheduled: TAB_STATUSES.scheduled.reduce(
      (acc, s) => acc + (statusCounts.get(s) ?? 0),
      0,
    ),
    drafts: TAB_STATUSES.drafts.reduce(
      (acc, s) => acc + (statusCounts.get(s) ?? 0),
      0,
    ),
    failed: TAB_STATUSES.failed.reduce(
      (acc, s) => acc + (statusCounts.get(s) ?? 0),
      0,
    ),
  }

  const schoolTeams: SchoolTeamOption[] = (schoolTeamRows ?? []).map((c) => ({
    id: c.id,
    name: c.name,
  }))
  const schoolNameById = new Map(schoolTeams.map((s) => [s.id, s.name]))

  const fellows: FellowOption[] = (fellowRows ?? [])
    .filter((p) => p.role === 'fellow')
    .map((p) => ({
      id: p.id,
      fullName: p.full_name ?? p.email ?? 'Unnamed fellow',
      email: p.email ?? null,
      cohort: (p.cohort as string | null) ?? null,
    }))
  const fellowNameById = new Map(fellows.map((f) => [f.id, f.fullName]))

  const list: NotificationRowDto[] = (rows ?? []).map((r) => ({
    id: r.id,
    kind: r.kind,
    status: r.status,
    title: r.title,
    body: r.body,
    pinned: r.pinned,
    audience_scope: r.audience_scope,
    cohort_codes: (r.cohort_codes as string[] | null) ?? null,
    school_team_ids: (r.school_team_ids as string[] | null) ?? null,
    user_ids: (r.user_ids as string[] | null) ?? null,
    content_id: r.content_id,
    cta_label: r.cta_label,
    cta_url: r.cta_url,
    email_enabled: r.email_enabled,
    email_subject: r.email_subject,
    scheduled_for: r.scheduled_for,
    sent_at: r.sent_at,
    published_at: r.published_at,
    author: Array.isArray(r.author) ? r.author[0] ?? null : r.author ?? null,
    content: Array.isArray(r.content)
      ? r.content[0] ?? null
      : (r.content as NotificationRowDto['content']) ?? null,
  }))

  // Curriculum picker
  const yearById = new Map<string, { title: string; order_index: number }>()
  for (const y of yearRows ?? []) {
    yearById.set(y.id, {
      title: y.title,
      order_index: y.order_index ?? 0,
    })
  }
  const moduleById = new Map<
    string,
    { title: string; phase_id: string; order_index: number }
  >()
  for (const m of moduleRows ?? []) {
    moduleById.set(m.id, {
      title: m.title,
      phase_id: m.phase_id,
      order_index: m.order_index ?? 0,
    })
  }
  const contentOptions: ContentOption[] = (labRows ?? [])
    .map((lab) => {
      const mod = lab.module_id ? moduleById.get(lab.module_id) : null
      const yr = yearById.get(lab.year_id)
      const yearLabel = yr?.title ?? 'Phase'
      const modLabel = mod?.title ?? 'Module'
      return {
        id: lab.id,
        label: `${yearLabel} \u00b7 ${modLabel} \u2014 ${lab.title}`,
        phaseId: lab.year_id,
        phaseTitle: yearLabel,
        _sort: [
          yr?.order_index ?? 0,
          mod?.order_index ?? 0,
          lab.order_index ?? 0,
        ] as [number, number, number],
      }
    })
    .sort((a, b) => {
      for (let i = 0; i < 3; i++) {
        if (a._sort[i] !== b._sort[i]) return a._sort[i] - b._sort[i]
      }
      return a.label.localeCompare(b.label)
    })
    .map(({ _sort: _drop, ...rest }) => rest)

  const tabOrder: Tab[] = ['sent', 'scheduled', 'drafts', 'failed']

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <h2 className="font-serif text-2xl text-foreground">Notifications</h2>
          <p className="text-sm text-muted-foreground max-w-xl">
            Send announcements, reminders, and alerts to everyone, a cohort, a
            school team, or individual fellows. Optionally email recipients
            and schedule for later.
          </p>
        </div>
        <NewNotificationButton
          schoolTeams={schoolTeams}
          fellows={fellows}
          contentOptions={contentOptions}
          variant="header"
        />
      </div>

      {/* Status tabs */}
      <nav className="flex flex-wrap gap-1 border-b border-border">
        {tabOrder.map((t) => {
          const active = tab === t
          return (
            <Link
              key={t}
              href={t === 'sent' ? '/admin/notifications' : `/admin/notifications?tab=${t}`}
              className={`inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium ${
                active
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {TAB_LABELS[t]}
              {tabCounts[t] > 0 && (
                <span className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground">
                  {tabCounts[t]}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {list.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Megaphone className="h-6 w-6" />
            </EmptyMedia>
            <EmptyTitle>No {TAB_LABELS[tab].toLowerCase()} notifications</EmptyTitle>
          </EmptyHeader>
          {tab === 'sent' && (
            <div className="mt-4 flex justify-center">
              <NewNotificationButton
                schoolTeams={schoolTeams}
                fellows={fellows}
                contentOptions={contentOptions}
                variant="empty"
              />
            </div>
          )}
        </Empty>
      ) : (
        <div className="space-y-3">
          {list.map((row) => (
            <Card key={row.id} className="border-border">
              <CardContent className="p-5 flex items-start gap-4 flex-wrap">
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
                      row.kind === 'alert'
                        ? 'border-destructive/30 bg-destructive/10 text-destructive'
                        : row.kind === 'reminder'
                          ? 'border-primary/30 bg-primary-soft text-primary'
                          : 'border-border bg-muted text-muted-foreground'
                    }`}>
                      {NOTIFICATION_KIND_LABELS[row.kind]}
                    </span>
                    <h3 className="font-serif text-lg text-primary truncate">
                      {row.title}
                    </h3>
                    {row.pinned && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        <Pin className="h-3 w-3" aria-hidden />
                        Pinned
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" aria-hidden />
                      {audienceLabel(row, schoolNameById, fellowNameById)}
                    </span>
                    {row.email_enabled && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                        <Mail className="h-3 w-3" aria-hidden />
                        Email
                      </span>
                    )}
                    {row.status === 'scheduled' && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary-soft px-2 py-0.5 text-xs text-primary">
                        <Clock className="h-3 w-3" aria-hidden />
                        Scheduled
                      </span>
                    )}
                    {row.status === 'failed' && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                        <XCircle className="h-3 w-3" aria-hidden />
                        Failed
                      </span>
                    )}
                    {row.status === 'cancelled' && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                        Cancelled
                      </span>
                    )}
                    {row.status === 'sent' && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success-soft px-2 py-0.5 text-xs text-success">
                        <CheckCircle2 className="h-3 w-3" aria-hidden />
                        Sent
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                    {row.body}
                  </p>
                  {row.cta_label && row.cta_url && (
                    <p className="text-xs text-muted-foreground">
                      CTA: <span className="font-medium text-foreground">{row.cta_label}</span>{' '}
                      &rarr; <span className="font-mono">{row.cta_url}</span>
                    </p>
                  )}
                  {row.content && (
                    <Link
                      href={contentHref(row.content)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                    >
                      <BookOpen className="h-3.5 w-3.5" aria-hidden />
                      Pinned to: {row.content.title}
                    </Link>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {row.author?.full_name ?? 'Unknown author'} ·{' '}
                    {timestampLabelForRow(row)}{' '}
                    {formatDate(timestampForRow(row))}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {(row.status === 'draft' ||
                    row.status === 'scheduled' ||
                    row.status === 'failed') && (
                    <form action={sendNotificationNow}>
                      <input type="hidden" name="id" value={row.id} />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="sm"
                        aria-label="Send now"
                      >
                        <Send className="h-4 w-4 text-primary" />
                      </Button>
                    </form>
                  )}

                  {row.status === 'scheduled' && (
                    <form action={cancelScheduledNotification}>
                      <input type="hidden" name="id" value={row.id} />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="sm"
                        aria-label="Cancel schedule"
                      >
                        <XCircle className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </form>
                  )}

                  {row.status === 'sent' && (
                    <form action={toggleNotificationPin}>
                      <input type="hidden" name="id" value={row.id} />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="sm"
                        aria-label={row.pinned ? 'Unpin' : 'Pin'}
                      >
                        <Pin
                          className={`h-4 w-4 ${
                            row.pinned ? 'text-primary' : 'text-muted-foreground'
                          }`}
                        />
                      </Button>
                    </form>
                  )}

                  <NotificationDialog
                    mode="edit"
                    schoolTeams={schoolTeams}
                    fellows={fellows}
                    contentOptions={contentOptions}
                    initial={{
                      id: row.id,
                      kind: row.kind,
                      audience_scope:
                        row.audience_scope === 'year'
                          ? 'global'
                          : (row.audience_scope as AudienceScope),
                      cohort_codes: row.cohort_codes ?? [],
                      school_team_ids: row.school_team_ids ?? [],
                      user_ids: row.user_ids ?? [],
                      title: row.title,
                      body: row.body,
                      pinned: row.pinned,
                      content_id: row.content_id,
                      cta_label: row.cta_label,
                      cta_url: row.cta_url,
                      email_enabled: row.email_enabled,
                      email_subject: row.email_subject,
                      scheduled_for: row.scheduled_for,
                    }}
                    trigger={
                      <Button variant="ghost" size="sm" aria-label="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    }
                  />

                  <form action={deleteNotification}>
                    <input type="hidden" name="id" value={row.id} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="sm"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
