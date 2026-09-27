'use client'

import { usePathname } from 'next/navigation'
import { useTransition } from 'react'
import { ChevronDown, Eye } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { COHORTS, type Cohort } from '@/lib/cohorts'
import { startPreviewAsCohort } from '@/app/admin/preview/actions'

/**
 * Top-bar shortcut for the admin "Preview as cohort" mode. Picking a
 * cohort starts a preview as a brand-new fellow in that cohort and
 * lands on /dashboard; the preview banner handles exiting, which
 * returns the admin to the page they launched from.
 */
export function PreviewCohortMenu() {
  const pathname = usePathname()
  const [pending, startTransition] = useTransition()

  function start(cohort: Cohort) {
    const fd = new FormData()
    fd.set('cohort', cohort)
    fd.set('referrer', pathname)
    startTransition(() => startPreviewAsCohort(fd))
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={pending}
        className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-60"
      >
        <Eye className="h-4 w-4" />
        Preview
        <ChevronDown className="h-3.5 w-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          View the site as a new fellow in…
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {COHORTS.map((c) => (
          <DropdownMenuItem
            key={c}
            onSelect={() => start(c)}
            className="cursor-pointer"
          >
            Cohort {c}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
