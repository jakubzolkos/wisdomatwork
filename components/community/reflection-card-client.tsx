'use client'

import { useState } from 'react'
import { Eye, EyeOff, Lock, MessageCircle, Sparkles } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ReflectionVisibilityToggle } from '@/components/community/reflection-visibility-toggle'
import { ReflectionReactions } from '@/components/community/reflection-reactions'
import { CommentThread } from '@/components/community/comment-thread'
import { initialsFor } from '@/lib/types/profile'
import type {
  CommentItem,
  ReflectionFeedItem,
} from '@/lib/community/load-reflections'

interface Props {
  reflection: ReflectionFeedItem
  comments: CommentItem[]
  currentUser: {
    id: string
    fullName: string | null
    email: string | null
    avatarUrl: string | null
    isAdmin: boolean
  }
}

/**
 * Client component that renders a single reflection card with modal interactivity.
 * Clicking anywhere on the card (except the visibility toggle) opens a detail modal.
 */
export function ReflectionCardClient({
  reflection,
  comments,
  currentUser,
}: Props) {
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  const authorName =
    reflection.author?.full_name?.trim() ||
    reflection.author?.email ||
    'Anonymous'
  const initials = initialsFor(
    reflection.author?.full_name,
    reflection.author?.email,
  )
  const isOwner =
    !!reflection.author && reflection.author.id === currentUser.id

  const dateLabel = new Date(reflection.created_at).toLocaleDateString(
    undefined,
    {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    },
  )

  return (
    <>
      <article
        onClick={() => setIsDetailOpen(true)}
        className="flex cursor-pointer flex-col gap-4 rounded-xl border bg-card p-5 shadow-xs transition hover:border-border-strong hover:shadow-md sm:p-6"
      >
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="size-10 shrink-0">
              {reflection.author?.avatar_url ? (
                <AvatarImage src={reflection.author.avatar_url} alt="" />
              ) : null}
              <AvatarFallback className="bg-primary-soft text-xs font-medium text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {authorName}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {dateLabel}
                {reflection.content?.title
                  ? ` · ${reflection.content.title}`
                  : ''}
                {reflection.content?.year_id
                  ? ` · ${reflection.content.year_id}`
                  : ''}
              </p>
            </div>
          </div>

          {/*
            Visibility chip + toggle. Non-authors see a read-only
            chip; authors see a popover to flip between values.
          */}
          <div onClick={(e) => e.stopPropagation()}>
            {isOwner ? (
              <ReflectionVisibilityToggle
                reflectionId={reflection.id}
                value={reflection.visibility}
              />
            ) : (
              <VisibilityChip value={reflection.visibility} />
            )}
          </div>
        </header>

        {/* Prompt comes from `content.reflection_prompt` and is rendered as
            a quoted block so the response context is obvious. */}
        {reflection.content?.prompt && (
          <blockquote className="flex gap-2.5 rounded-lg bg-muted/60 px-3.5 py-2.5 text-sm leading-relaxed text-muted-foreground">
            <Sparkles
              className="mt-0.5 size-4 shrink-0 text-primary"
              aria-hidden="true"
            />
            <span>{reflection.content.prompt}</span>
          </blockquote>
        )}

        <p className="rich-text whitespace-pre-wrap text-pretty text-base">
          {reflection.body}
        </p>

        <footer className="flex items-center gap-3 border-t pt-4 text-xs text-muted-foreground">
          <ReflectionReactions
            reflectionId={reflection.id}
            reactions={reflection.reactions}
            userReactions={reflection.user_reactions}
          />
          <span className="inline-flex items-center gap-1">
            <MessageCircle className="size-3.5" aria-hidden="true" />
            {comments.filter((c) => !c.is_deleted).length}{' '}
            {comments.filter((c) => !c.is_deleted).length === 1
              ? 'comment'
              : 'comments'}
          </span>
        </footer>

        <CommentThread
          subjectType="reflection"
          subjectId={reflection.id}
          comments={comments}
          currentUser={currentUser}
        />
      </article>

      {/* Detail modal */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {reflection.content?.title || 'Reflection'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Author info */}
            <div className="flex items-center gap-3 border-b pb-4">
              <Avatar className="size-10 shrink-0">
                {reflection.author?.avatar_url ? (
                  <AvatarImage src={reflection.author.avatar_url} alt="" />
                ) : null}
                <AvatarFallback className="bg-primary-soft text-xs font-medium text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{authorName}</p>
                <p className="text-xs text-muted-foreground">{dateLabel}</p>
              </div>
            </div>

            {/* Prompt */}
            {reflection.content?.prompt && (
              <blockquote className="flex gap-2.5 rounded-lg bg-muted/60 px-3.5 py-2.5 text-sm leading-relaxed text-muted-foreground">
                <Sparkles
                  className="mt-0.5 size-4 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <span>{reflection.content.prompt}</span>
              </blockquote>
            )}

            {/* Reflection content */}
            <p className="rich-text whitespace-pre-wrap text-pretty">
              {reflection.body}
            </p>

            {/* Comments section */}
            <div className="border-t pt-4">
              <CommentThread
                subjectType="reflection"
                subjectId={reflection.id}
                comments={comments}
                currentUser={currentUser}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function VisibilityChip({
  value,
}: {
  value: ReflectionFeedItem['visibility']
}) {
  if (value === 'private') {
    return (
      <Badge variant="outline" className="gap-1">
        <Lock className="h-3 w-3" aria-hidden="true" />
        Private
      </Badge>
    )
  }
  if (value === 'cohort') {
    return (
      <Badge variant="outline" className="gap-1">
        <EyeOff className="h-3 w-3" aria-hidden="true" />
        Cohort only
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className="gap-1">
      <Eye className="h-3 w-3" aria-hidden="true" />
      Public
    </Badge>
  )
}
