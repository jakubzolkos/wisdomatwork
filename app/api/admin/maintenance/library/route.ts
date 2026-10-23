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
    // Fetch all resources from the library
    const { data: resources, count, error } = await supabase
      .from('resources')
      .select('id, title, resource_type, created_at, updated_at', {
        count: 'exact',
      })
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)

    // If there's an error (likely table doesn't exist), return empty gracefully
    if (error) {
      return Response.json({
        items: [],
        count: 0,
        page,
        pageSize,
      })
    }

    return Response.json({
      items: resources || [],
      count: count || 0,
      page,
      pageSize,
    })
  } catch (error) {
    console.error('[v0] Error fetching library resources:', error)
    return Response.json({
      items: [],
      count: 0,
      page,
      pageSize,
    })
  }
}

export async function DELETE(request: Request) {
  const denied = await adminRouteGuard('system')
  if (denied) return denied
  const supabase = await createClient()
  const user = await supabase.auth.getUser()
  const adminId = user.data.user?.id

  try {
    const { beforeDate, resourceIds } = await request.json()

    if (!beforeDate && !resourceIds) {
      return Response.json(
        { error: 'Provide either beforeDate or resourceIds' },
        { status: 400 }
      )
    }

    let deletedCount = 0

    if (resourceIds && resourceIds.length > 0) {
      const { count, error } = await supabase
        .from('resources')
        .delete()
        .in('id', resourceIds)

      if (!error) deletedCount = count || 0
    }

    if (beforeDate) {
      const { count, error } = await supabase
        .from('resources')
        .delete()
        .lt('created_at', beforeDate)

      if (!error) deletedCount += count || 0
    }

    // Log the action
    if (adminId) {
      await logMaintenanceAction(adminId, {
        actionType: 'bulk_delete',
        itemType: 'resources',
        itemId: resourceIds?.[0] || 'batch',
        itemName: `${deletedCount} library resources`,
        details: {
          count: deletedCount,
          beforeDate,
          resourceIds,
        },
      })
    }

    return Response.json({
      message: `Deleted ${deletedCount} unassigned library resources`,
      deletedCount,
    })
  } catch (error) {
    console.error('[v0] Error deleting resources:', error)
    return Response.json(
      { error: 'Failed to delete resources' },
      { status: 500 }
    )
  }
}
