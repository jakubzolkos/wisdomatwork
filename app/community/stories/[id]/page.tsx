import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, BookmarkCheck } from 'lucide-react'
import { requireUser } from '@/lib/auth-server'
import { createClient } from '@/lib/supabase/server'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { initialsFor } from '@/lib/types/profile'
import { CommentThread } from '@/components/community/comment-thread'
import { AskStatusControl } from '@/components/community/ask-status-control'
import { loadComments } from '@/lib/community/load-reflections'
import {
  ASK_STATUS_LABEL,
  askCategoryLabel,
  type AskStatus,
} from '@/lib/community/ask-categories'

export const metadata = {
  title: 'Story | Leadership Fellowship',
}

interface StoryAuthor {
  id: string
  full_name: string | null
  avatar_url: string | null
  email: string | null
  title: string | null
  cohort: string | null
}

interface StoryRow {
  id: string
  kind: string
  title: string
  excerpt: string | null
  body: string | null
  cover_url: string | null
  media_url: string | null
  published_at: string | null
  created_by: string
  ask_category: string | null
  ask_status: string | null
  accepted_answer_comment_id: string | null
  framework_resource_id: string | null
  framework: {
    id: string
    title: string
    resource_url: string | null
  } | null
  author: StoryAuthor | null
}

const ASK_STATUSES: ReadonlyArray<AskStatus> = ['open', 'answered', 'closed']

/**
 * /community/stories/[id] - full-bleed reader for a Community story.
 *
 * Auth-gated like the rest of the app (requireUser redirects to
 * /auth/login). Unpublished posts (published_at IS NULL) 404 for
 * everyone except admins / facilitators so authors can preview.
 *
 * For Ask posts, also renders:
 *   - lifecycle status badge + (asker/staff only) status picker
 *   - category chip
 *   - comment thread with the asker/staff able to mark a single
 *     comment as the accepted answer
 *
 * Body is rendered as plain whitespace-pre-wrap. We deliberately
 * avoid markdown for now - admin authoring writes plain text, and
 * adding a renderer would expand the trust surface (XSS, link
 * sanitisation) without adding obvious value.
 */
export default async function StoryPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await requireUser()
  const supabase = await createClient()

  const { data } = await supabase
    .from('community_posts')
    .select(
      `
      id, kind, title, excerpt, body, cover_url, media_url, published_at,
      created_by, ask_category, ask_status, accepted_answer_comment_id,
      framework_resource_id,
      framework:framework_resource_id ( id, title, resource_url ),
      author:created_by (
        id, full_name, avatar_url, email, title, cohort
      )
    `,
    )
    .eq('id', id)
    .maybeSingle<StoryRow>()

  if (!data) notFound()

  const isStaff = user.role === 'admin' || user.role === 'facilitator'
  const canSeeUnpublished = isStaff
  if (!data.published_at && !canSeeUnpublished) notFound()

  const author = data.author
  const authorName = author?.full_name?.trim() || author?.email || 'Unknown author'
  const initials = initialsFor(author?.full_name, author?.email)
  const publishedLabel = data.published_at
    ? new Date(data.published_at).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Unpublished draft'

  const kindLabel =
    data.kind === 'audio'
      ? 'Audio'
      : data.kind === 'video'
        ? 'Video'
        : data.kind === 'ask' || data.kind === 'question'
          ? 'Ask'
          : data.kind === 'win'
            ? 'Win'
            : 'Story'

  const isAsk = data.kind === 'ask' || data.kind === 'question'
  const isOwner = data.created_by === user.id
  const canManageAsk = isAsk && (isOwner || isStaff)

  // Comments + accepted answer plumbing. Only Asks surface the
  // accept-answer affordance, but every post type gets comments.
  const comments = await loadComments('post', data.id)

  // Coerce ask_status into the typed enum (with a fallback to 'open'
  // so the picker always has a valid initial value).
  const askStatus: AskStatus =
    data.ask_status &&
    (ASK_STATUSES as readonly string[]).includes(data.ask_status)
      ? (data.ask_status as AskStatus)
      : 'open'

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Link
        href={isAsk ? '/community/ask' : '/community'}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {isAsk ? 'Back to Asks' : 'Back to Community'}
      </Link>

      <article className="mt-6 flex flex-col gap-8">
        {data.cover_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.cover_url}
            alt=""
            className="aspect-[16/9] w-full rounded-xl border object-cover"
          />
        )}

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">
              {kindLabel}
            </Badge>
            {!data.published_at && (
              <Badge variant="secondary">
                Draft
              </Badge>
            )}
            {isAsk && (
              <>
                <Badge variant="outline">
                  {askCategoryLabel(data.ask_category)}
                </Badge>
                <Badge
                  variant={askStatus === 'open' ? 'default' : 'outline'}
                 
                >
                  {ASK_STATUS_LABEL[askStatus]}
                </Badge>
              </>
            )}
          </div>
          <h1 className="text-balance text-3xl sm:text-[2.125rem]">
            {data.title}
          </h1>
          {data.excerpt && (
            <p className="text-pretty text-[17px] leading-relaxed text-muted-foreground">
              {data.excerpt}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 border-y py-4">
          <Avatar className="size-10 shrink-0">
            {author?.avatar_url ? (
              <AvatarImage src={author.avatar_url} alt="" />
            ) : null}
            <AvatarFallback className="text-xs font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {authorName}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {publishedLabel}
              {author?.title ? ` · ${author.title}` : ''}
            </p>
          </div>
          {author?.cohort && (
            <Badge variant="secondary">
              Cohort {author.cohort}
            </Badge>
          )}
        </div>

        {/* Framework chip ("Used: Reading Reset Protocol"). */}
        {data.framework && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-primary-soft px-2.5 py-1 font-medium text-primary">
              <BookmarkCheck
                className="size-3.5"
                aria-hidden="true"
              />
              Used: {data.framework.title}
            </span>
          </div>
        )}

        {data.media_url && data.kind !== 'story' && data.kind !== 'ask' && (
          <a
            href={data.media_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            Open {kindLabel.toLowerCase()} in a new tab
          </a>
        )}

        {data.body && (
          <div className="rich-text whitespace-pre-wrap text-pretty">
            {data.body}
          </div>
        )}

        {/*
          Asker/staff lifecycle picker. Sits below the body so it
          doesn't compete with the title; it's also a low-traffic
          action so prominence isn't critical.
        */}
        {canManageAsk && (
          <div className="rounded-xl border bg-card p-5 shadow-xs">
            <AskStatusControl postId={data.id} currentStatus={askStatus} />
            <p className="mt-2 text-xs text-muted-foreground">
              Marking a comment as the accepted answer below will move
              this ask to {ASK_STATUS_LABEL.answered}.
            </p>
          </div>
        )}

        <div className="border-t pt-8">
          <CommentThread
            subjectType="post"
            subjectId={data.id}
            comments={comments}
            currentUser={{
              id: user.id,
              fullName: user.fullName ?? null,
              email: user.email ?? null,
              avatarUrl: user.profileImageUrl ?? null,
              isAdmin: isStaff,
            }}
            acceptedAnswerCommentId={data.accepted_answer_comment_id}
            canAcceptAnswer={canManageAsk}
          />
        </div>
      </article>
    </div>
  )
}
