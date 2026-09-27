'use client'

import { useMemo, useState, useTransition } from 'react'
import { Check, CheckCircle2, Pencil, Reply, Trash2, X } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { initialsFor } from '@/lib/types/profile'
import {
  addComment,
  deleteComment,
  updateComment,
} from '@/app/community/reflections/actions'
import { setAcceptedAnswer } from '@/app/community/actions'
import type { CommentItem } from '@/lib/community/load-reflections'

interface Props {
  /** The post or reflection these comments belong to. */
  subjectType: 'post' | 'reflection'
  subjectId: string
  /** Initial server-rendered comments. We never re-fetch; instead we
   *  optimistically reconcile using the action results. */
  comments: CommentItem[]
  /** Current viewer; null when anonymous (shouldn't happen on
   *  authenticated pages but kept for safety). */
  currentUser: {
    id: string
    fullName: string | null
    email: string | null
    avatarUrl: string | null
    isAdmin: boolean
  } | null
  /**
   * When the subject is an Ask post, the asker (or staff) can mark
   * a single reply as the accepted answer. Pass the current
   * accepted comment id (or null) plus a flag controlling whether
   * the viewer is allowed to change it.
   */
  acceptedAnswerCommentId?: string | null
  canAcceptAnswer?: boolean
}

/**
 * Inline comment thread. Supports:
 *   - Composing a new top-level comment
 *   - Replying to an existing comment (one level)
 *   - Editing your own comment
 *   - Soft-deleting your own comment (admins can delete any)
 *
 * Comments stream optimistically: on success we patch local state so
 * the UI reflects the change without a full route refresh, then a
 * server-side `revalidatePath` keeps the SSR cache in sync for the
 * next visit.
 */
