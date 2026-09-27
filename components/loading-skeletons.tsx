'use client'

import { usePathname } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { TopBar } from '@/components/top-bar'

/*
 * Route-level loading placeholders. Rendered by the loading.tsx files
 * so a click paints immediately (and dynamic routes become
 * prefetchable up to the boundary) while the server renders the page.
 * Shapes mirror the real pages closely enough to avoid layout jumps.
 */

function HeaderSkeleton() {
  return (
    <div className="mb-8 space-y-3">
      <Skeleton className="h-3 w-28" />
      <Skeleton className="h-9 w-72 max-w-full" />
      <Skeleton className="h-4 w-96 max-w-full" />
    </div>
  )
}

function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-6 shadow-xs">
      <Skeleton className="h-5 w-1/3" />
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={i === lines - 1 ? 'h-4 w-2/3' : 'h-4 w-full'} />
      ))}
    </div>
  )
}

/** Generic page body: title block plus a few cards. */
export function PageBodySkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <HeaderSkeleton />
      <div className="space-y-4">
        <CardSkeleton />
        <div className="grid gap-4 sm:grid-cols-2">
          <CardSkeleton lines={2} />
          <CardSkeleton lines={2} />
        </div>
      </div>
    </div>
  )
}

/** Right pane of the course player: one article card. */
export function LessonSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="max-w-3xl">
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <div className="space-y-3 border-b border-border px-5 py-6 sm:px-8 sm:py-8">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <div className="space-y-3 px-5 py-6 sm:px-8">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="flex justify-end border-t border-border bg-muted/40 px-5 py-4 sm:px-8">
          <Skeleton className="h-9 w-36" />
        </div>
      </div>
    </div>
  )
}

/** Card grid, used by admin and library style pages. */
export function GridSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <HeaderSkeleton />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-xs">
            <Skeleton className="size-9 rounded-lg" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Full-page fallback for the root boundary (section switches and
 * standalone pages). Keeps the top bar on screen so switching tabs
 * doesn't flash an empty header; auth and poll pages have no top bar.
 */
export function AppShellSkeleton() {
  const pathname = usePathname() ?? ''
  const bare = pathname.startsWith('/auth') || pathname.startsWith('/schedule/')

  if (bare) {
    return <div className="min-h-screen bg-canvas" aria-busy="true" aria-label="Loading" />
  }

  return (
    <div className="min-h-screen bg-canvas">
      <TopBar />
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        <PageBodySkeleton />
      </div>
    </div>
  )
}
