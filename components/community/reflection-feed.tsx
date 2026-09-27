import { Eye, EyeOff, Lock, MessageCircle, Sparkles } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ReflectionVisibilityToggle } from '@/components/community/reflection-visibility-toggle'
import { CommentThread } from '@/components/community/comment-thread'
import { ReflectionCardClient } from '@/components/community/reflection-card-client'
import { initialsFor } from '@/lib/types/profile'
import type {
  CommentItem,
  ReflectionFeedItem,
} from '@/lib/community/load-reflections'

interface Props {
  reflections: ReflectionFeedItem[]
  /**
   * Comments grouped by reflection id. The page loader fetches these
   * in a single round-trip and groups them so each card can render
   * its thread without an extra fetch.
   */
  commentsByReflection: Map<string, CommentItem[]>
  currentUser: {
    id: string
    fullName: string | null
    email: string | null
    avatarUrl: string | null
    isAdmin: boolean
  }
  /** Empty-state copy shown when the feed has no items. */
  emptyTitle: string
  emptyCopy: string
}

/**
 * Server component that renders the Reflections feed sourced from
 * `user_content_reflections`. Each card combines:
 *   - Author header (avatar + name + relative date)
 *   - The lab the reflection was attached to (with prompt as a
 *     muted quote when present)
 *   - The reflection body
 *   - Visibility chip (and a toggle for the author)
 *   - Inline `CommentThread`
 *
 * No client logic here - the only interactive bits are the
 * `CommentThread` and `ReflectionVisibilityToggle`, which are their
 * own client components.
 */
export function ReflectionFeed({
  reflections,
  commentsByReflection,
  currentUser,
  emptyTitle,
  emptyCopy,
}: Props) {
  if (reflections.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-dashed bg-card p-10 text-center">
        <span className="flex size-10 items-center justify-center rounded-lg bg-primary-soft text-primary">
          <MessageCircle className="size-[18px]" aria-hidden="true" />
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
      {reflections.map((r) => (
        <li key={r.id}>
          <ReflectionCardClient
            reflection={r}
            comments={commentsByReflection.get(r.id) ?? []}
            currentUser={currentUser}
          />
        </li>
      ))}
    </ul>
  )
}
