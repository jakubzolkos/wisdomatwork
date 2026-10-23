import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { adminRouteGuard } from '@/lib/admin-access-server'

export async function GET() {
  try {
    const supabase = await createClient()

    // Get navigation labels from the database - get all rows (should only be 1)
    const { data, error } = await supabase
      .from('navigation_labels')
      .select('*')
      .limit(1)

    const defaultLabels = {
      dashboard: 'Dashboard',
      about: 'About',
      library: 'Library',
      community: 'Community',
    }

    if (error) {
      console.error('[v0] Error fetching navigation labels:', error)
      const response = NextResponse.json(defaultLabels)
      response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120')
      return response
    }

    // If we have data, return the first row
    if (data && data.length > 0) {
      const response = NextResponse.json(data[0])
      response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120')
      return response
    }

    // Return defaults if empty
    const response = NextResponse.json(defaultLabels)
    response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120')
    return response
  } catch (error) {
    console.error('[v0] Error in navigation labels GET:', error)
    const response = NextResponse.json({
      dashboard: 'Dashboard',
      about: 'About',
      library: 'Library',
      community: 'Community',
    })
    response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120')
    return response
  }
}

export async function PUT(request: Request) {
  try {
    const denied = await adminRouteGuard('system')
    if (denied) return denied
    const supabase = await createClient()
    const labels = await request.json()

    console.log('[v0] PUT navigation labels:', labels)

    // Validate labels
    if (
      !labels.dashboard ||
      !labels.about ||
      !labels.library ||
      !labels.community
    ) {
      return NextResponse.json(
        { error: 'All labels are required' },
        { status: 400 }
      )
    }

    // Get existing record
    const { data: existing, error: fetchError } = await supabase
      .from('navigation_labels')
      .select('id')
      .limit(1)

    if (fetchError) {
      console.error('[v0] Error fetching existing labels:', fetchError)
    }

    let result
    if (existing && existing.length > 0) {
      // Update existing record
      console.log('[v0] Updating existing record:', existing[0].id)
      result = await supabase
        .from('navigation_labels')
        .update({
          dashboard: labels.dashboard,
          about: labels.about,
          library: labels.library,
          community: labels.community,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing[0].id)
        .select()
        .single()
    } else {
      // Insert new record
      console.log('[v0] Inserting new record')
      result = await supabase
        .from('navigation_labels')
        .insert([
          {
            dashboard: labels.dashboard,
            about: labels.about,
            library: labels.library,
            community: labels.community,
          },
        ])
        .select()
        .single()
    }

    if (result.error) {
      console.error('[v0] Error updating/inserting labels:', result.error)
      throw result.error
    }

    console.log('[v0] Successfully saved labels:', result.data)
    
    // Revalidate cache for navigation labels
    revalidateTag('navigation-labels', 'hours')

    const response = NextResponse.json(result.data)
    response.headers.set('Cache-Control', 'no-store')
    return response
  } catch (error) {
    console.error('[v0] Error in navigation labels PUT:', error)
    return NextResponse.json(
      { error: 'Failed to update navigation labels' },
      { status: 500 }
    )
  }
}
