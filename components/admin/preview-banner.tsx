'use client'

import { Eye, X } from 'lucide-react'
import { endPreview } from '@/app/admin/preview/actions'
import { Button } from '@/components/ui/button'

type AdminPreviewBannerProps = {
  label: string
  mode: 'by_fellow' | 'by_cohort'
  actualAdminName: string
}

export function AdminPreviewBanner({
  label,
  mode,
  actualAdminName,
}: AdminPreviewBannerProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="relative z-[60] w-full border-b border-warning/30 bg-warning-soft"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-1.5 text-sm">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-md text-warning">
            <Eye className="size-4" aria-hidden="true" />
          </span>
          <p className="min-w-0 truncate text-foreground">
            <span className="font-semibold text-warning">Preview mode</span>
            <span className="mx-2 text-muted-foreground">·</span>
            Viewing as{' '}
            <span className="font-medium">{label}</span>
            <span className="mx-2 text-muted-foreground">·</span>
            <span className="text-muted-foreground">
              {mode === 'by_fellow' ? 'fellow profile' : 'cohort sample'}
            </span>
            <span className="mx-2 hidden text-muted-foreground sm:inline">·</span>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              signed in as {actualAdminName}
            </span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <form action={endPreview}>
            <Button type="submit" size="sm" variant="outline" className="h-7 gap-1.5 bg-card text-xs">
              <X className="size-3.5" aria-hidden="true" />
              Exit preview
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
