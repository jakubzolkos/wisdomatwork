'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  AlertTriangle,
  Bell,
  BookOpen,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Megaphone,
  Pin,
  Trash2,
  X,
} from 'lucide-react'
import {
  dismissAllNotificationsAction,
  dismissNotificationAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from '@/lib/notifications/actions'
import type { NotificationKind } from '@/lib/notifications/types'

export interface FeedItemView {
  id: string
  kind: NotificationKind
  title: string
  body: string
  pinned: boolean
  publishedAt: string
  readAt: string | null
  author: { name: string; initials: string } | null
  ctaLabel: string | null
  ctaUrl: string | null
  content: { id: string; title: string; href: string } | null
}

interface Props {
  items: FeedItemView[]
  /** When true, render as a card with a collapse toggle (dashboard layout). */
  collapsible?: boolean
  /** Optional title override. */
  heading?: string
  /** When true, hide the "View all" footer link (e.g. on /notifications). */
  hideViewAll?: boolean
}

const KIND_META: Record<
  NotificationKind,
  { label: string; icon: typeof Bell; tone: string; accent: string }
> = {
  announcement: {
    label: 'Announcement',
    icon: Megaphone,
    tone: 'bg-secondary text-secondary-foreground',
    accent: 'text-muted-foreground',
  },
  reminder: {
    label: 'Reminder',
    icon: Bell,
    tone: 'bg-primary-soft text-primary',
    accent: 'text-primary',
  },
  alert: {
    label: 'Alert',
    icon: AlertTriangle,
    tone: 'bg-destructive/10 text-destructive',
    accent: 'text-destructive',
  },
}

function useNow(intervalMs = 60_000): number | null {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

function formatRelativeTime(isoDate: string, now: number): string {
  const diffMs = new Date(isoDate).getTime() - now
  const diffMins = Math.floor(diffMs / 60_000)
  if (diffMins < 0) {
    const absMins = Math.abs(diffMins)
    if (absMins < 60) return `${absMins}m ago`
    const hours = Math.floor(absMins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }
  if (diffMins < 60) return `in ${diffMins}m`
  const hours = Math.floor(diffMins / 60)
  if (hours < 24) return `in ${hours}h`
  const days = Math.floor(hours / 24)
  return `in ${days}d`
}

export function NotificationsFeed({
  items,
  collapsible = false,
  heading = 'Notifications',
  hideViewAll = false,
}: Props) {
  const [expanded, setExpanded] = useState(true)
  const now = useNow()
  const router = useRouter()
  // Local optimistic dismissed state. The server action revalidates
  // /dashboard and /notifications, but we hide rows immediately so
  // the UI feels instant - especially on Clear all.
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())

  const visibleItems = useMemo(
    () => items.filter((i) => !dismissedIds.has(i.id)),
    [items, dismissedIds],
  )
  const unreadCount = useMemo(
    () => visibleItems.filter((i) => !i.readAt).length,
    [visibleItems],
  )

  const inner = (
    <>
      <div
        className={`flex items-center justify-between gap-2 px-5 py-4 sm:px-6 ${expanded ? 'border-b border-border' : ''}`}
      >
        {collapsible ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex flex-1 items-center justify-between gap-2 rounded-md text-left"
            aria-expanded={expanded}
          >
            <span className="flex items-center gap-2">
              <h3 className="text-base">{heading}</h3>
              {unreadCount > 0 && (
                <span className="rounded-full bg-primary-soft px-2 py-px text-xs font-medium tabular-nums text-primary">
                  {unreadCount} new
                </span>
              )}
            </span>
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" aria-hidden />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden />
            )}
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <h3 className="text-base">{heading}</h3>
            {unreadCount > 0 && (
              <span className="rounded-full bg-primary-soft px-2 py-px text-xs font-medium tabular-nums text-primary">
                {unreadCount} new
              </span>
            )}
          </div>
        )}
        {expanded && visibleItems.length > 0 && (
          <div className="flex items-center gap-1">
            {unreadCount > 0 && <MarkAllReadButton />}
            <ClearAllButton
              count={visibleItems.length}
              onCleared={() => {
                // Hide every currently-visible row immediately. The
                // server action revalidates the page but a local
                // optimistic update gives the user instant feedback.
                setDismissedIds(
                  (prev) =>
                    new Set([...prev, ...visibleItems.map((i) => i.id)]),
                )
                router.refresh()
              }}
            />
          </div>
        )}
      </div>

      {expanded && (
        <div>
          {visibleItems.length === 0 ? (
            <div className="px-5 py-10 text-center sm:px-6">
              <span className="mx-auto flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <Bell className="size-4" aria-hidden />
              </span>
              <p className="mx-auto mt-3 max-w-sm text-sm text-muted-foreground">
                You&apos;re all caught up. New notifications from the fellowship
                team will show up here.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {visibleItems.map((item) => (
                <li key={item.id}>
                  <FeedRow
                    item={item}
                    now={now ?? new Date(item.publishedAt).getTime()}
                    onDismissed={() => {
                      setDismissedIds((prev) => new Set(prev).add(item.id))
                      router.refresh()
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
          {!hideViewAll && visibleItems.length > 0 && (
            <div className="border-t border-border px-5 py-3 sm:px-6">
              <Link
                href="/notifications"
                className="text-sm font-medium text-primary underline-offset-[3px] hover:underline"
              >
                View all notifications
              </Link>
            </div>
          )}
        </div>
      )}
    </>
  )

  if (!collapsible) {
    return (
      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        {inner}
      </section>
    )
  }

  return (
    <Card className="gap-0 overflow-hidden py-0 shadow-xs">
      <CardContent className="p-0">{inner}</CardContent>
    </Card>
  )
}

function MarkAllReadButton() {
  const [pending, startTransition] = useTransition()
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-8 text-xs"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await markAllNotificationsReadAction()
        })
      }
    >
      <CheckCheck className="h-3.5 w-3.5" aria-hidden />
      Mark all read
    </Button>
  )
}

function ClearAllButton({
  count,
  onCleared,
}: {
  count: number
  onCleared: () => void
}) {
  const [pending, startTransition] = useTransition()
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-8 text-xs text-muted-foreground hover:text-destructive"
      disabled={pending}
      aria-label={`Clear all ${count} notifications`}
      onClick={() =>
        startTransition(async () => {
          // Optimistic: hide them immediately. If the server fails
          // the next router.refresh will pull the truth back.
          onCleared()
          await dismissAllNotificationsAction()
        })
      }
    >
      <Trash2 className="h-3.5 w-3.5" aria-hidden />
      Clear all
    </Button>
  )
}

function FeedRow({
  item,
  now,
  onDismissed,
}: {
  item: FeedItemView
  now: number
  onDismissed: () => void
}) {
  const meta = KIND_META[item.kind] ?? KIND_META.announcement
  const Icon = meta.icon
  const [readPending, startReadTransition] = useTransition()
  const [dismissPending, startDismissTransition] = useTransition()
  const isUnread = !item.readAt

  function markRead() {
    if (!isUnread) return
    startReadTransition(async () => {
      await markNotificationReadAction(item.id)
    })
  }

  function dismiss() {
    startDismissTransition(async () => {
      // Optimistic: remove from the parent immediately so the row
      // disappears with no perceptible delay.
      onDismissed()
      await dismissNotificationAction(item.id)
    })
  }

  /*
    Unread rows get a small highlight dot in the gutter, a faint
    navy tint and a semibold title; read rows sit flat on the card.
    The kind badge colour carries the Alert / Reminder cue.
  */
  return (
    <div
      className={[
        'relative transition-colors',
        isUnread ? 'bg-primary-soft/40 hover:bg-primary-soft/70' : 'hover:bg-accent/60',
        dismissPending ? 'opacity-50 pointer-events-none' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {isUnread && (
        <span
          className="absolute left-2 top-[1.9rem] inline-block size-2 rounded-full bg-highlight sm:left-2.5"
          aria-label="Unread"
        />
      )}
      <div className="flex items-start gap-3 px-5 py-4 sm:px-6">
        <Avatar className="size-9 flex-shrink-0">
          <AvatarFallback className="bg-muted text-xs font-medium text-muted-foreground">
            {item.author?.initials ?? 'WF'}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <p
              className={`text-sm ${isUnread ? 'font-semibold text-foreground' : 'font-medium text-foreground'}`}
            >
              {item.title}
            </p>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.tone}`}
            >
              <Icon className="h-3 w-3" aria-hidden />
              {meta.label}
            </span>
            {item.pinned && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                <Pin className="h-3 w-3" aria-hidden />
                Pinned
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {item.author?.name ?? 'Fellowship team'}
            {' · '}
            {formatRelativeTime(item.publishedAt, now)}
          </p>
          <p className="whitespace-pre-line pt-0.5 text-sm leading-relaxed text-foreground/90">
            {item.body}
          </p>

          {/*
            Two distinct affordances. `content` is set when an admin
            pins the notification to a curriculum item: a soft
            "Open the lab" link. `ctaUrl` is a free-form CTA the admin
            set in the notification dialog. Both can coexist.
          */}
          {(item.content || (item.ctaUrl && item.ctaLabel)) && (
            <div className="flex flex-wrap gap-2 pt-2">
              {item.content && (
                <Link
                  href={item.content.href}
                  onClick={markRead}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground shadow-xs transition-colors hover:bg-accent"
                >
                  <BookOpen className="h-3.5 w-3.5" aria-hidden />
                  Open: {item.content.title}
                </Link>
              )}
              {item.ctaUrl && item.ctaLabel && (
                <Link
                  href={item.ctaUrl}
                  target={
                    /^https?:\/\//.test(item.ctaUrl) ? '_blank' : undefined
                  }
                  rel={
                    /^https?:\/\//.test(item.ctaUrl)
                      ? 'noopener noreferrer'
                      : undefined
                  }
                  onClick={markRead}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary-hover"
                >
                  {item.ctaLabel}
                  {/^https?:\/\//.test(item.ctaUrl) && (
                    <ExternalLink className="h-3 w-3" aria-hidden />
                  )}
                </Link>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-1">
          <button
            type="button"
            onClick={dismiss}
            disabled={dismissPending}
            className="-mr-1 -mt-1 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Clear this notification"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
          {isUnread && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"

              disabled={readPending}
              onClick={markRead}
            >
              Mark read
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
