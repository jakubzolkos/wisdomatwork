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
    // Get all content items (labs) - these are curriculum items, not a separate "draft" table
    // We'll fetch all items that could be cleaned up
    const { data: labs, count, error } = await supabase
      .from('labs')
      .select('id, title, description, created_at, module_id', {
        count: 'exact',
      })
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (error) {
      throw error
    }

    return Response.json({
      items: labs || [],
      count: count || 0,
      page,
      pageSize,
    })
  } catch (error) {
    console.error('[v0] Error fetching draft content:', error)
    return Response.json(
      { error: 'Failed to fetch draft content' },
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
    const { beforeDate, labIds } = await request.json()

    if (!beforeDate && !labIds) {
      return Response.json(
        { error: 'Provide either beforeDate or labIds' },
        { status: 400 }
      )
    }

    let deletedCount = 0

    if (labIds && labIds.length > 0) {
      // Delete specific labs and all their child records
      for (const labId of labIds) {
        // Delete all related reflections, activities, comments, etc.
        await supabase
          .from('reflections')
          .delete()
          .eq('lab_id', labId)

        await supabase
          .from('lab_activities')
          .delete()
          .eq('lab_id', labId)

        // Finally delete the lab itself
        const { error } = await supabase
          .from('labs')
          .delete()
          .eq('id', labId)

        if (!error) deletedCount++
      }
    }

    if (beforeDate) {
      // Get all labs before this date
      const { data: labsToDelete } = await supabase
        .from('labs')
        .select('id')
        .lt('created_at', beforeDate)

      if (labsToDelete && labsToDelete.length > 0) {
        for (const lab of labsToDelete) {
          // Delete all related reflections, activities, comments, etc.
          await supabase
            .from('reflections')
            .delete()
            .eq('lab_id', lab.id)

          await supabase
            .from('lab_activities')
            .delete()
            .eq('lab_id', lab.id)

          // Delete the lab
          await supabase
            .from('labs')
            .delete()
            .eq('id', lab.id)

          deletedCount++
        }
      }
    }

    // Log the action
    if (adminId) {
      await logMaintenanceAction(adminId, {
        actionType: 'bulk_delete',
        itemType: 'labs',
        itemId: labIds?.[0] || 'batch',
        itemName: `${deletedCount} draft labs with related content`,
        details: {
          count: deletedCount,
          beforeDate,
          labIds,
        },
      })
    }

    return Response.json({
      message: `Deleted ${deletedCount} draft labs and all related content`,
      deletedCount,
    })
  } catch (error) {
    console.error('[v0] Error deleting content:', error)
    return Response.json(
      { error: 'Failed to delete content' },
      { status: 500 }
    )
  }
}
