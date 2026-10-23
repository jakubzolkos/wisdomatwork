import type { LucideIcon } from 'lucide-react'
import { canAdmin, type AdminArea, type AdminRole } from '@/lib/admin-access'
import {
  BarChart3,
  BookOpen,
  Building2,
  CalendarDays,
  FileText,
  LayoutDashboard,
  Library,
  Mail,
  Megaphone,
  MessagesSquare,
  Users,
} from 'lucide-react'

export interface AdminNavItem {
  href: string
  label: string
  icon: LucideIcon
  /** Admin area it belongs to; shown only to roles that can see it. */
  area?: AdminArea
  /** Shown on the admin dashboard cards. */
  description?: string
}

export interface AdminNavGroup {
  label: string
  items: AdminNavItem[]
}

/**
 * Single source of truth for the admin console sections. Drives both
 * the always-visible left rail (AdminSidebar) and the dashboard cards.
 */
export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    label: 'Overview',
    items: [{ href: '/admin', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'People',
    items: [
      {
        href: '/admin/users',
        area: 'people',
        label: 'Users & cohorts',
        icon: Users,
        description: 'Invite fellows, set roles, assign cohort labels, deactivate accounts.',
      },
      {
        href: '/admin/progress',
        area: 'progress',
        label: 'Progress',
        icon: BarChart3,
        description: "Each fellow's progress through the curriculum, with their reflections.",
      },
      {
        href: '/admin/schools',
        area: 'people',
        label: 'Schools & teams',
        icon: Building2,
        description: 'Group fellows by school team for collaborative reporting and rosters.',
      },
    ],
  },
  {
    label: 'Content',
    items: [
      {
        href: '/admin/curriculum',
        area: 'content',
        label: 'Curriculum',
        icon: BookOpen,
        description:
          'Author phases, items, and content blocks. Assign each to one or more cohorts.',
      },
      {
        href: '/admin/library',
        area: 'content',
        label: 'Library',
        icon: Library,
        description:
          'Add, edit, and remove curated books, videos, podcasts, and other resources. Gate by cohort or publish as Recommended Resources.',
      },
      {
        href: '/admin/custom-pages',
        area: 'content',
        label: 'Custom pages',
        icon: FileText,
        description:
          'Create and manage custom pages with rich content blocks, images, and text. Publish to the public site with custom URLs.',
      },
    ],
  },
  {
    label: 'Communication',
    items: [
      {
        href: '/admin/notifications',
        area: 'comms',
        label: 'Notifications',
        icon: Megaphone,
        description:
          'Send announcements, reminders, and alerts. Targeted by cohort, school team, or specific fellows. Optionally email.',
      },
      {
        href: '/admin/schedule',
        area: 'comms',
        label: 'Scheduling',
        icon: CalendarDays,
        description:
          'Create scheduling polls, invite specific fellows to vote on availability, and finalize event times like WhenToMeet.',
      },
      {
        href: '/admin/community',
        area: 'comms',
        label: 'Community',
        icon: MessagesSquare,
        description: 'Moderate posts and events surfaced in the fellow community feed.',
      },
      {
        href: '/admin/email-logs',
        area: 'comms',
        label: 'Email logs',
        icon: Mail,
        description:
          'Track all emails sent in the past week. Monitor delivery status and resend failed emails.',
      },
    ],
  },
]

/** The menu as `user`'s admin role sees it (lib/admin-access.ts). */
export function visibleAdminNav(user: { role: string; adminRole?: AdminRole | null } | null | undefined): AdminNavGroup[] {
  return ADMIN_NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => !i.area || canAdmin(user, i.area, 'read')),
  })).filter((g) => g.items.length > 0)
}
