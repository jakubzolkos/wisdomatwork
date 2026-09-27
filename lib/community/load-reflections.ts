import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/auth-server'

/**
 * Wire shape returned by `loadReflectionFeed`. Each row is one
 * reflection entry from `user_content_reflections`, enriched with
 * the prompt + lab title (joined from `labs`) and the author profile.
 */
export interface ReflectionFeedItem {
  /** Stable UUID added in migration 050. */
  id: string
  /** Markdown body the fellow wrote. */
  body: string
  /** Free-form `visibility`: 'public' | 'cohort' | 'private'. */
  visibility: 'public' | 'cohort' | 'private'
  created_at: string
  updated_at: string | null
  /** Lab the reflection was attached to. May be missing if the
   *  upstream content row was deleted. */
  content: {
    id: string
    title: string | null
    /** Phase / module breadcrumb piece. Free-text "year" id. */
    year_id: string | null
    /** Reflection prompt the fellow saw when writing. */
    prompt: string | null
  } | null
  author: {
    id: string
    full_name: string | null
    email: string | null
    avatar_url: string | null
  } | null
  /** Number of non-deleted comments attached to this reflection. */
  comment_count: number
  /** Reaction counts by kind. */
  reactions: {
    kind: string
    count: number
  }[]
  /** Current user's reactions (kinds they've reacted with). */
  user_reactions: string[]
}

interface RawReflectionRow {
  id: string
  body: string
  visibility: 'public' | 'cohort' | 'private'
  submitted_at: string
  author: {
    id: string
    full_name: string | null
    email: string | null
    avatar_url: string | null
  } | null
  content: {
    id: string
    title: string | null
    year_id: string | null
    reflection_prompt: string | null
  } | null
}

/**
 * Load the public/cohort reflections feed.
 */
export async function loadReflectionFeed(options?: {
  /** Limit how many reflections come back. Defaults to 50. */
  limit?: number
}): Promise<ReflectionFeedItem[]> {
  const supabase = await createClient()
  const limit = Math.max(1, Math.min(options?.limit ?? 50, 200))

  const user = await getSessionUser()
  const currentUserId = user?.id

  // Fetch reflections with author and content in one query
  const { data: raw, error } = await supabase
    .from('user_content_reflections')
    .select(
      `
      id,
      response as body,
      visibility,
      submitted_at,
      author:profile_id (
        id,
        full_name,
        email,
        avatar_url
      ),
      content:content_id (
        id,
        title,
        year_id,
        reflection_prompt
      )
      `,
    )
    .neq('visibility', 'private')
    .order('submitted_at', { ascending: false })
    .limit(limit)
    .returns<RawReflectionRow[]>()

  if (error || !raw) {
    return []
  }

  // Aggregate comment counts per reflection
  const ids = raw.map((r) => r.id)
  const counts = new Map<string, number>()

  if (ids.length > 0) {
    const { data: commentRows } = await supabase
      .from('community_comments')
      .select('subject_id')
      .eq('subject_type', 'reflection')
      .is('deleted_at', null)
      .in('subject_id', ids)
      .returns<{ subject_id: string }[]>()

    for (const row of commentRows ?? []) {
      counts.set(row.subject_id, (counts.get(row.subject_id) ?? 0) + 1)
    }
  }

  // Fetch reactions
  const reactionsByReflection = new Map<string, Map<string, number>>()
  const userReactionsByReflection = new Map<string, Set<string>>()

  if (ids.length > 0) {
    const { data: reactions } = await supabase
      .from('community_reflection_reactions')
      .select('reflection_id, kind, profile_id')
      .in('reflection_id', ids)
      .returns<
        Array<{
          reflection_id: string
          kind: string
          profile_id: string
        }>
      >()

    for (const reaction of reactions ?? []) {
      if (!reactionsByReflection.has(reaction.reflection_id)) {
        reactionsByReflection.set(reaction.reflection_id, new Map())
      }
      const kindMap = reactionsByReflection.get(reaction.reflection_id)!
      kindMap.set(reaction.kind, (kindMap.get(reaction.kind) ?? 0) + 1)

      if (reaction.profile_id === currentUserId) {
        if (!userReactionsByReflection.has(reaction.reflection_id)) {
          userReactionsByReflection.set(reaction.reflection_id, new Set())
        }
        userReactionsByReflection.get(reaction.reflection_id)!.add(reaction.kind)
      }
    }
  }

  return raw.map((r) => ({
    id: r.id,
    body: r.body,
    visibility: r.visibility,
    created_at: r.submitted_at,
    updated_at: null,
    content: r.content
      ? {
          id: r.content.id,
          title: r.content.title,
          year_id: r.content.year_id,
          prompt: r.content.reflection_prompt,
        }
      : null,
    author: r.author,
    comment_count: counts.get(r.id) ?? 0,
    reactions: Array.from(reactionsByReflection.get(r.id)?.entries() ?? []).map(
      ([kind, count]) => ({ kind, count }),
    ),
    user_reactions: Array.from(userReactionsByReflection.get(r.id) ?? []),
  }))
}

/** Wire shape returned by loadComments(). */
export interface CommentItem {
  id: string
  body: string
  created_at: string
  updated_at: string | null
  parent_comment_id: string | null
  is_deleted: boolean
  author: {
    id: string
    full_name: string | null
    email: string | null
    avatar_url: string | null
  } | null
}

interface RawCommentRow {
  id: string
  body: string
  created_at: string
  updated_at: string | null
  parent_comment_id: string | null
  deleted_at: string | null
  author: {
    id: string
    full_name: string | null
    email: string | null
    avatar_url: string | null
  } | null
}

/**
 * Fetch the (non-deleted) comments for a single subject (a post or
 * a reflection). Soft-deleted comments are kept in the result list
 * so the UI can show "removed" placeholders that preserve thread
 * structure, but their body is blanked.
 */
export async function loadComments(
  subjectType: 'post' | 'reflection',
  subjectId: string,
): Promise<CommentItem[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('community_comments')
    .select(
      `
      id, body, created_at, updated_at, parent_comment_id, deleted_at,
      author:profile_id ( id, full_name, email, avatar_url )
      `,
    )
    .eq('subject_type', subjectType)
    .eq('subject_id', subjectId)
    .order('created_at', { ascending: true })
    .returns<RawCommentRow[]>()

  if (error || !data) return []

  return data.map((c) => ({
    id: c.id,
    body: c.deleted_at ? '' : c.body,
    created_at: c.created_at,
    updated_at: c.updated_at,
    parent_comment_id: c.parent_comment_id,
    is_deleted: c.deleted_at !== null,
    author: c.author,
  }))
}
