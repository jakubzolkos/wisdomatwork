'use client'

import { Star, TrendingUp, Award } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { WinsStats, FrameworkStats, WinsOverTime } from '@/lib/community/load-wins'
import type { CommunityPostListItem } from '@/components/community/post-feed'

interface WinsDashboardProps {
  stats: WinsStats
  frameworkStats: FrameworkStats[]
  winsOverTime: WinsOverTime[]
  recentWins: CommunityPostListItem[]
}

export function WinsDashboard({
  stats,
  frameworkStats,
  winsOverTime,
  recentWins,
}: WinsDashboardProps) {
  return (
    <div className="flex flex-col gap-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Award}
          label="You Shared"
          value={stats.userWins.toString()}
          description="Wins you've posted"
        />
        <StatCard
          icon={Star}
          label="All Fellows Avg"
          value={`${stats.avgRatingAll.toFixed(1)} / 5`}
          description="Community rating"
        />
        <StatCard
          icon={Star}
          label="Your Avg"
          value={`${stats.avgRatingUser.toFixed(1)} / 5`}
          description="Your wins rating"
        />
        <StatCard
          icon={TrendingUp}
          label="Frameworks"
          value={stats.frameworkCount.toString()}
          description="Protocols being used"
        />
      </div>

      {/* Framework Breakdown */}
      {frameworkStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              Wins by Framework
            </CardTitle>
            <CardDescription>
              How schools are applying each practice
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {frameworkStats.slice(0, 5).map((fw) => (
                <div key={fw.framework} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">
                      {fw.framework}
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        {fw.count} win{fw.count !== 1 ? 's' : ''}
                      </Badge>
                      <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                        <Star className="size-3 fill-warning text-warning" />
                        {fw.avgRating.toFixed(1)}
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{
                        width: `${(fw.count / (frameworkStats[0]?.count || 1)) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Wins */}
      {recentWins.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              Recent Wins
            </CardTitle>
            <CardDescription>
              Latest celebrations from the community
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {recentWins.map((win) => (
                <li
                  key={win.id}
                  className="flex flex-col gap-1 py-3 text-sm first:pt-0 last:pb-0"
                >
                  <p className="font-medium text-foreground line-clamp-1">
                    {win.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    By {win.author?.full_name || 'Anonymous'} ·{' '}
                    {win.published_at
                      ? new Date(win.published_at).toLocaleDateString()
                      : 'Recently'}
                  </p>
                  {win.framework && (
                    <Badge variant="secondary" className="mt-1 w-fit">
                      {win.framework.title}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  description: string
}

function StatCard({ icon: Icon, label, value, description }: StatCardProps) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">
            {value}
          </p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
          <Icon className="size-4" />
        </div>
      </div>
    </div>
  )
}
