import { requireUser } from '@/lib/auth-server'
import { Star, TrendingUp, Award, Calendar } from 'lucide-react'
import { FeedSearchBar } from '@/components/community/feed-search-bar'
import { PostFeed } from '@/components/community/post-feed'
import { SectionHeader } from '@/components/community/section-header'
import { getSectionBySlug } from '@/lib/community/sections'
import { loadSectionPosts } from '@/lib/community/load-section'
import { loadMyResourcesPwfProtocols } from '@/lib/community/load-my-pwf-protocols'
import {
  loadWinsStats,
  loadWinsByFramework,
  loadWinsOverTime,
  loadRecentWins,
} from '@/lib/community/load-wins'
import { WinsDashboard } from '@/components/community/wins-dashboard'

export const metadata = {
  title: 'Wins & Progress | Community | Leadership Fellowship',
}

interface PageProps {
  searchParams: Promise<{ q?: string | string[] }>
}

/**
 * /community/wins - Celebrations of how schools are applying the
 * framework. Includes analytics dashboard showing stats, framework
 * breakdowns, and trends over time. Open to every authenticated user.
 */
export default async function WinsPage({ searchParams }: PageProps) {
  const user = await requireUser()
  const sp = await searchParams
  const rawQ = Array.isArray(sp.q) ? sp.q[0] : sp.q
  const query = (rawQ ?? '').trim()

  const section = getSectionBySlug('wins')!

  const [
    posts,
    frameworks,
    stats,
    frameworkStats,
    winsOverTime,
    recentWins,
  ] = await Promise.all([
    loadSectionPosts('wins', { query: query || undefined }),
    loadMyResourcesPwfProtocols(),
    loadWinsStats(),
    loadWinsByFramework(),
    loadWinsOverTime(6),
    loadRecentWins(5),
  ])

  const isStaff = user.role === 'admin' || user.role === 'facilitator'

  return (
    <>
      <div className="flex flex-col">
      <SectionHeader
        section={section}
        canPost={true}
        frameworks={frameworks}
        requireStarRating
        requireVisibilitySettings
      />

      <div className="space-y-10">
      {/* Analytics Dashboard */}
      <WinsDashboard
        stats={stats}
        frameworkStats={frameworkStats}
        winsOverTime={winsOverTime}
        recentWins={recentWins}
      />

      {/* Search and Feed */}
      <section className="space-y-4 border-t pt-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <FeedSearchBar placeholder="Search wins, hashtags, frameworks…" />
          {query && (
            <p className="text-xs text-muted-foreground">
              Showing wins matching{' '}
              <span className="font-medium text-foreground">&ldquo;{query}&rdquo;</span>
            </p>
          )}
        </div>

        <PostFeed
          posts={posts}
          emptyTitle={
            query ? 'No wins match that search' : section.emptyTitle
          }
          emptyCopy={
            query
              ? 'Try a different keyword or hashtag, or clear the search to see every win.'
              : section.emptyCopy
          }
          isStaff={isStaff}
        />
      </section>
      </div>
    </div>
    </>
  )
}
