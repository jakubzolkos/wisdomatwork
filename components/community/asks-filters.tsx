'use client'

import { useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ASK_CATEGORIES,
  ASK_STATUS_LABEL,
  type AskStatus,
} from '@/lib/community/ask-categories'

const ALL = '__all__'

/**
 * Asks filter row. Drives URL search params (`?category=`, `?status=`)
 * so server-rendered loads stay the source of truth and the filters
 * are shareable. Pairs with the `FeedSearchBar` (free-text) the
 * page already renders.
 */
export function AsksFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const category = searchParams.get('category') ?? ALL
  const status = searchParams.get('status') ?? ALL

  const updateParam = useCallback(
    (key: 'category' | 'status', value: string) => {
      const next = new URLSearchParams(searchParams)
      if (value === ALL) next.delete(key)
      else next.set(key, value)
      const qs = next.toString()
      router.push(qs ? `?${qs}` : '?')
    },
    [router, searchParams],
  )

  const showReset = category !== ALL || status !== ALL

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={category}
        onValueChange={(v) => updateParam('category', v)}
      >
        <SelectTrigger
          className="h-9 min-w-[10rem] bg-card"
          aria-label="Filter by category"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All categories</SelectItem>
          {ASK_CATEGORIES.map((c) => (
            <SelectItem key={c.value} value={c.value}>
              {c.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={status} onValueChange={(v) => updateParam('status', v)}>
        <SelectTrigger
          className="h-9 min-w-[10rem] bg-card"
          aria-label="Filter by status"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All statuses</SelectItem>
          {(Object.keys(ASK_STATUS_LABEL) as AskStatus[]).map((s) => (
            <SelectItem key={s} value={s}>
              {ASK_STATUS_LABEL[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {showReset && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="gap-1"
          onClick={() => {
            // Preserve the ?q= search term while clearing scope filters.
            const next = new URLSearchParams(searchParams)
            next.delete('category')
            next.delete('status')
            const qs = next.toString()
            router.push(qs ? `?${qs}` : '?')
          }}
        >
          <X aria-hidden="true" />
          Clear filters
        </Button>
      )}
    </div>
  )
}
