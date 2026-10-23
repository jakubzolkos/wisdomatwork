import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logMaintenanceAction } from '@/lib/maintenance/audit-logging'
import { getCurrentUser } from '@/lib/auth-server'
import { adminRouteGuard } from '@/lib/admin-access-server'

export async function GET(request: NextRequest) {
  try {
    const denied = await adminRouteGuard('system')
    if (denied) return denied
    const supabase = await createClient()

    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1', 10)
    const pageSize = 50
    const offset = (page - 1) * pageSize

    const roleFilter = searchParams.get('role')
    const cohortFilter = searchParams.get('cohort')
    const statusFilter = searchParams.get('status')
    const search = searchParams.get('search')

    let query = supabase
      .from('profiles')
      .select(
        `
        id,
        full_name,
        email,
        role,
        cohort,
        school_id,
        deactivated_at,
        created_at,
        schools(name),
        community_posts!community_posts_created_by_fkey(id)
      `,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (roleFilter) {
      query = query.eq('role', roleFilter)
    }

    if (cohortFilter) {
      query = query.eq('cohort', cohortFilter)
    }

    if (statusFilter === 'deactivated') {
      query = query.not('deactivated_at', 'is', null)
    } else if (statusFilter === 'active') {
      query = query.is('deactivated_at', null)
    } else if (statusFilter === 'never_logged_in') {
      // This would require additional metadata tracking
    }

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`)
    }

    const { data: users, error, count } = await query

    if (error) {
      throw error
    }

    const transformedUsers = users?.map((user: any) => ({
      id: user.id,
      name: user.full_name,
      email: user.email,
      role: user.role,
      cohort: user.cohort,
      school: user.schools?.name,
      deactivated: !!user.deactivated_at,
      postsCount: user.community_posts?.length || 0,
      reflectionsCount: 0,
      commentsCount: 0,
      relatedContentCount: user.community_posts?.length || 0,
    }))

    return NextResponse.json({
      users: transformedUsers,
      total: count,
      page,
      pageSize,
    })
  } catch (error) {
    console.error('[v0] Error fetching users for cleanup:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Same gate as GET: maintenance is tech only (lib/admin-access.ts).
    const denied = await adminRouteGuard('system')
    if (denied) return denied
    const user = await getCurrentUser()
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { userId, action } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    const supabase = await createClient()

    // Check if user has content to warn about
    const { data: userContent } = await supabase.from('profiles').select(
      `
      full_name,
      email,
      community_posts!community_posts_created_by_fkey(id)
    `
    ).eq('id', userId).single()

    const hasContent = userContent &&
      ((userContent.community_posts?.length || 0) > 0)

    if (action === 'archive' || action === 'deactivate') {
      // Deactivate the user
      const { error } = await supabase
        .from('profiles')
        .update({ deactivated_at: new Date().toISOString() })
        .eq('id', userId)

      if (error) throw error

      await logMaintenanceAction(user.id, {
        actionType: 'archive',
        itemType: 'user',
        itemId: userId,
        itemName: userContent?.email,
        details: {
          hasRelatedContent: hasContent,
          relatedContentCount: userContent?.community_posts?.length || 0,
        },
      })

      return NextResponse.json({
        success: true,
        action: 'archived',
        message: `User ${userContent?.email} has been deactivated`,
      })
    }

    if (action === 'delete') {
      // Delete the user (permanent)
      if (hasContent) {
        return NextResponse.json(
          {
            error: 'Cannot delete user with related content',
            hasContent: true,
            details: userContent,
          },
          { status: 400 }
        )
      }

      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId)

      if (error) throw error

      await logMaintenanceAction(user.id, {
        actionType: 'delete',
        itemType: 'user',
        itemId: userId,
        itemName: userContent?.email,
        details: { permanent: true },
      })

      return NextResponse.json({
        success: true,
        action: 'deleted',
        message: `User ${userContent?.email} has been permanently deleted`,
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('[v0] Error deleting user:', error)
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    // Same gate as GET: maintenance is tech only (lib/admin-access.ts).
    const denied = await adminRouteGuard('system')
    if (denied) return denied
    const user = await getCurrentUser()
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { invitationId, action } = await request.json()

    if (!invitationId) {
      return NextResponse.json({ error: 'Invitation ID required' }, { status: 400 })
    }

    const supabase = await createClient()

    if (action === 'resend_invite') {
      // Logic to resend invitation (would need email service integration)
      // For now, just update the sent_at timestamp
      const { error } = await supabase
        .from('user_invitations')
        .update({ sent_at: new Date().toISOString() })
        .eq('id', invitationId)

      if (error) throw error

      const { data: invitation } = await supabase
        .from('user_invitations')
        .select('email')
        .eq('id', invitationId)
        .single()

      await logMaintenanceAction(user.id, {
        actionType: 'resend_invite',
        itemType: 'invitation',
        itemId: invitationId,
        itemName: invitation?.email,
      })

      return NextResponse.json({
        success: true,
        message: `Invitation resent to ${invitation?.email}`,
      })
    }

    if (action === 'delete_invitation') {
      const { data: invitation } = await supabase
        .from('user_invitations')
        .select('email')
        .eq('id', invitationId)
        .single()

      const { error } = await supabase
        .from('user_invitations')
        .delete()
        .eq('id', invitationId)

      if (error) throw error

      await logMaintenanceAction(user.id, {
        actionType: 'delete',
        itemType: 'invitation',
        itemId: invitationId,
        itemName: invitation?.email,
      })

      return NextResponse.json({
        success: true,
        message: `Invitation for ${invitation?.email} has been deleted`,
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('[v0] Error managing invitation:', error)
    return NextResponse.json({ error: 'Failed to manage invitation' }, { status: 500 })
  }
}
