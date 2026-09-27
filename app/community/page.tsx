import Link from 'next/link'
import { ArrowRight, CalendarDays } from 'lucide-react'
import { requireUser } from '@/lib/auth-server'
import { createClient } from '@/lib/supabase/server'
import { COMMUNITY_SECTIONS } from '@/lib/community/sections'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/page-header'

export const metadata = {
  title: 'Community | Leadership Fellowship',
  description:
    'Connect with the Fellowship - explore bios, share wins, reflections, and questions with peers.',
}

interface SectionCountQuery {
  count: number | null
}

export default async function CommunityOverviewPage() {
  await requireUser()
  const supabase = await createClient()

  // Get counts for all sections
  const countPromises = COMMUNITY_SECTIONS.map((s) => {
    if (s.slug === 'bios') {
      return supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .in('role', ['fellow', 'facilitator'])
        .is('deactivated_at', null)
    }
    if (s.slug === 'schools') {
      return supabase
        .from('cohorts')
        .select('id', { count: 'exact', head: true })
    }
    if (s.slug === 'reflections') {
      return supabase
        .from('user_content_reflections')
        .select('id', { count: 'exact', head: true })
        .neq('visibility', 'private')
    }
    return supabase
      .from('community_posts')
      .select('id', { count: 'exact', head: true })
      .in('kind', s.postKinds ?? [])
      .not('published_at', 'is', null)
  })

  const countResults = await Promise.all(countPromises)

  const counts = COMMUNITY_SECTIONS.map((s, i) => ({
    section: s,
    count: countResults[i].count ?? 0,
  }))

  // Highlight featured sections (Reflections)
  const featuredSections = counts.filter((c) => 
    c.section.slug === 'reflections'
  )
  
  const otherSections = counts.filter((c) => 
    c.section.slug !== 'reflections'
  )

  return (
    <div className="space-y-10">
      <PageHeader
        className="mb-0"
        eyebrow="Community of Practice"
        title="Welcome to the Fellowship"
        description="Connect with your peers, celebrate progress, and learn from shared experiences across the program."
        actions={
          /* Quick path to the curated weekly read-out. */
          <Button asChild variant="outline" size="sm">
            <Link href="/community/dashboard">
              <CalendarDays aria-hidden="true" />
              This week&apos;s dashboard
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        }
      />

      {/* Featured Sections */}
      {featuredSections.length > 0 && (
        <section className="space-y-4">
          <h2>Featured sections</h2>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {featuredSections.map(({ section, count }) => {
              const Icon = section.icon
              return (
                <li key={section.id}>
                  <Link
                    href={`/community/${section.slug}`}
                    className="group flex h-full flex-col gap-4 rounded-xl border bg-card p-6 shadow-xs transition hover:border-border-strong hover:shadow-md"
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex size-10 items-center justify-center rounded-lg bg-primary-soft text-primary">
                        <Icon className="size-[18px]" aria-hidden="true" />
                      </span>
                      <Badge variant="secondary" className="tabular-nums">
                        {count}
                      </Badge>
                    </div>
                    <div className="space-y-1.5">
                      <h3 className="text-lg">{section.label}</h3>
                      <p className="text-[15px] leading-relaxed text-muted-foreground">
                        {section.description}
                      </p>
                    </div>
                    <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-primary">
                      Explore
                      <ArrowRight
                        className="size-3.5 transition-transform group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* All Sections Grid */}
      <section className="space-y-4">
        <h2>Browse all sections</h2>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {otherSections.map(({ section, count }) => {
            const Icon = section.icon
            return (
              <li key={section.id}>
                <Link
                  href={`/community/${section.slug}`}
                  className="group flex h-full flex-col gap-3 rounded-xl border bg-card p-5 shadow-xs transition hover:border-border-strong hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <Badge variant="secondary" className="tabular-nums">
                      {count}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <h3>{section.label}</h3>
                    <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                      {section.description}
                    </p>
                  </div>
                  <span className="mt-auto inline-flex items-center gap-1 pt-1 text-sm font-medium text-muted-foreground transition-colors group-hover:text-primary">
                    Open
                    <ArrowRight
                      className="size-3.5 transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
