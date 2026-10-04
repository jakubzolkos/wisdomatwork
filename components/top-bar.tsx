'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { Settings, LogOut, User as UserIcon, Shield, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useMaybeUser } from '@/lib/user-context'
import { createClient } from '@/lib/supabase/client'
import { roleLabels } from '@/lib/roles'
import { canSeeCommunity } from '@/lib/features'
import { cn } from '@/lib/utils'
import { NotificationsBell } from '@/components/notifications/notifications-bell'
import { PreviewCohortMenu } from '@/components/admin/preview-cohort-menu'
import type { CustomPage } from '@/lib/custom-pages/types'

interface TopBarProps {
  customPages?: CustomPage[]
}

type LabelKey = 'dashboard' | 'about' | 'library' | 'community'

const PRIMARY_NAV: { key: LabelKey; href: string; match: string[] }[] = [
  { key: 'dashboard', href: '/dashboard', match: ['/dashboard', '/phases'] },
  { key: 'about', href: '/about', match: ['/about'] },
  { key: 'library', href: '/resources', match: ['/resources'] },
  { key: 'community', href: '/community', match: ['/community'] },
]

const DEFAULT_LABELS: Record<LabelKey, string> = {
  dashboard: 'Dashboard',
  about: 'About',
  library: 'Library',
  community: 'Community',
}

// Module-level caches. Each section layout mounts its own TopBar, so
// without these every section switch refetched both endpoints (each
// one another trip through the proxy + Supabase) and flashed defaults.
let labelsCache: Record<LabelKey, string> | null = null
let labelsRequest: Promise<Record<LabelKey, string> | null> | null = null
const customPagesCache = new Map<string, CustomPage[]>()

function loadLabels(): Promise<Record<LabelKey, string> | null> {
  labelsRequest ??= fetch('/api/admin/navigation-labels')
    .then((response) => (response.ok ? response.json() : null))
    .then((data) => {
      if (!data) return null
      labelsCache = {
        dashboard: data.dashboard || DEFAULT_LABELS.dashboard,
        about: data.about || DEFAULT_LABELS.about,
        library: data.library || DEFAULT_LABELS.library,
        community: data.community || DEFAULT_LABELS.community,
      }
      return labelsCache
    })
    .catch((error) => {
      console.error('Error loading navigation labels:', error)
      labelsRequest = null
      return null
    })
  return labelsRequest
}

function isActive(pathname: string, prefixes: string[]) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

