'use client'

import Link from 'next/link'
import useSWR from 'swr'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'

const fetcher = (url: string) =>
  fetch(url, { cache: 'no-store' }).then(async (res) => {
    if (!res.ok) return { count: 0 }
    return (await res.json()) as { count: number }
  })

/**
 * Lightweight bell that lives in the top bar. Uses SWR to keep the
 * unread count fresh without forcing a full layout refresh; revalidates
 * on focus and every 60 seconds. Clicking takes the user to the full
 * notifications inbox where they can mark items read.
 */
export function NotificationsBell() {
  const { data } = useSWR<{ count: number }>(
    '/api/notifications/unread-count',
    fetcher,
    {
      refreshInterval: 60_000,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    },
  )

  const count = data?.count ?? 0
  const display = count > 99 ? '99+' : String(count)

  const hasUnread = count > 0

  return (
    <Button
      asChild
      variant="ghost"
      size="icon"
      className="relative text-muted-foreground hover:text-foreground"
      aria-label={
        hasUnread ? `Notifications (${count} unread)` : 'Notifications'
      }
    >
      <Link href="/notifications">
        {/* Unread count badge in the top-right corner of the bell. */}
        <Bell className="relative h-5 w-5" aria-hidden />
        {hasUnread ? (
          <span
            className="absolute right-0.5 top-0.5 inline-flex min-w-[17px] items-center justify-center rounded-full bg-highlight px-1 text-[10px] font-semibold leading-[17px] text-highlight-foreground ring-2 ring-background"
            aria-hidden
          >
            {display}
          </span>
        ) : null}
      </Link>
    </Button>
  )
}
