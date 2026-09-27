'use client'

import { useEffect, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Props {
  placeholder?: string
  /**
   * URL search-param key used to round-trip the query. Defaults to
   * `q`. Exposed as a prop so different sections can use different
   * keys if they ever conflict (e.g. with category filters).
   */
  paramKey?: string
  /** Optional wrapper class for layout integration. */
  className?: string
}

/**
 * Tiny search bar that keeps a single text query in the URL. Submits
 * on Enter so server components can re-fetch via the new searchParam
 * without any client data fetching. Hashtags work for free since the
 * server-side filter does an ILIKE on the body.
 */
export function FeedSearchBar({
  placeholder = 'Search posts',
  paramKey = 'q',
  className,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const initial = params.get(paramKey) ?? ''
  const [value, setValue] = useState(initial)
  const [, startTransition] = useTransition()

  // Keep the local value in sync if the URL changes from outside
  // (e.g. clicking a hashtag link elsewhere). Cheap to do.
  useEffect(() => {
    setValue(initial)
  }, [initial])

  function commit(next: string) {
    const sp = new URLSearchParams(params.toString())
    if (next.trim()) sp.set(paramKey, next.trim())
    else sp.delete(paramKey)
    const qs = sp.toString()
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname)
    })
  }

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        commit(value)
      }}
      className={[
        'flex w-full max-w-md items-center gap-2',
        className ?? '',
      ].join(' ').trim()}
    >
      <div className="relative flex-1">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-9 bg-card pl-9 pr-8"
          aria-label="Search posts"
        />
        {value.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setValue('')
              commit('')
            }}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>
      <Button type="submit" variant="outline">
        Search
      </Button>
    </form>
  )
}
