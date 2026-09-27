import Link from 'next/link'
import {
  ArrowRight,
  BookOpen,
  HelpCircle,
  MessageSquare,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react'
import { requireUser } from '@/lib/auth-server'
import { createClient } from '@/lib/supabase/server'
import { ASK_CATEGORY_BY_VALUE } from '@/lib/community/ask-categories'
import { loadCommunityDashboard } from '@/lib/community/load-dashboard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { PageHeader } from '@/components/page-header'

export const dynamic = 'force-dynamic'

/**
 * Community dashboard - the "what's happening" page for fellows.
 *
 * Surfaces:
 *   - Counts across the four feeds + member directory
 *   - Featured (admin-pinned) win for the week
 *   - The five most recent items per feed
 *   - Open asks needing replies, so help finds the people who can give it
 *   - The current member of the week (if any)
 *
 * The page is intentionally read-only: composers live on the
 * individual section pages so the dashboard stays a pure overview.
 */
export default async function CommunityDashboardPage() {
  await requireUser()
  const data = await loadCommunityDashboard()

  return (
    <>
      <div className="flex flex-col">
      <PageHeader
        eyebrow="Community of Practice"
        title="What’s happening this week"
        description={
          <>
            A quick read-out of who&apos;s sharing, asking, and learning together.
            Jump into a feed to write or comment.
          </>
        }
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/community">All sections</Link>
          </Button>
        }
      />

      {/* Stat tiles */}
      <section
        aria-label="Community at a glance"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
      >
        <StatTile
          href="/community/bios"
          icon={Users}
          label="Members"
          value={data.counts.members}
        />
        <StatTile
          href="/community/wins"
          icon={Trophy}
          label="Wins"
          value={data.counts.wins}
        />
        <StatTile
          href="/community/ask"
          icon={HelpCircle}
          label="Open asks"
          value={data.counts.openAsks}
          accent
        />
        <StatTile
          href="/community/reflections"
          icon={BookOpen}
          label="Reflections"
          value={data.counts.reflections}
        />
        <StatTile
          href="/community/stories"
          icon={MessageSquare}
          label="Stories"
          value={data.counts.stories}
        />
      </section>

      <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Featured win + recent wins */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="size-4 text-muted-foreground" aria-hidden="true" />
                Wins
              </CardTitle>
              <CardDescription>
                Celebrations from the field, plus the post staff pinned this week.
              </CardDescription>
            </div>
            <Button asChild size="sm" variant="ghost">
              <Link href="/community/wins" className="gap-1">
                See all <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {data.featuredWin ? (
              <Link
                href={`/community/stories/${data.featuredWin.id}`}
                className="group rounded-lg bg-muted/60 p-4 transition-colors hover:bg-accent"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="gap-1 bg-card">
                    <Sparkles className="text-highlight" />
                    Featured
                  </Badge>
                  {data.featuredWin.framework?.title && (
                    <Badge variant="outline">
                      {data.featuredWin.framework.title}
                    </Badge>
                  )}
                </div>
                <h3 className="mt-2.5 text-base leading-snug group-hover:text-primary">
                  {data.featuredWin.title}
                </h3>
                {data.featuredWin.excerpt && (
                  <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                    {data.featuredWin.excerpt}
                  </p>
                )}
                <AuthorLine
                  name={data.featuredWin.author?.full_name ?? null}
                  email={data.featuredWin.author?.email ?? null}
                  image={data.featuredWin.author?.avatar_url ?? null}
                  timestamp={data.featuredWin.published_at}
                />
              </Link>
            ) : (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                No featured win yet this week. Staff can pin one from any wins
                post.
              </p>
            )}

            {data.recentWins.length > 0 ? (
              <ul className="flex flex-col divide-y divide-border">
                {data.recentWins.map((post) => (
                  <li key={post.id}>
                    <Link
                      href={`/community/stories/${post.id}`}
                      className="-mx-2 block rounded-md px-2 py-3 transition-colors hover:bg-accent/60"
                    >
                      <p className="font-medium text-foreground">{post.title}</p>
                      <AuthorLine
                        name={post.author?.full_name ?? null}
                        email={post.author?.email ?? null}
                        image={post.author?.avatar_url ?? null}
                        timestamp={post.published_at}
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>

        {/* Member of the week */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-4 text-muted-foreground" aria-hidden="true" />
              Member of the week
            </CardTitle>
            <CardDescription>
              Someone whose practice we&apos;re learning from right now.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.memberOfWeek ? (
              <Link
                href={`/community/bios#${data.memberOfWeek.id}`}
                className="group flex items-start gap-3"
              >
                <Avatar className="size-14">
                  <AvatarImage
                    src={data.memberOfWeek.avatar_url ?? undefined}
                    alt=""
                  />
                  <AvatarFallback className="bg-primary-soft text-primary">
                    {initialsFor(
                      data.memberOfWeek.full_name,
                      data.memberOfWeek.email,
                    )}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold leading-tight text-foreground group-hover:text-primary">
                    {data.memberOfWeek.full_name ?? 'Member'}
                  </p>
                  {data.memberOfWeek.title && (
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {data.memberOfWeek.title}
                    </p>
                  )}
                  {data.memberOfWeek.community_role && (
                    <Badge variant="outline" className="mt-2 capitalize">
                      {data.memberOfWeek.community_role.replace(/_/g, ' ')}
                    </Badge>
                  )}
                </div>
              </Link>
            ) : (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                No member of the week scheduled. Admins can pick one from{' '}
                <Link
                  href="/admin/community/moderation"
                  className="underline hover:text-foreground"
                >
                  Admin → Moderation
                </Link>
                .
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Open asks */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <HelpCircle
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                Open asks
              </CardTitle>
              <CardDescription>
                Questions waiting on a reply. If you know the answer, say so.
              </CardDescription>
            </div>
            <Button asChild size="sm" variant="ghost">
              <Link href="/community/ask" className="gap-1">
                See all <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {data.openAsks.length === 0 ? (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                No open asks at the moment.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {data.openAsks.map((post) => (
                  <li key={post.id}>
                    <Link
                      href={`/community/stories/${post.id}`}
                      className="-mx-2 block rounded-md px-2 py-3 transition-colors hover:bg-accent/60"
                    >
                      <div className="flex items-start gap-2">
                        <p className="flex-1 font-medium text-foreground">
                          {post.title}
                        </p>
                        {post.ask_category && (
                          <Badge variant="outline" className="shrink-0">
                            {ASK_CATEGORY_BY_VALUE[post.ask_category]?.label ??
                              post.ask_category}
                          </Badge>
                        )}
                      </div>
                      <AuthorLine
                        name={post.author?.full_name ?? null}
                        email={post.author?.email ?? null}
                        image={post.author?.avatar_url ?? null}
                        timestamp={post.published_at}
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Recent reflections */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="size-4 text-muted-foreground" aria-hidden="true" />
                Latest reflections
              </CardTitle>
              <CardDescription>From phase labs and content.</CardDescription>
            </div>
            <Button asChild size="sm" variant="ghost">
              <Link href="/community/reflections" className="gap-1">
                See all <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {data.recentReflections.length === 0 ? (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                No reflections yet.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {data.recentReflections.map((r) => (
                  <li
                    key={r.id}
                    className="rounded-lg bg-muted/60 p-3"
                  >
                    {/* Breadcrumb back to the lab so readers know where the
                        reflection came from. */}
                    {r.content && (
                      <p className="text-xs text-muted-foreground">
                        {r.content.lab?.phase?.title && (
                          <>
                            {r.content.lab.phase.title}
                            <span className="mx-1">·</span>
                          </>
                        )}
                        {r.content.lab?.title ?? r.content.title ?? 'Lab'}
                      </p>
                    )}
                    <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-foreground">
                      {r.body}
                    </p>
                    <AuthorLine
                      name={r.profile?.full_name ?? null}
                      email={r.profile?.email ?? null}
                      image={r.profile?.avatar_url ?? null}
                      timestamp={r.created_at}
                    />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
    </>
  )
}

/**
 * Compact tile used in the top stat strip. Each tile is a link into
 * the corresponding feed so a single tap deep-links to the relevant
 * page.
 */
function StatTile({
  href,
  icon: Icon,
  label,
  value,
  accent = false,
}: {
  href: string
  icon: typeof Users
  label: string
  value: number
  accent?: boolean
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-xs transition hover:border-border-strong hover:shadow-md"
    >
      <span className="flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
        {label}
        <span
          className={
            accent
              ? 'flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground'
              : 'flex size-7 items-center justify-center rounded-md bg-primary-soft text-primary'
          }
        >
          <Icon className="size-3.5" aria-hidden="true" />
        </span>
      </span>
      <span className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">
        {value}
      </span>
    </Link>
  )
}

/**
 * Author + timestamp byline shared by the post lists.
 */
function AuthorLine({
  name,
  email,
  image,
  timestamp,
}: {
  name: string | null
  email: string | null
  image: string | null
  timestamp?: string | null
}) {
  return (
    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
      <Avatar className="size-5">
        <AvatarImage src={image ?? undefined} alt="" />
        <AvatarFallback className="bg-primary-soft text-[10px] text-primary">
          {initialsFor(name, email)}
        </AvatarFallback>
      </Avatar>
      <span className="truncate">{name ?? 'Member'}</span>
      {timestamp && (
        <>
          <span aria-hidden="true">·</span>
          <span>{formatRelative(timestamp)}</span>
        </>
      )}
    </div>
  )
}

/** Extract initials from a name or email. */
function initialsFor(name: string | null, email: string | null): string {
  if (name) {
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase())
      .filter(Boolean)
      .join('')
  }
  if (email) {
    return email[0]?.toUpperCase() ?? '?'
  }
  return '?'
}

/** Relative timestamp shared by all dashboard cards. */
function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(ms)) return ''
  const minutes = Math.round(ms / 60_000)
  if (minutes < 60) return minutes <= 1 ? 'just now' : `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.round(days / 7)
  if (weeks < 5) return `${weeks}w ago`
  return new Date(iso).toLocaleDateString()
}
