'use client'

import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { ReflectionDetail } from './reflection-detail'
import { ReflectionReactions } from './reflection-reactions'

interface ReflectionFeedCardProps {
  reflection: {
    id: string
    body: string
    title: string
    contentTitle: string
    author: {
      id: string
      full_name: string
      avatar_url?: string
    }
    created_at: string
  }
  reactions?: {
    like: number
    love: number
    inspire: number
    helpful: number
  }
  userReactions?: string[]
  commentCount?: number
}

/**
 * Individual reflection card in the community feed.
 * Shows a preview with reactions and comment count. Clicking opens detail modal.
 */
export function ReflectionFeedCard({
  reflection,
  reactions,
  userReactions,
  commentCount = 0,
}: ReflectionFeedCardProps) {
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  // Truncate body for preview
  const preview =
    reflection.body.length > 200
      ? reflection.body.substring(0, 200) + '...'
      : reflection.body

  return (
    <>
      <div
        onClick={() => setIsDetailOpen(true)}
        className="cursor-pointer rounded-xl border border-border bg-card p-5 shadow-xs transition hover:border-border-strong hover:shadow-md"
      >
        {/* Header */}
        <div className="mb-3 flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground">
              {reflection.contentTitle}
            </p>
            <p className="font-medium text-foreground">{reflection.title}</p>
          </div>
        </div>

        {/* Author info */}
        <div className="mb-3 flex items-center gap-2">
          {reflection.author.avatar_url && (
            <img
              src={reflection.author.avatar_url}
              alt={reflection.author.full_name}
              className="h-8 w-8 rounded-full"
            />
          )}
          <div>
            <p className="text-sm font-medium">{reflection.author.full_name}</p>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(reflection.created_at), {
                addSuffix: true,
              })}
            </p>
          </div>
        </div>

        {/* Preview text */}
        <p className="mb-4 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
          {preview}
        </p>

        {/* Reactions preview */}
        <div className="flex items-center gap-2 border-t border-border pt-3">
          <ReflectionReactions
            reflectionId={reflection.id}
            reactions={reactions}
            userReactions={userReactions}
            commentCount={commentCount}
          />
        </div>
      </div>

      {/* Detail modal */}
      <ReflectionDetail
        isOpen={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        reflection={reflection}
        reactions={reactions}
        userReactions={userReactions}
        commentCount={commentCount}
      />
    </>
  )
}
