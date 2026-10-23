import { createClient } from '@/lib/supabase/server'
import { logMaintenanceAction } from '@/lib/maintenance/audit-logging'
import { adminRouteGuard } from '@/lib/admin-access-server'

export async function GET(request: Request) {
  const denied = await adminRouteGuard('system')
  if (denied) return denied
  const supabase = await createClient()

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = 100
  const offset = (page - 1) * pageSize

  try {
    const { data: posts, count, error } = await supabase
      .from('community_posts')
      .select(
        'id, title, created_at, updated_at, created_by, profiles!community_posts_created_by_fkey(full_name)',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (error) throw error

    return Response.json({
      items: posts || [],
      count: count || 0,
      page,
      pageSize,
    })
  } catch (error) {
    console.error('[v0] Error fetching community posts:', error)
    return Response.json(
      { error: 'Failed to fetch community posts' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  const denied = await adminRouteGuard('system')
  if (denied) return denied
  const supabase = await createClient()
  const user = await supabase.auth.getUser()
  const adminId = user.data.user?.id

  try {
    const { beforeDate, postIds } = await request.json()

    if (!beforeDate && !postIds) {
      return Response.json(
        { error: 'Provide either beforeDate or postIds' },
        { status: 400 }
      )
    }

    let deletedCount = 0

    if (postIds && postIds.length > 0) {
      // Delete comments/replies first, then the posts
      for (const postId of postIds) {
        await supabase
          .from('community_comments')
          .delete()
          .eq('post_id', postId)

        const { error } = await supabase
          .from('community_posts')
          .delete()
          .eq('id', postId)

        if (!error) deletedCount++
      }
    }

    if (beforeDate) {
      const { data: postsToDelete } = await supabase
        .from('community_posts')
        .select('id')
        .lt('created_at', beforeDate)

      if (postsToDelete && postsToDelete.length > 0) {
        for (const post of postsToDelete) {
          await supabase
            .from('community_comments')
            .delete()
            .eq('post_id', post.id)

          await supabase
            .from('community_posts')
            .delete()
            .eq('id', post.id)

          deletedCount++
        }
      }
    }

    // Log the action
    if (adminId) {
      await logMaintenanceAction(adminId, {
        actionType: 'bulk_delete',
        itemType: 'community_posts',
        itemId: postIds?.[0] || 'batch',
        itemName: `${deletedCount} community posts with replies`,
        details: {
          count: deletedCount,
          beforeDate,
          postIds,
        },
      })
    }

    return Response.json({
      message: `Deleted ${deletedCount} community posts and all replies`,
      deletedCount,
    })
  } catch (error) {
    console.error('[v0] Error deleting community posts:', error)
    return Response.json(
      { error: 'Failed to delete community posts' },
      { status: 500 }
    )
  }
}
