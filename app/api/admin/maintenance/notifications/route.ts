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
    const { data: notifications, count, error } = await supabase
      .from('notifications')
      .select('id, title, status, created_at, updated_at', {
        count: 'exact',
      })
      .neq('status', 'sent')
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (error) throw error

    return Response.json({
      items: notifications || [],
      count: count || 0,
      page,
      pageSize,
    })
  } catch (error) {
    console.error('[v0] Error fetching notifications:', error)
    return Response.json(
      { error: 'Failed to fetch notifications' },
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
    const { beforeDate, notificationIds } = await request.json()

    if (!beforeDate && !notificationIds) {
      return Response.json(
        { error: 'Provide either beforeDate or notificationIds' },
        { status: 400 }
      )
    }

    let deletedCount = 0

    if (notificationIds && notificationIds.length > 0) {
      const { count, error } = await supabase
        .from('notifications')
        .delete()
        .in('id', notificationIds)

      if (!error) deletedCount = count || 0
    }

    if (beforeDate) {
      const { count, error } = await supabase
        .from('notifications')
        .delete()
        .lt('created_at', beforeDate)

      if (!error) deletedCount += count || 0
    }

    // Log the action
    if (adminId) {
      await logMaintenanceAction(adminId, {
        actionType: 'bulk_delete',
        itemType: 'notifications',
        itemId: notificationIds?.[0] || 'batch',
        itemName: `${deletedCount} unsent notifications`,
        details: {
          count: deletedCount,
          beforeDate,
          notificationIds,
        },
      })
    }

    return Response.json({
      message: `Deleted ${deletedCount} unsent notifications`,
      deletedCount,
    })
  } catch (error) {
    console.error('[v0] Error deleting notifications:', error)
    return Response.json(
      { error: 'Failed to delete notifications' },
      { status: 500 }
    )
  }
}
