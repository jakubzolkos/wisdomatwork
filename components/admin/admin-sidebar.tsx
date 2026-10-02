'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { ADMIN_NAV_GROUPS } from '@/components/admin/admin-nav-items'

function isActive(pathname: string, href: string): boolean {
  // Dashboard only matches exactly; every other section also owns its
  // detail pages (e.g. /admin/curriculum/<phaseId>/modules/...).
  if (href === '/admin') return pathname === '/admin'
  return pathname === href || pathname.startsWith(`${href}/`)
}

/**
 * Vertical tab rail for the admin console. Always visible: icon-only
 * on small screens, icon + label from md up. Sticky below the TopBar
 * (h-16) so it stays in view while the page scrolls.
 */
export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Admin sections"
      className="sticky top-16 h-[calc(100vh-4rem)] w-14 shrink-0 overflow-y-auto border-r border-sidebar-border py-4 md:w-60 md:py-6"
    >
      <div className="flex flex-col gap-4 px-2 md:gap-5 md:px-3">
        {ADMIN_NAV_GROUPS.map((group) => (
          <div key={group.label} className="flex flex-col gap-0.5">
            <p className="mb-1 hidden px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:block">
              {group.label}
            </p>
            {group.items.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href)
              return (
                <Link
                  key={href}
                  href={href}
                  title={label}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center justify-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors md:justify-start md:px-3',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                    active
                      ? 'bg-primary-soft font-medium text-primary'
                      : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  )}
                >
                  <Icon className="size-[18px] shrink-0" aria-hidden="true" />
                  <span className="sr-only md:not-sr-only md:truncate">{label}</span>
                </Link>
              )
            })}
          </div>
        ))}
      </div>
    </nav>
  )
}
