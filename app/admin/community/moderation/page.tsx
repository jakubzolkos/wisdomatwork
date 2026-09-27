import Link from 'next/link'
import { PageHeader } from '@/components/page-header'
import { Archive, ArrowLeft, Pin, Sparkles, Trash2 } from 'lucide-react'
import { requireAdmin } from '@/lib/auth-server'
import { createClient } from '@/lib/supabase/server'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { initialsFor } from '@/lib/types/profile'
import { PostAdminRow } from '@/components/community/post-admin-row'
import { CommentDeleteButton } from './comment-delete-button'
import { MemberOfWeekPicker } from './member-of-week-picker'

export const dynamic = 'force-dynamic'

/**
 * Admin moderation hub.
 *
 * One page where staff can:
 *   - feature / unfeature any community post
 *   - archive / unarchive any community post
 *   - soft-delete recent comments (across posts + reflections)
 *   - schedule the "member of the week" featured profile
 *
 * Heavy use of existing server actions (togglePostFeatured /
 * togglePostArchived / deleteComment) so we don't grow the
 * action surface area; this page is just a presentation layer
 * over them.
 */
export default async function ModerationHubPage() {
  await requireAdmin()
  const supabase = await createClient()

  // Pull the freshest 30 posts (any kind) so admins can quickly
  // act on whatever just landed. We deliberately *don't* filter
  // out archived posts here - moderators need to see them to
  // unarchive if needed.
  const postsP = supabase
    .from('community_posts')
    .select(
      `
      id,
      kind,
      title,
      excerpt,
      created_at,
      published_at,
      featured_at,
      is_archived,
      created_by,
      author:profiles!community_posts_created_by_fkey (
        id,
        full_name,
        profile_image_url
      )
    `,
    )
    .order('created_at', { ascending: false })
    .limit(30)

  // Recent (non-deleted) comments, newest first. We render the
  // body inline so admins don't have to click into each post.
  const commentsP = supabase
    .from('community_comments')
    .select(
      `
      id,
      subject_type,
      subject_id,
      body,
      created_at,
      profile:profiles!community_comments_profile_id_fkey (
        id,
        full_name,
        profile_image_url
      )
    `,
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(20)

  // Fellows + facilitators eligible to be Member of the Week.
  // We need their existing schedule so the picker can show "until
  // <date>" and let admins clear it.
  const profilesP = supabase
    .from('profiles')
    .select(
      `
      id,
      full_name,
      profile_image_url,
      headline,
      community_role_label,
      featured_member_from,
      featured_member_until
    `,
    )
    .in('role', ['fellow', 'facilitator'])
    .is('deactivated_at', null)
    .order('full_name', { ascending: true })

  const [postsRes, commentsRes, profilesRes] = await Promise.all([
    postsP,
    commentsP,
    profilesP,
  ])

  type PostRow = {
    id: string
    kind: string
    title: string | null
    excerpt: string | null
    created_at: string
    published_at: string | null
    featured_at: string | null
    is_archived: boolean
    created_by: string
    author: {
      id: string
      full_name: string | null
      profile_image_url: string | null
    } | null
  }
  type CommentRow = {
    id: string
    subject_type: 'post' | 'reflection'
    subject_id: string
    body: string
    created_at: string
    profile: {
      id: string
      full_name: string | null
      profile_image_url: string | null
    } | null
  }
  type ProfileRow = {
    id: string
    full_name: string | null
    profile_image_url: string | null
    headline: string | null
    community_role_label: string | null
    featured_member_from: string | null
    featured_member_until: string | null
  }

  const posts = ((postsRes.data ?? []) as unknown as PostRow[]) ?? []
  const comments =
    ((commentsRes.data ?? []) as unknown as CommentRow[]) ?? []
  const profiles =
    ((profilesRes.data ?? []) as unknown as ProfileRow[]) ?? []

  // The single profile (if any) currently scheduled as Member of
  // the Week. Schedule windows are inclusive of `until`.
  const now = new Date()
  const currentMember = profiles.find((p) => {
    if (!p.featured_member_until) return false
    const until = new Date(p.featured_member_until)
    if (Number.isNaN(until.getTime())) return false
    return until >= now
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Link
          href="/admin/community"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Community admin
        </Link>
        <PageHeader
          className="mb-2"
          eyebrow="Community"
          title="Moderation hub"
          description="Pin standout posts, archive ones that need to disappear, soft-delete comments that crossed a line, and schedule the Member of the Week."
        />
      </div>

      {/* Member of the week picker */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
            Member of the week
          </CardTitle>
          <CardDescription>
            Surfaces in the bios directory hero and the community dashboard.
            Pick a profile and an end date; clear it any time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MemberOfWeekPicker
            profiles={profiles.map((p) => ({
              id: p.id,
              fullName: p.full_name,
              headline: p.headline,
            }))}
            current={
              currentMember
                ? {
                    id: currentMember.id,
                    fullName: currentMember.full_name,
                    profileImageUrl: currentMember.profile_image_url,
                    headline: currentMember.headline,
                    until: currentMember.featured_member_until,
                  }
                : null
            }
          />
        </CardContent>
      </Card>

      {/* Recent posts with admin controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Pin className="h-4 w-4 text-primary" aria-hidden="true" />
            Recent posts
          </CardTitle>
          <CardDescription>
            Latest 30 posts across every section. Use the feature toggle to pin
            a win, or archive a post to hide it from the feeds.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {posts.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No posts yet.
            </p>
          ) : (
            <ul className="-my-3 divide-y divide-border">
              {posts.map((post) => (
                <li key={post.id} className="py-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage
                        src={post.author?.profile_image_url ?? undefined}
                        alt=""
                      />
                      <AvatarFallback>
                        {initialsFor(post.author?.full_name ?? null, null)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="capitalize">
                          {post.kind}
                        </Badge>
                        {post.featured_at && (
                          <Badge className="gap-1 border-transparent bg-warning-soft text-warning hover:bg-warning-soft">
                            <Sparkles className="h-3 w-3" /> Featured
                          </Badge>
                        )}
                        {post.is_archived && (
                          <Badge
                            variant="outline"
                            className="gap-1 border-destructive/30 bg-destructive/10 text-destructive"
                          >
                            <Archive className="h-3 w-3" /> Archived
                          </Badge>
                        )}
                        {!post.published_at && (
                          <Badge variant="outline">Draft</Badge>
                        )}
                      </div>
                      <Link
                        href={`/community/stories/${post.id}`}
                        className="mt-1 block font-medium text-foreground hover:text-primary"
                      >
                        {post.title ?? '(untitled)'}
                      </Link>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {post.author?.full_name ?? 'Unknown'} ·{' '}
                        {new Date(post.created_at).toLocaleString()}
                      </p>
                      {post.excerpt && (
                        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                          {post.excerpt}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-3">
                    <PostAdminRow
                      postId={post.id}
                      isFeatured={Boolean(post.featured_at)}
                      isArchived={Boolean(post.is_archived)}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Recent comments with delete */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Trash2 className="h-4 w-4 text-primary" aria-hidden="true" />
            Recent comments
          </CardTitle>
          <CardDescription>
            Newest 20 comments across posts and reflections. Deletion is a
            soft-delete - the row stays for audit but the body is hidden from
            fellows.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {comments.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No comments yet.
            </p>
          ) : (
            <ul className="-my-3 divide-y divide-border">
              {comments.map((comment) => (
                <li
                  key={comment.id}
                  className="flex items-start gap-3 py-4"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage
                      src={comment.profile?.profile_image_url ?? undefined}
                      alt=""
                    />
                    <AvatarFallback>
                      {initialsFor(comment.profile?.full_name ?? null, null)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {comment.profile?.full_name ?? 'Unknown'}
                      </span>
                      <Badge variant="outline" className="capitalize">
                        {comment.subject_type}
                      </Badge>
                      <span>
                        {new Date(comment.created_at).toLocaleString()}
                      </span>
                      {comment.subject_type === 'post' && (
                        <Link
                          href={`/community/stories/${comment.subject_id}`}
                          className="underline hover:text-foreground"
                        >
                          View post
                        </Link>
                      )}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                      {comment.body}
                    </p>
                  </div>
                  <CommentDeleteButton commentId={comment.id} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Need richer audit logs?{' '}
        <Button asChild variant="link" className="h-auto p-0">
          <Link href="/admin/community">Open the full Community admin</Link>
        </Button>
        .
      </p>
    </div>
  )
}
