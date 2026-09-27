'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { ChevronRight, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CurriculumPhase, CurriculumModule } from '@/lib/curriculum-tree'

interface ContentFlowProps {
  phases: CurriculumPhase[]
  currentContentId?: string
}

/**
 * Content flow navigator that shows the user's progress through the
 * curriculum with visual indicators. Displays completed items with
 * blue circles and enables navigation between sequential content.
 */
export function ContentFlow({ phases, currentContentId }: ContentFlowProps) {
  const flowItems = useMemo(() => {
    const items: Array<{
      id: string
      title: string
      phaseName: string
      moduleName: string
      href: string
      isCompleted: boolean
      isCurrent: boolean
    }> = []

    for (const phase of phases) {
      for (const module of phase.modules) {
        for (const item of module.items) {
          items.push({
            id: item.id,
            title: item.title,
            phaseName: phase.title,
            moduleName: module.title,
            href: item.href,
            isCompleted: item.isCompleted,
            isCurrent: item.id === currentContentId,
          })
        }
      }
    }

    return items
  }, [phases, currentContentId])

  if (flowItems.length === 0) return null

  const currentIndex = flowItems.findIndex((i) => i.isCurrent)
  const previousItem = currentIndex > 0 ? flowItems[currentIndex - 1] : null
  const nextItem = currentIndex < flowItems.length - 1 ? flowItems[currentIndex + 1] : null
  const completedCount = flowItems.filter((i) => i.isCompleted).length
  const progressPercent = Math.round((completedCount / flowItems.length) * 100)

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-foreground">Your Progress</span>
          <span className="text-muted-foreground">
            {completedCount} of {flowItems.length} completed
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Navigation */}
      {(previousItem || nextItem) && (
        <div className="flex gap-3">
          {previousItem && (
            <Link
              href={previousItem.href}
              className={cn(
                'flex-1 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-accent/60',
              )}
            >
              <div className="text-xs text-muted-foreground">Previous</div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-sm font-medium text-foreground line-clamp-1">
                  {previousItem.title}
                </span>
                {previousItem.isCompleted && (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                )}
              </div>
            </Link>
          )}

          {nextItem && (
            <Link
              href={nextItem.href}
              className={cn(
                'flex-1 rounded-lg border border-primary/20 bg-primary-soft px-4 py-3 transition-colors hover:border-primary/40',
              )}
            >
              <div className="text-xs text-primary font-medium">Next</div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-sm font-medium text-foreground line-clamp-1">
                  {nextItem.title}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-primary" />
              </div>
            </Link>
          )}
        </div>
      )}

      {/* Current position */}
      {currentIndex >= 0 && (
        <div className="rounded-lg bg-muted/50 px-4 py-3">
          <div className="text-xs text-muted-foreground">
            You are on step {currentIndex + 1} of {flowItems.length}
          </div>
          <div className="mt-1 text-sm font-medium text-foreground">
            {flowItems[currentIndex].phaseName} → {flowItems[currentIndex].moduleName}
          </div>
        </div>
      )}
    </div>
  )
}
