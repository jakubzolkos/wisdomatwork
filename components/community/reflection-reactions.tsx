'use client'

import { useState, useTransition } from 'react'
import { ThumbsUp, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  addReactionToReflection,
  removeReactionFromReflection,
} from '@/app/community/actions'

interface Props {
  reflectionId: string
  reactions: Array<{ kind: string; count: number }>
  userReactions: string[]
  onSuccess?: () => void
}

/**
 * Reaction button for reflections. Shows a thumbs-up count and allows
 * the user to toggle their reaction. When clicked, adds or removes the
 * 'cheer' reaction via server action.
 */
export function ReflectionReactions({
  reflectionId,
  reactions,
  userReactions,
  onSuccess,
}: Props) {
  const [isPending, startTransition] = useTransition()
  
  const cheerReaction = reactions.find((r) => r.kind === 'cheer')
  const count = cheerReaction?.count ?? 0
  const hasReacted = userReactions.includes('cheer')

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()

    startTransition(async () => {
      if (hasReacted) {
        await removeReactionFromReflection(reflectionId, 'cheer')
      } else {
        await addReactionToReflection(reflectionId, 'cheer')
      }
      onSuccess?.()
    })
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleToggle}
      disabled={isPending}
      className={
        hasReacted
          ? 'h-8 gap-1.5 border-primary/20 bg-primary-soft text-xs text-primary hover:bg-primary-soft hover:text-primary'
          : 'h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground'
      }
    >
      {isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <ThumbsUp className="h-3.5 w-3.5" />
      )}
      {count > 0 && <span>{count}</span>}
    </Button>
  )
}
