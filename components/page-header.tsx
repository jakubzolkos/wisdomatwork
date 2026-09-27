import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  /** Small uppercase label above the title, e.g. the section name. */
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  /** Buttons or other controls, right-aligned on wide screens. */
  actions?: ReactNode
  className?: string
}

/**
 * Standard page title block. Every top-level page should open with
 * this so titles share one size, weight and spacing across the app.
 */
export function PageHeader({ eyebrow, title, description, actions, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        'mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-8',
        className,
      )}
    >
      <div className="min-w-0 space-y-2">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1 className="text-balance text-3xl sm:text-[2.125rem]">{title}</h1>
        {description ? (
          <p className="max-w-2xl text-pretty text-[15px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  )
}
