import Link from 'next/link'
import { ADMIN_NAV_GROUPS } from '@/components/admin/admin-nav-items'
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
          {ADMIN_NAV_GROUPS.flatMap((group) => group.items)
            .filter((item) => item.description)
            .map(({ href, label, icon: Icon, description }) => (
              <ActionCard
                key={href}
                href={href}
                icon={<Icon className="size-[18px]" />}
                title={label}
                description={description!}
              />
            ))}
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
