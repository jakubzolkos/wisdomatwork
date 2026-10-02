import type { LucideIcon } from 'lucide-react'
import {
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
        label: 'Users & cohorts',
        icon: Users,
        description: 'Invite fellows, set roles, assign cohort labels, deactivate accounts.',
      },
      {
        href: '/admin/schools',
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
        label: 'Curriculum',
        icon: BookOpen,
        description:
          'Author phases, items, and content blocks. Assign each to one or more cohorts.',
      },
      {
        href: '/admin/library',
        label: 'Library',
        icon: Library,
        description:
          'Add, edit, and remove curated books, videos, podcasts, and other resources. Gate by cohort or publish as Recommended Resources.',
      },
      {
        href: '/admin/custom-pages',
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
        label: 'Notifications',
        icon: Megaphone,
        description:
          'Send announcements, reminders, and alerts. Targeted by cohort, school team, or specific fellows. Optionally email.',
      },
      {
        href: '/admin/schedule',
        label: 'Scheduling',
        icon: CalendarDays,
        description:
          'Create scheduling polls, invite specific fellows to vote on availability, and finalize event times like WhenToMeet.',
      },
      {
        href: '/admin/community',
        label: 'Community',
        icon: MessagesSquare,
        description: 'Moderate posts and events surfaced in the fellow community feed.',
      },
      {
        href: '/admin/email-logs',
        label: 'Email logs',
        icon: Mail,
        description:
          'Track all emails sent in the past week. Monitor delivery status and resend failed emails.',
      },
    ],
  },
]
