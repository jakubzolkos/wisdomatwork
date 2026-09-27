'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Archive, ArchiveRestore, Pin, PinOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import {
  setPostArchived,
  setPostFeatured,
} from '@/app/community/actions'

interface Props {
  postId: string
  /** Current featured/archived state, used to flip the toggle labels. */
  isFeatured: boolean
  isArchived: boolean
}

/**
 * Admin moderation row rendered beneath each post card in feeds when
 * the viewer is staff (admin or facilitator). Stays a sibling of the
 * post Link rather than a child so clicks don't accidentally
 * navigate to the post detail page.
 */
export function PostAdminRow({ postId, isFeatured, isArchived }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function toggleFeatured() {
    startTransition(async () => {
      const r = await setPostFeatured({ postId, featured: !isFeatured })
      if (!r.ok) {
        // Surface the error in a way that doesn't require state -
        // alert() is loud enough and these moderation actions are
        // rare. router.refresh() ensures the optimistic toggle
        // matches the server source of truth.
        alert(r.message ?? 'Failed to update post.')
      }
      router.refresh()
    })
  }

  function toggleArchived() {
    if (
      !isArchived &&
      !confirm(
        'Archive this post? It will be hidden from fellows but stay readable by admins.',
      )
    ) {
      return
    }
    startTransition(async () => {
      const r = await setPostArchived({ postId, archived: !isArchived })
      if (!r.ok) alert(r.message ?? 'Failed to update post.')
      router.refresh()
    })
  }

  return (
    <div
      // Slim utility row, visually offset so it's clearly admin-only
      // chrome distinct from the post itself.
      className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-dashed bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground"
      aria-label="Admin moderation controls"
    >
      <span className="font-semibold uppercase tracking-[0.08em]">Staff</span>
      <Button
        type="button"
        size="sm"
        variant={isFeatured ? 'secondary' : 'outline'}
        onClick={toggleFeatured}
        disabled={pending}
        className="h-7 gap-1 px-2 text-xs"
      >
        {pending ? (
          <Spinner className="h-3 w-3" />
        ) : isFeatured ? (
          <PinOff className="h-3 w-3" aria-hidden="true" />
        ) : (
          <Pin className="h-3 w-3" aria-hidden="true" />
        )}
        {isFeatured ? 'Unfeature' : 'Feature'}
      </Button>
      <Button
        type="button"
        size="sm"
        variant={isArchived ? 'secondary' : 'outline'}
        onClick={toggleArchived}
        disabled={pending}
        className="h-7 gap-1 px-2 text-xs"
      >
        {pending ? (
          <Spinner className="h-3 w-3" />
        ) : isArchived ? (
          <ArchiveRestore className="h-3 w-3" aria-hidden="true" />
        ) : (
          <Archive className="h-3 w-3" aria-hidden="true" />
        )}
        {isArchived ? 'Restore' : 'Archive'}
      </Button>
      {isArchived && (
        <span className="ml-1 italic">Hidden from fellows</span>
      )}
    </div>
  )
}
