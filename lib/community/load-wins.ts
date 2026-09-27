import { createClient } from '@/lib/supabase/server'
import type { CommunityPostListItem } from '@/components/community/post-feed'
import { getSessionUser } from '@/lib/auth-server'

export interface WinsStats {
  total: number
  userWins: number
  avgRatingAll: number
  avgRatingUser: number
  frameworkCount: number
}

export interface FrameworkStats {
  framework: string
  count: number
  avgRating: number
  recentWins: CommunityPostListItem[]
}

export interface WinsOverTime {
  date: string
  count: number
  avgRating: number
}

/** Load aggregate wins statistics. */
export async function loadWinsStats(): Promise<WinsStats> {
  const supabase = await createClient()
  const user = await getSessionUser()

  // Get all wins
  const { data: allWins } = await supabase
    .from('community_posts')
    .select('id, star_rating, created_by, framework_resource_id')
    .eq('kind', 'win')
    .eq('is_archived', false)
    .not('published_at', 'is', null)

  if (!allWins || allWins.length === 0) {
    return {
      total: 0,
      userWins: 0,
      avgRatingAll: 0,
      avgRatingUser: 0,
      frameworkCount: 0,
    }
  }

  // Calculate average ratings
  const allRatings = allWins.filter((w) => w.star_rating).map((w) => w.star_rating!)
  const avgRatingAll = allRatings.length > 0 ? allRatings.reduce((a, b) => a + b, 0) / allRatings.length : 0

  // Get user's wins and ratings
  const userWins = allWins.filter((w) => w.created_by === user?.id) ?? []
  const userRatings = userWins.filter((w) => w.star_rating).map((w) => w.star_rating!)
  const avgRatingUser = userRatings.length > 0 ? userRatings.reduce((a, b) => a + b, 0) / userRatings.length : 0

  // Count unique frameworks
  const frameworks = new Set(
    allWins
      .filter((w) => w.framework_resource_id)
      .map((w) => w.framework_resource_id)
  )

  return {
    total: allWins.length,
    userWins: userWins.length,
    avgRatingAll: Math.round(avgRatingAll * 10) / 10,
    avgRatingUser: Math.round(avgRatingUser * 10) / 10,
    frameworkCount: frameworks.size,
  }
}

/** Load wins by framework with stats. */
export async function loadWinsByFramework(): Promise<FrameworkStats[]> {
  const supabase = await createClient()

  const { data: wins } = await supabase
    .from('community_posts')
    .select(
      `id, title, excerpt, body, cover_url, published_at, framework, star_rating,
       author:created_by(id, full_name, email, avatar_url)`
    )
    .eq('kind', 'win')
    .eq('is_archived', false)
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false })

  if (!wins) return []

  // Group by framework
  const byFramework = new Map<string, typeof wins>()
  for (const win of wins) {
    const fw = win.framework || 'Untagged'
    if (!byFramework.has(fw)) {
      byFramework.set(fw, [])
    }
    byFramework.get(fw)!.push(win)
  }

  const stats: FrameworkStats[] = []
  for (const [framework, winsInFw] of byFramework.entries()) {
    const ratings = winsInFw.filter((w) => w.star_rating).map((w) => w.star_rating!)
    const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0

    const recentWins: CommunityPostListItem[] = winsInFw.slice(0, 3).map((w: any) => ({
      id: w.id,
      title: w.title,
      excerpt: w.excerpt,
      body: w.body,
      cover_url: w.cover_url,
      published_at: w.published_at,
      kind: 'win',
      featured_at: null,
      is_archived: false,
      star_rating: w.star_rating,
      framework: w.framework,
      ask_category: null,
      ask_status: null,
      author: w.author,
    }))

    stats.push({
      framework,
      count: winsInFw.length,
      avgRating: Math.round(avgRating * 10) / 10,
      recentWins,
    })
  }

  return stats.sort((a, b) => b.count - a.count)
}

/** Load wins over time for the chart. */
export async function loadWinsOverTime(months = 6): Promise<WinsOverTime[]> {
  const supabase = await createClient()

  const startDate = new Date()
  startDate.setMonth(startDate.getMonth() - months)

  const { data: wins } = await supabase
    .from('community_posts')
    .select('published_at, star_rating')
    .eq('kind', 'win')
    .eq('is_archived', false)
    .not('published_at', 'is', null)
    .gte('published_at', startDate.toISOString())

  if (!wins) return []

  // Group by month
  const byMonth = new Map<string, { count: number; ratings: number[] }>()

  for (const win of wins) {
    if (!win.published_at) continue
    const date = new Date(win.published_at)
    const monthKey = date.toISOString().slice(0, 7) // YYYY-MM

    if (!byMonth.has(monthKey)) {
      byMonth.set(monthKey, { count: 0, ratings: [] })
    }

    const entry = byMonth.get(monthKey)!
    entry.count++
    if (win.star_rating) {
      entry.ratings.push(win.star_rating)
    }
  }

  // Convert to sorted array
  const result: WinsOverTime[] = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const monthKey = d.toISOString().slice(0, 7)

    const entry = byMonth.get(monthKey)
    if (entry) {
      const avgRating = entry.ratings.length > 0 ? entry.ratings.reduce((a, b) => a + b, 0) / entry.ratings.length : 0
      result.push({
        date: monthKey,
        count: entry.count,
        avgRating: Math.round(avgRating * 10) / 10,
      })
    }
  }

  return result
}

/** Load recent wins with full details. */
export async function loadRecentWins(limit = 10): Promise<CommunityPostListItem[]> {
  const supabase = await createClient()

  const { data: wins } = await supabase
    .from('community_posts')
    .select(
      `id, title, excerpt, body, cover_url, published_at, framework, featured_at, is_archived, star_rating,
       author:created_by(id, full_name, email, avatar_url)`
    )
    .eq('kind', 'win')
    .eq('is_archived', false)
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false })
    .limit(limit)

  if (!wins) return []

  return wins.map((w: any) => ({
    id: w.id,
    title: w.title,
    excerpt: w.excerpt,
    body: w.body,
    cover_url: w.cover_url,
    published_at: w.published_at,
    kind: 'win',
    featured_at: w.featured_at,
    is_archived: w.is_archived,
    star_rating: w.star_rating,
    framework: w.framework,
    ask_category: null,
    ask_status: null,
    author: w.author,
  }))
}
