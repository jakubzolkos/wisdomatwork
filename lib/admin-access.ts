/**
 * Admin roles: what each staff admin can see and change in the admin
 * console. The four roles of the WaW Call for Proposals ("Role-based
 * admin logins: separate permissions for Tech (full access), Research,
 * Operations, and Communications, each seeing only what their work
 * requires"). One table, used by the admin menu, every admin page and
 * every admin action (lib/admin-access-server.ts); the database
 * (scripts/066_admin_roles.sql) lets only tech change roles.
 *
 * Client-safe: no server imports.
 */

export type AdminRole = 'tech' | 'ops' | 'research' | 'comms'

export const ADMIN_ROLES: readonly AdminRole[] = ['tech', 'ops', 'research', 'comms']

export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  tech: 'Tech',
  ops: 'Operations',
  research: 'Research',
  comms: 'Communications',
}

export const ADMIN_ROLE_DESCRIPTIONS: Record<AdminRole, string> = {
  tech: 'Full access, including maintenance and assigning admin roles.',
  ops: 'Onboarding (users, schools, teams) and content. Views progress.',
  research: 'Progress, responses and data exports. Views content.',
  comms: 'Messages, reminders and scheduling.',
}

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === 'string' && (ADMIN_ROLES as readonly string[]).includes(value)
}

/** Parts of the admin console, by what they change. */
export type AdminArea =
  | 'people' // users, invites, schools & teams
  | 'progress' // fellow progress, reflections, exports
  | 'content' // curriculum, library, custom pages, about, images
  | 'comms' // notifications, reminders, scheduling, community, email logs
  | 'system' // maintenance, navigation labels, setup routes

export type Access = 'none' | 'read' | 'write'

/**
 * From the Call for Proposals, "Admin View":
 *   Research: export surveys, analyze and download data.
 *   Operations and Administration: onboarding, RPP compliance, finance,
 *     attendance (and content: "non-technical staff can update the
 *     syllabus, assignments, surveys, library").
 *   Communications: queued, automated messages with checks and measures.
 * Survey editing for Research comes with native surveys.
 */
const ACCESS: Record<AdminRole, Record<AdminArea, Access>> = {
  tech: { people: 'write', progress: 'write', content: 'write', comms: 'write', system: 'write' },
  ops: { people: 'write', progress: 'read', content: 'write', comms: 'none', system: 'none' },
  research: { people: 'none', progress: 'write', content: 'read', comms: 'none', system: 'none' },
  comms: { people: 'none', progress: 'none', content: 'none', comms: 'write', system: 'none' },
}

/** An admin with no role set (before 066, or never assigned) is tech, as before. */
export function effectiveAdminRole(user: { role: string; adminRole?: AdminRole | null } | null | undefined): AdminRole | null {
  if (!user || user.role !== 'admin') return null
  return user.adminRole ?? 'tech'
}

export function adminAccess(role: AdminRole | null, area: AdminArea): Access {
  return role ? ACCESS[role][area] : 'none'
}

export function canAdmin(
  user: { role: string; adminRole?: AdminRole | null } | null | undefined,
  area: AdminArea,
  need: 'read' | 'write' = 'read',
): boolean {
  const access = adminAccess(effectiveAdminRole(user), area)
  return need === 'read' ? access !== 'none' : access === 'write'
}

/** Assigning roles (role, admin role) is tech only. */
export function canAssignRoles(user: { role: string; adminRole?: AdminRole | null } | null | undefined): boolean {
  return effectiveAdminRole(user) === 'tech'
}
