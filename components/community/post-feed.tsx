import Link from 'next/link'
import { ArrowRight, BookmarkCheck, MessagesSquare, Pin } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { PostAdminRow } from '@/components/community/post-admin-row'
import { initialsFor } from '@/lib/types/profile'

export interface CommunityPostListItem {
  id: string
  title: string
  excerpt: string | null
  body?: string | null
  cover_url: string | null
  published_at: string | null
  kind: string
  /** Admin moderation: when set, the post is pinned at the top. */
  featured_at?: string | null
  /** Admin moderation: when true, the post is hidden from fellows. */
  is_archived?: boolean
  /**
   * The framework (PWF Protocol) the post is tied to, if any. Set
   * by the Wins composer; null for posts that didn't pick one or
   * for sections that don't surface a framework picker.
   */
  framework?: {
    id: string
    title: string
    resource_url: string | null
  } | null
  framework_resource?: {
    id: string
    title: string
  } | null
  /** Ask metadata (only set on kind==='ask'). */
  ask_category?: string | null
  ask_status?: string | null
  /** Star rating for wins (only set on kind==='win'). */
  star_rating?: number | null
  author: {
    id: string
    full_name: string | null
    email: string | null
    avatar_url: string | null
  } | null
}

interface Props {
  posts: CommunityPostListItem[]
  /** Heading shown when `posts` is empty. */
  emptyTitle: string
  /** Body shown when `posts` is empty. */
  emptyCopy: string
  /**
   * When true, renders an admin moderation row beneath each post
   * card with feature/archive controls. Caller decides eligibility
   * based on the viewer's role.
   */
  isStaff?: boolean
}

/**
 * Shared feed renderer used by every Community section that surfaces
 * posts (What's New?, Reflections, Wins, Ask). Renders one card per
 * post with the author's headshot, name, date, title, and excerpt.
 * The cover image, when set, sits as a thumbnail on the right at sm+.
 *
 * The whole card is a link to /community/stories/[id], which already
 * handles the full post view + draft-only-for-staff gating.
 */
export function PostFeed({
  posts,
  emptyTitle,
  emptyCopy,
  isStaff = false,
}: Props) {
  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-dashed bg-card p-10 text-center">
        <span className="flex size-10 items-center justify-center rounded-lg bg-primary-soft text-primary">
          <MessagesSquare className="size-[18px]" aria-hidden="true" />
        </span>
        <h3 className="mt-4">{emptyTitle}</h3>
        <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
          {emptyCopy}
        </p>
      </div>
    )
  }

  return (
    <ul className="flex flex-col gap-4">
      {posts.map((post) => (
        <PostFeedItem key={post.id} post={post} isStaff={isStaff} />
      ))}
    </ul>
  )
}

/**
 * Pretty label for ask categories. Kept here so both the feed and
 * the post-detail page stay aligned without an extra import dance.
 */
function askCategoryLabel(value: string | null | undefined): string | null {
  switch (value) {
    case 'general':
      return 'General'
    case 'instructional':
      return 'Instructional'
    case 'school_team':
      return 'School team'
    case 'waw':
      return 'Why-and-what (WAW)'
    default:
      return null
  }
}

function askStatusLabel(value: string | null | undefined): string | null {
  switch (value) {
    case 'open':
      return 'Open'
    case 'answered':
      return 'Answered'
    case 'closed':
      return 'Closed'
    default:
      return null
  }
}

function PostFeedItem({
  post,
  isStaff,
}: {
  post: CommunityPostListItem
  isStaff: boolean
}) {
  const authorName =
    post.author?.full_name?.trim() || post.author?.email || 'Anonymous'
  const initials = initialsFor(post.author?.full_name, post.author?.email)

  const dateLabel = post.published_at
    ? new Date(post.published_at).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : ''

  const isFeatured = Boolean(post.featured_at)
  const askCategory = askCategoryLabel(post.ask_category)
  const askStatus = askStatusLabel(post.ask_status)

  return (
    <li>
      <Link
        href={`/community/stories/${post.id}`}
        className={[
          'group flex gap-4 rounded-xl border bg-card p-5 shadow-xs transition hover:border-border-strong hover:shadow-md',
          // Featured posts get a subtle ring so the pin isn't the
          // only signal that this row is special.
          isFeatured ? 'border-primary/30 ring-1 ring-primary/10' : '',
        ].join(' ')}
      >
        <Avatar className="size-10 shrink-0">
          {post.author?.avatar_url ? (
            <AvatarImage src={post.author.avatar_url} alt="" />
          ) : null}
          <AvatarFallback className="bg-primary-soft text-xs font-medium text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate text-sm font-medium text-foreground">
              {authorName}
            </span>
            {dateLabel && (
              <>
                <span className="text-xs text-muted-foreground" aria-hidden="true">
                  ·
                </span>
                <span className="text-xs text-muted-foreground">{dateLabel}</span>
              </>
            )}
            {isFeatured && (
              <Badge
                variant="secondary"
                className="gap-1 bg-primary-soft text-primary"
              >
                <Pin aria-hidden="true" />
                Featured
              </Badge>
            )}
            {/* Ask metadata chips: category + status. Rendered on
                ask cards only (other kinds keep the values null). */}
            {askCategory && <Badge variant="outline">{askCategory}</Badge>}
            {askStatus && (
              <Badge
                variant="secondary"
                className={
                  post.ask_status === 'open'
                    ? 'bg-primary-soft text-primary'
                    : post.ask_status === 'answered'
                      ? 'bg-success-soft text-success'
                      : undefined
                }
              >
                {askStatus}
              </Badge>
            )}
          </div>

          <h3 className="text-pretty text-base leading-snug transition-colors group-hover:text-primary">
            {post.title}
          </h3>

          {post.kind === 'win' && post.body ? (
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">
              {post.body}
            </p>
          ) : post.excerpt ? (
            <p className="line-clamp-2 text-[15px] leading-relaxed text-muted-foreground">
              {post.excerpt}
            </p>
          ) : null}

          <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
            {/*
              Framework chip ("Used: Reading Reset Protocol"). Linked
              to the library so curious peers can find the underlying
              resource without leaving the feed mentally.
            */}
            {post.framework ? (
              <span className="inline-flex w-fit items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground">
                <BookmarkCheck
                  className="size-3.5 text-primary"
                  aria-hidden="true"
                />
                Used: {post.framework.title}
              </span>
            ) : (
              <span />
            )}

            <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors group-hover:text-primary">
              Read more
              <ArrowRight
                className="size-3.5 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </span>
          </div>
        </div>

        {post.cover_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.cover_url}
            alt=""
            className="hidden h-24 w-32 shrink-0 rounded-lg border object-cover sm:block"
            loading="lazy"
          />
        )}
      </Link>
      {isStaff && (
        <PostAdminRow
          postId={post.id}
          isFeatured={Boolean(post.featured_at)}
          isArchived={Boolean(post.is_archived)}
        />
      )}
    </li>
  )
}
