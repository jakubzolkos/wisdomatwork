import Link from 'next/link'
import {
  BookOpen,
  Building2,
  CalendarDays,
  Library,
  Megaphone,
  MessagesSquare,
  Users,
  Mail,
  FileText,
  Trash2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth-server'
import { PageHeader } from '@/components/page-header'

const fmt = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

function relativeTime(iso: string | null): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  const now = Date.now()
  const diff = Math.max(0, now - then)
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return fmt.format(new Date(iso))
}

export default async function AdminHomePage() {
  const admin = await requireAdmin()

  return (
    <div>
      {/* Greeting */}
      <PageHeader
        eyebrow="Admin console"
        title={`Welcome back, ${admin.fullName}`}
        description="Manage fellows, content, and communications across the portal."
      />

      {/* Quick management actions */}
      <section aria-label="Admin tools">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ActionCard
            href="/admin/users"
            icon={<Users className="size-[18px]" />}
            title="Users & cohorts"
            description="Invite fellows, set roles, assign cohort labels, deactivate accounts."
          />
          <ActionCard
            href="/admin/schools"
            icon={<Building2 className="size-[18px]" />}
            title="Schools & teams"
            description="Group fellows by school team for collaborative reporting and rosters."
          />
          <ActionCard
            href="/admin/curriculum"
            icon={<BookOpen className="size-[18px]" />}
            title="Curriculum"
            description="Author phases, items, and content blocks. Assign each to one or more cohorts."
          />
          <ActionCard
            href="/admin/library"
            icon={<Library className="size-[18px]" />}
            title="Library"
            description="Add, edit, and remove curated books, videos, podcasts, and other resources. Gate by cohort or publish as Recommended Resources."
          />
          <ActionCard
            href="/admin/community"
            icon={<MessagesSquare className="size-[18px]" />}
            title="Community"
            description="Moderate posts and events surfaced in the fellow community feed."
          />
          <ActionCard
            href="/admin/notifications"
            icon={<Megaphone className="size-[18px]" />}
            title="Notifications"
            description="Send announcements, reminders, and alerts. Targeted by cohort, school team, or specific fellows. Optionally email."
          />
          <ActionCard
            href="/admin/schedule"
            icon={<CalendarDays className="size-[18px]" />}
            title="Scheduling"
            description="Create scheduling polls, invite specific fellows to vote on availability, and finalize event times like WhenToMeet."
          />
          <ActionCard
            href="/admin/email-logs"
            icon={<Mail className="size-[18px]" />}
            title="Email logs"
            description="Track all emails sent in the past week. Monitor delivery status and resend failed emails."
          />
          <ActionCard
            href="/admin/custom-pages"
            icon={<FileText className="size-[18px]" />}
            title="Custom pages"
            description="Create and manage custom pages with rich content blocks, images, and text. Publish to the public site with custom URLs."
          />
          <ActionCard
            href="/admin/maintenance"
            icon={<Trash2 className="size-[18px]" />}
            title="Portal maintenance"
            description="Clean up test data, duplicate content, and unused resources. Manage invitations, archive drafts, and review audit logs."
          />
        </div>
      </section>
    </div>
  )
}

function ActionCard({
  href,
  icon,
  title,
  description,
}: {
  href: string
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <Link
      href={href}
      className="group flex h-full items-start gap-4 rounded-xl border bg-card p-5 shadow-xs transition hover:border-border-strong hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
        {icon}
      </span>
      <div className="min-w-0 space-y-1">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">{description}</p>
      </div>
    </Link>
  )
}
