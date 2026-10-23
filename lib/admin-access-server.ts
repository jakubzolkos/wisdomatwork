import 'server-only'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth-server'
import { ADMIN_ROLE_LABELS, canAdmin, canAssignRoles, effectiveAdminRole, type AdminArea } from '@/lib/admin-access'
import type { CurrentUser } from '@/lib/user-context'

/**
 * Admin page guard: an admin whose role can't see `area` goes back to
 * the admin dashboard. (requireAdmin already sends non-admins away.)
 */
export async function requireAdminPage(area: AdminArea): Promise<CurrentUser> {
  const user = await requireAdmin()
  if (!canAdmin(user, area, 'read')) redirect('/admin')
  return user
}

/**
 * Admin action guard: throws when the admin's role can't do this, with
 * a message the action's catch shows to them. Use at the top of every
 * admin server action and API route that changes something.
 */
export async function assertAdminArea(area: AdminArea, need: 'read' | 'write' = 'write'): Promise<CurrentUser> {
  const user = await requireAdmin()
  if (!canAdmin(user, area, need)) {
    const role = effectiveAdminRole(user)
    throw new Error(
      `Your admin role (${role ? ADMIN_ROLE_LABELS[role] : 'none'}) can’t ${need === 'write' ? 'change' : 'see'} this.`,
    )
  }
  return user
}

/** Changing anyone's role or admin role: tech admins only. */
export async function assertCanAssignRoles(): Promise<CurrentUser> {
  const user = await requireAdmin()
  if (!canAssignRoles(user)) throw new Error('Only a Tech admin can change roles.')
  return user
}

/**
 * Admin API route guard: null when allowed, otherwise a 403 response to
 * return. (Non-admins are still redirected to sign in by requireAdmin.)
 *
 *   const denied = await adminRouteGuard('system')
 *   if (denied) return denied
 */
export async function adminRouteGuard(area: AdminArea, need: 'read' | 'write' = 'write'): Promise<Response | null> {
  const user = await requireAdmin()
  if (canAdmin(user, area, need)) return null
  return Response.json({ error: 'Your admin role can’t do this.' }, { status: 403 })
}