export function TopBar({ customPages: initialCustomPages = [] }: TopBarProps) {
  const { user } = useMaybeUser()
  const router = useRouter()
  const pathname = usePathname() ?? ''
  const [labels, setLabels] = useState<Record<LabelKey, string>>(labelsCache ?? DEFAULT_LABELS)
  const pagesKey = `${user?.id ?? 'anon'}:${user?.role ?? ''}`
  const [customPages, setCustomPages] = useState<CustomPage[]>(
    initialCustomPages.length > 0 ? initialCustomPages : (customPagesCache.get(pagesKey) ?? []),
  )
  const [mobileOpen, setMobileOpen] = useState(false)
  const isAdmin = user?.role === 'admin'
  // Community is hidden from fellows at launch (lib/features.ts).
  const navItems = PRIMARY_NAV.filter((item) => item.key !== 'community' || canSeeCommunity(user?.role))

  // Labels are fetched once per page load and shared across remounts.
  useEffect(() => {
    if (labelsCache) return
    let cancelled = false
    loadLabels().then((loaded) => {
      if (loaded && !cancelled) setLabels(loaded)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Custom pages come from the server layout on first render; refetch
  // only when the viewer changes (login/logout/role or preview switch),
  // and remember the result so remounts on other sections reuse it.
  useEffect(() => {
    // Fresh server data wins; otherwise reuse what an earlier mount fetched.
    if (initialCustomPages.length > 0) {
      customPagesCache.set(pagesKey, initialCustomPages)
      setCustomPages(initialCustomPages)
      return
    }
    const cached = customPagesCache.get(pagesKey)
    if (cached) {
      setCustomPages(cached)
      return
    }
    if (!user) return
    let cancelled = false
    fetch('/api/custom-pages?menu=true')
      .then((response) => (response.ok ? response.json() : []))
      .then((pages) => {
        const list = Array.isArray(pages) ? (pages as CustomPage[]) : []
        customPagesCache.set(pagesKey, list)
        if (!cancelled) setCustomPages(list)
      })
      .catch((error) => console.error('Error loading custom pages:', error))
    return () => {
      cancelled = true
    }
    // initialCustomPages is server data for this mount; pagesKey is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagesKey])

  // Close the mobile menu after navigating.
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  const initials = user?.fullName
    ? user.fullName
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '?'

  const navLinkClass = (active: boolean) =>
    cn(
      'relative inline-flex h-9 items-center rounded-md px-3 text-sm font-medium transition-colors',
      active
        ? 'text-foreground after:absolute after:inset-x-3 after:-bottom-[13px] after:h-0.5 after:rounded-full after:bg-primary'
        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
    )

  const mobileLinkClass = (active: boolean) =>
    cn(
      'flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
      active ? 'bg-primary-soft text-primary' : 'text-foreground hover:bg-accent',
    )

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto grid h-16 max-w-7xl grid-cols-[1fr_auto] items-center gap-4 px-4 sm:px-6 lg:grid-cols-[1fr_auto_1fr]">
        {/* Brand */}
        <Link href="/dashboard" className="flex shrink-0 items-center gap-3 justify-self-start">
          <Image
            src="/aai-mark.png"
            alt="Abigail Adams Institute"
            width={240}
            height={144}
            className="h-8 w-auto"
            priority
          />
          <span className="hidden border-l border-border pl-3 leading-tight sm:block">
            <span className="block font-display text-[15px] font-semibold text-foreground">
              Wisdom at Work
            </span>
            <span className="block text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Fellows Portal
            </span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav aria-label="Primary" className="hidden items-center justify-center gap-1 lg:flex">
          {navItems.map((item) => {
            const active = isActive(pathname, item.match)
            return (
              <Link
                key={item.key}
                href={item.href}
                className={navLinkClass(active)}
                aria-current={active ? 'page' : undefined}
              >
                {labels[item.key]}
              </Link>
            )
          })}

          {customPages.map((page) => {
            const href = `/pages/${page.slug}`
            const active = isActive(pathname, [href])
            return (
              <Link
                key={page.id}
                href={href}
                className={navLinkClass(active)}
                aria-current={active ? 'page' : undefined}
              >
                {page.title}
              </Link>
            )
          })}
        </nav>

        {/* Right cluster */}
        <div className="flex items-center justify-end gap-1.5 justify-self-end">
          {isAdmin && (
            <div className="hidden items-center gap-1 lg:flex">
              <Link
                href="/admin"
                className={cn(navLinkClass(isActive(pathname, ['/admin'])), 'gap-1.5')}
              >
                <Shield className="h-4 w-4" />
                Admin
              </Link>
              <PreviewCohortMenu />
              <span className="mx-1.5 h-5 w-px bg-border" aria-hidden />
            </div>
          )}

          {user ? <NotificationsBell /> : null}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="rounded-full ring-offset-2 ring-offset-background transition hover:ring-2 hover:ring-border"
                aria-label="User menu"
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <div className="px-2 py-2">
                <p className="truncate text-sm font-semibold text-foreground">
                  {user?.fullName ?? 'Signed out'}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {user ? (
                    <>
                      {roleLabels[user.role]}
                      {user.schoolName ? ` · ${user.schoolName}` : ''}
                    </>
                  ) : (
                    'No active session'
                  )}
                </p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profile" className="cursor-pointer">
                  <UserIcon />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings" className="cursor-pointer">
                  <Settings />
                  Settings
                </Link>
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem asChild>
                  <Link href="/admin" className="cursor-pointer">
                    <Shield />
                    Admin console
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={(e) => {
                  e.preventDefault()
                  handleSignOut()
                }}
                className="cursor-pointer"
              >
                <LogOut />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mobile nav */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 gap-0 p-0">
              <SheetHeader className="border-b border-border">
                <SheetTitle className="font-display text-base">Wisdom at Work</SheetTitle>
              </SheetHeader>
              <nav aria-label="Mobile" className="flex flex-col gap-0.5 p-3">
                {navItems.map((item) => (
                  <Link key={item.key} href={item.href} className={mobileLinkClass(isActive(pathname, item.match))}>
                    {labels[item.key]}
                  </Link>
                ))}
                {customPages.map((page) => (
                  <Link
                    key={page.id}
                    href={`/pages/${page.slug}`}
                    className={mobileLinkClass(isActive(pathname, [`/pages/${page.slug}`]))}
                  >
                    {page.title}
                  </Link>
                ))}
                {isAdmin && (
                  <>
                    <div className="my-2 h-px bg-border" />
                    <Link href="/admin" className={mobileLinkClass(isActive(pathname, ['/admin']))}>
                      <Shield className="h-4 w-4" />
                      Admin console
                    </Link>
                  </>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
