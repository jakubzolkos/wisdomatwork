import { NextRequest, NextResponse } from 'next/server'
import { setupCustomPagesDatabase } from '@/lib/custom-pages/setup'
import { adminRouteGuard } from '@/lib/admin-access-server'

/**
 * POST /api/admin/custom-pages/setup
 * One-time endpoint to initialize custom pages database and seed the About page
 */
export async function POST(request: NextRequest) {
  try {
    const denied = await adminRouteGuard('system')
    if (denied) return denied

    const result = await setupCustomPagesDatabase()

    if (result.success) {
      return NextResponse.json(result)
    } else {
      return NextResponse.json(result, { status: 400 })
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Setup failed', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