export function CommentThread({
  subjectType,
  subjectId,
  comments: initialComments,
  currentUser,
  acceptedAnswerCommentId = null,
  canAcceptAnswer = false,
}: Props) {
  const [comments, setComments] = useState<CommentItem[]>(initialComments)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  // Track the accepted answer locally so the badge updates without
  // a full route refresh. The server action revalidates the page on
  // the next navigation; this just keeps the current view in sync.
  const [acceptedId, setAcceptedId] = useState<string | null>(
    acceptedAnswerCommentId,
  )

  function toggleAccepted(commentId: string) {
    if (!canAcceptAnswer) return
    setError(null)
    const next = acceptedId === commentId ? null : commentId
    startTransition(async () => {
      const result = await setAcceptedAnswer({
        postId: subjectId,
        commentId: next,
      })
      if (!result.ok) {
        setError(result.message ?? 'Could not update accepted answer.')
        return
      }
      setAcceptedId(next)
    })
  }

  // Top-level composer state.
  const [body, setBody] = useState('')

  // Reply / edit modes; null when no row is being acted on.
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyBody, setReplyBody] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBody, setEditBody] = useState('')

  // Group by parent so we render top-level → replies in DOM order.
  // When there's an accepted answer, surface it first so the asker
  // and skim-readers see the resolution immediately.
  const tree = useMemo(() => buildTree(comments, acceptedId), [
    comments,
    acceptedId,
  ])

  function clearComposer() {
    setBody('')
    setReplyingTo(null)
    setReplyBody('')
    setEditingId(null)
    setEditBody('')
    setError(null)
  }

  function submitTopLevel() {
    if (!currentUser) return
    const trimmed = body.trim()
    if (!trimmed) return
    setError(null)
    startTransition(async () => {
      const result = await addComment({
        subjectType,
        subjectId,
        body: trimmed,
      })
      if (!result.ok) {
        setError(result.message)
        return
      }
      // Optimistic insert with the freshly-returned id so a follow-up
      // edit/delete points at the real row.
      setComments((prev) => [
        ...prev,
        {
          id: result.commentId,
          body: trimmed,
          created_at: new Date().toISOString(),
          updated_at: null,
          parent_comment_id: null,
          is_deleted: false,
          author: {
            id: currentUser.id,
            full_name: currentUser.fullName,
            email: currentUser.email,
            avatar_url: currentUser.avatarUrl,
          },
        },
      ])
      setBody('')
    })
  }

  function submitReply(parentId: string) {
    if (!currentUser) return
    const trimmed = replyBody.trim()
    if (!trimmed) return
    setError(null)
    startTransition(async () => {
      const result = await addComment({
        subjectType,
        subjectId,
        body: trimmed,
        parentCommentId: parentId,
      })
      if (!result.ok) {
        setError(result.message)
        return
      }
      setComments((prev) => [
        ...prev,
        {
          id: result.commentId,
          body: trimmed,
          created_at: new Date().toISOString(),
          updated_at: null,
          parent_comment_id: parentId,
          is_deleted: false,
          author: {
            id: currentUser.id,
            full_name: currentUser.fullName,
            email: currentUser.email,
            avatar_url: currentUser.avatarUrl,
          },
        },
      ])
      setReplyingTo(null)
      setReplyBody('')
    })
  }

  function submitEdit(commentId: string) {
    const trimmed = editBody.trim()
    if (!trimmed) return
    setError(null)
    startTransition(async () => {
      const result = await updateComment({ commentId, body: trimmed })
      if (!result.ok) {
        setError(result.message)
        return
      }
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? {
                ...c,
                body: trimmed,
                updated_at: new Date().toISOString(),
              }
            : c,
        ),
      )
      setEditingId(null)
      setEditBody('')
    })
  }

  function submitDelete(commentId: string) {
    if (
      typeof window !== 'undefined' &&
      !window.confirm('Delete this comment? It will be marked as removed.')
    ) {
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await deleteComment({ commentId })
      if (!result.ok) {
        setError(result.message)
        return
      }
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId ? { ...c, body: '', is_deleted: true } : c,
        ),
      )
    })
  }

  return (
    <section className="flex flex-col gap-3" aria-label="Comments">
      <h3 className="eyebrow">
        {comments.filter((c) => !c.is_deleted).length === 0
          ? 'Comments'
          : `Comments (${comments.filter((c) => !c.is_deleted).length})`}
      </h3>

      {tree.length > 0 && (
        <ul className="flex flex-col gap-3">
          {tree.map((node) => (
            <li key={node.comment.id} className="flex flex-col gap-2">
              <CommentRow
                comment={node.comment}
                currentUser={currentUser}
                isEditing={editingId === node.comment.id}
                editBody={editBody}
                pending={pending}
                isAccepted={acceptedId === node.comment.id}
                canToggleAccepted={canAcceptAnswer}
                onToggleAccepted={() => toggleAccepted(node.comment.id)}
                onReplyClick={() => {
                  clearComposer()
                  setReplyingTo(node.comment.id)
                }}
                onEditClick={() => {
                  clearComposer()
                  setEditingId(node.comment.id)
                  setEditBody(node.comment.body)
                }}
                onDeleteClick={() => submitDelete(node.comment.id)}
                onEditChange={setEditBody}
                onEditSubmit={() => submitEdit(node.comment.id)}
                onEditCancel={() => {
                  setEditingId(null)
                  setEditBody('')
                }}
              />

              {node.replies.length > 0 && (
                <ul className="ml-11 flex flex-col gap-3 border-l pl-4">
                  {node.replies.map((reply) => (
                    <li key={reply.id}>
                      <CommentRow
                        comment={reply}
                        currentUser={currentUser}
                        isEditing={editingId === reply.id}
                        editBody={editBody}
                        pending={pending}
                        isAccepted={acceptedId === reply.id}
                        canToggleAccepted={canAcceptAnswer}
                        onToggleAccepted={() => toggleAccepted(reply.id)}
                        onEditClick={() => {
                          clearComposer()
                          setEditingId(reply.id)
                          setEditBody(reply.body)
                        }}
                        onDeleteClick={() => submitDelete(reply.id)}
                        onEditChange={setEditBody}
                        onEditSubmit={() => submitEdit(reply.id)}
                        onEditCancel={() => {
                          setEditingId(null)
                          setEditBody('')
                        }}
                      />
                    </li>
                  ))}
                </ul>
              )}

              {/* Reply composer, scoped under this comment. */}
              {replyingTo === node.comment.id && (
                <div className="ml-11 flex flex-col gap-2 border-l pl-4">
                  <Textarea
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    rows={3}
                    placeholder={`Reply to ${
                      node.comment.author?.full_name?.trim() ||
                      node.comment.author?.email ||
                      'this comment'
                    }…`}
                    maxLength={4000}
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => submitReply(node.comment.id)}
                      disabled={pending || replyBody.trim().length === 0}
                    >
                      Post reply
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setReplyingTo(null)
                        setReplyBody('')
                      }}
                      disabled={pending}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Top-level composer */}
      {currentUser ? (
        <div className="flex flex-col gap-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder="Add a comment…"
            maxLength={4000}
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {body.length} / 4000
            </p>
            <Button
              type="button"
              size="sm"
              onClick={submitTopLevel}
              disabled={pending || body.trim().length === 0}
            >
              Post comment
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Sign in to leave a comment.
        </p>
      )}

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ */

interface TreeNode {
  comment: CommentItem
  replies: CommentItem[]
}

/**
 * Build a top-level → replies tree. Replies that point to a missing
 * parent (e.g. parent was hard-deleted) are surfaced as top-level so
 * they don't disappear silently.
 *
 * `acceptedId` floats the accepted answer (or its top-level ancestor)
 * to the front of the list so it's the first thing readers see.
 */
function buildTree(
  comments: CommentItem[],
  acceptedId: string | null,
): TreeNode[] {
  const byId = new Map<string, TreeNode>()
  const tops: TreeNode[] = []

  // Seed top-level entries first so replies always find their parent.
  for (const c of comments) {
    if (!c.parent_comment_id) {
      const node: TreeNode = { comment: c, replies: [] }
      byId.set(c.id, node)
      tops.push(node)
    }
  }
  for (const c of comments) {
    if (c.parent_comment_id) {
      const parent = byId.get(c.parent_comment_id)
      if (parent) parent.replies.push(c)
      else {
        // Orphan reply - render as top level.
        const node: TreeNode = { comment: c, replies: [] }
        byId.set(c.id, node)
        tops.push(node)
      }
    }
  }
  if (acceptedId) {
    // The accepted answer is either a top-level comment or a reply.
    // For top-level: float it to position 0. For a reply: float its
    // parent. We don't reshuffle replies inside the parent.
    const idx = tops.findIndex((n) => {
      if (n.comment.id === acceptedId) return true
      return n.replies.some((r) => r.id === acceptedId)
    })
    if (idx > 0) {
      const [pinned] = tops.splice(idx, 1)
      tops.unshift(pinned)
    }
  }
  // Replies stay in chronological order (initial comments arrive
  // ASC by created_at from the loader).
  return tops
}

interface CommentRowProps {
  comment: CommentItem
  currentUser: Props['currentUser']
  isEditing: boolean
  editBody: string
  pending: boolean
  /** True when this comment is the accepted answer for the parent ask. */
  isAccepted?: boolean
  /** True when the viewer is allowed to toggle the accepted answer. */
  canToggleAccepted?: boolean
  onReplyClick?: () => void
  onEditClick: () => void
  onDeleteClick: () => void
  onEditChange: (v: string) => void
  onEditSubmit: () => void
  onEditCancel: () => void
  onToggleAccepted?: () => void
}

function CommentRow({
  comment,
  currentUser,
  isEditing,
  editBody,
  pending,
  isAccepted = false,
  canToggleAccepted = false,
  onReplyClick,
  onEditClick,
  onDeleteClick,
  onEditChange,
  onEditSubmit,
  onEditCancel,
  onToggleAccepted,
}: CommentRowProps) {
  const authorName =
    comment.author?.full_name?.trim() ||
    comment.author?.email ||
    'Anonymous'
  const initials = initialsFor(comment.author?.full_name, comment.author?.email)
  const isOwner =
    !!currentUser && !!comment.author && comment.author.id === currentUser.id
  const canDelete =
    !comment.is_deleted &&
    !!currentUser &&
    (isOwner || currentUser.isAdmin)

  return (
    <div className="flex gap-3">
      <Avatar className="size-8 shrink-0">
        {comment.author?.avatar_url ? (
          <AvatarImage src={comment.author.avatar_url} alt="" />
        ) : null}
        <AvatarFallback className="bg-primary-soft text-xs font-medium text-primary">
          {initials}
        </AvatarFallback>
      </Avatar>

      <div
        className={[
          'min-w-0 flex-1 rounded-lg px-3.5 py-2.5',
          isAccepted
            ? 'bg-success-soft ring-1 ring-success/25'
            : 'bg-muted/60',
        ].join(' ')}
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span className="truncate font-medium text-foreground">
            {authorName}
          </span>
          <span className="text-muted-foreground">
            {formatRelative(comment.created_at)}
            {comment.updated_at && !comment.is_deleted && ' · edited'}
          </span>
          {isAccepted && (
            <Badge
              variant="secondary"
              className="gap-1 bg-card text-success"
            >
              <CheckCircle2 aria-hidden="true" />
              Accepted answer
            </Badge>
          )}
        </div>

        {comment.is_deleted ? (
          <p className="mt-1 text-sm italic text-muted-foreground">
            This comment was removed.
          </p>
        ) : isEditing ? (
          <div className="mt-2 flex flex-col gap-2">
            <Textarea
              value={editBody}
              onChange={(e) => onEditChange(e.target.value)}
              rows={3}
              maxLength={4000}
            />
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                onClick={onEditSubmit}
                disabled={pending || editBody.trim().length === 0}
              >
                Save
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={onEditCancel}
                disabled={pending}
              >
                <X aria-hidden="true" />
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {comment.body}
          </p>
        )}

        {!comment.is_deleted && !isEditing && currentUser && (
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs font-medium">
            {onReplyClick && (
              <button
                type="button"
                onClick={onReplyClick}
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary"
              >
                <Reply className="size-3.5" aria-hidden="true" />
                Reply
              </button>
            )}
            {/*
              Accept-answer toggle. Visible only when the viewer is
              allowed (asker or staff). Clicking on an already-
              accepted comment clears the acceptance.
            */}
            {canToggleAccepted && onToggleAccepted && (
              <button
                type="button"
                onClick={onToggleAccepted}
                disabled={pending}
                className={[
                  'inline-flex items-center gap-1 transition-colors disabled:opacity-50',
                  isAccepted
                    ? 'font-medium text-success hover:text-success/80'
                    : 'text-muted-foreground hover:text-success',
                ].join(' ')}
                aria-pressed={isAccepted}
              >
                <Check className="size-3.5" aria-hidden="true" />
                {isAccepted ? 'Unmark answer' : 'Mark as answer'}
              </button>
            )}
            {isOwner && (
              <button
                type="button"
                onClick={onEditClick}
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary"
              >
                <Pencil className="size-3.5" aria-hidden="true" />
                Edit
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={onDeleteClick}
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/** Compact "5m / 3h / Aug 14" relative date used in the comment row. */
function formatRelative(iso: string): string {
  const then = Date.parse(iso)
  if (!Number.isFinite(then)) return ''
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (seconds < 45) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(then).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
