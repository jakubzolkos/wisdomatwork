'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, Home } from 'lucide-react'

export function AdminBreadcrumb() {
  const pathname = usePathname()
  
  // Remove /admin prefix and split the path
  const path = pathname.replace('/admin', '') || '/'
  const segments = path.split('/').filter(Boolean)

  // Build breadcrumb items
  const items: Array<{ label: string; href: string }> = [
    { label: 'Dashboard', href: '/admin' },
  ]

  let currentPath = '/admin'
  for (const segment of segments) {
    currentPath += `/${segment}`
    const label = formatLabel(segment)
    items.push({ label, href: currentPath })
  }

  // If we're on a detail page (has id), remove the last breadcrumb and update the previous
  if (segments.length > 1 && isUUID(segments[segments.length - 1])) {
    const parentLabel = items[items.length - 2]?.label
    items.pop() // Remove UUID breadcrumb
    if (parentLabel) {
      items[items.length - 1].label = parentLabel
    }
  }

  return (
    <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <li key={item.href} className="flex items-center gap-1.5">
              {index === 0 ? (
                <Link
                  href={item.href}
                  className="flex items-center gap-1 rounded-sm transition-colors hover:text-foreground"
                  title="Back to Dashboard"
                >
                  <Home className="size-3.5" aria-hidden="true" />
                  <span>Admin</span>
                </Link>
              ) : (
                <Link
                  href={item.href}
                  aria-current={isLast ? 'page' : undefined}
                  className={
                    isLast
                      ? 'font-medium text-foreground'
                      : 'transition-colors hover:text-foreground'
                  }
                >
                  {item.label}
                </Link>
              )}

              {!isLast && (
                <ChevronRight className="size-3 text-muted-foreground/60" aria-hidden="true" />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function formatLabel(segment: string): string {
  return segment
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function isUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
}
