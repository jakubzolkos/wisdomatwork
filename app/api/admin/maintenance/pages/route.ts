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
    const { data: pages, count, error } = await supabase
      .from('custom_pages')
      .select('id, title, slug, is_published, created_at, updated_at', {
        count: 'exact',
      })
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (error) throw error

    return Response.json({
      items: pages || [],
      count: count || 0,
      page,
      pageSize,
    })
  } catch (error) {
    console.error('[v0] Error fetching custom pages:', error)
    return Response.json(
      { error: 'Failed to fetch custom pages' },
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
    const { beforeDate, pageIds } = await request.json()

    if (!beforeDate && !pageIds) {
      return Response.json(
        { error: 'Provide either beforeDate or pageIds' },
        { status: 400 }
      )
    }

    let deletedCount = 0

    if (pageIds && pageIds.length > 0) {
      const { count, error } = await supabase
        .from('custom_pages')
        .delete()
        .in('id', pageIds)

      if (!error) deletedCount = count || 0
    }

    if (beforeDate) {
      const { count, error } = await supabase
        .from('custom_pages')
        .delete()
        .lt('created_at', beforeDate)

      if (!error) deletedCount += count || 0
    }

    // Log the action
    if (adminId) {
      await logMaintenanceAction(adminId, {
        actionType: 'bulk_delete',
        itemType: 'custom_pages',
        itemId: pageIds?.[0] || 'batch',
        itemName: `${deletedCount} custom pages`,
        details: {
          count: deletedCount,
          beforeDate,
          pageIds,
        },
      })
    }

    return Response.json({
      message: `Deleted ${deletedCount} custom pages`,
      deletedCount,
    })
  } catch (error) {
    console.error('[v0] Error deleting custom pages:', error)
    return Response.json(
      { error: 'Failed to delete custom pages' },
      { status: 500 }
    )
  }
}
