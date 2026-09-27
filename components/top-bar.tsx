'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Settings, LogOut, User as UserIcon, Shield, Edit2, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useMaybeUser } from '@/lib/user-context'
import { createClient } from '@/lib/supabase/client'
import { roleLabels } from '@/lib/roles'
import { NotificationsBell } from '@/components/notifications/notifications-bell'
import { PreviewCohortMenu } from '@/components/admin/preview-cohort-menu'
import type { CustomPage } from '@/lib/custom-pages/types'

interface TopBarProps {
  customPages?: CustomPage[]
}

export function TopBar({ customPages: initialCustomPages = [] }: TopBarProps) {
  const { user } = useMaybeUser()
  const router = useRouter()
  const [editingLabel, setEditingLabel] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const [labels, setLabels] = useState({
    dashboard: 'Dashboard',
    about: 'About',
    library: 'Library',
    community: 'Community',
  })
  const [customPages, setCustomPages] = useState<CustomPage[]>(initialCustomPages)
  const [isLoading, setIsLoading] = useState(true)

  // Load labels from API on mount
  useEffect(() => {
    const loadLabels = async () => {
      try {
        const response = await fetch('/api/admin/navigation-labels')
        if (response.ok) {
          const data = await response.json()
          setLabels({
            dashboard: data.dashboard || 'Dashboard',
            about: data.about || 'About',
            library: data.library || 'Library',
            community: data.community || 'Community',
          })
        }
      } catch (error) {
        console.error('[v0] Error loading navigation labels:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadLabels()
  }, [])

  // Fetch custom pages when user changes (e.g., after login/logout or role change)
  useEffect(() => {
    const loadCustomPages = async () => {
      try {
        const response = await fetch('/api/custom-pages?menu=true')
        if (response.ok) {
          const pages = await response.json()
          setCustomPages(Array.isArray(pages) ? pages : [])
        }
      } catch (error) {
        console.error('[v0] Error loading custom pages:', error)
      }
    }

    loadCustomPages()
  }, [user?.id, user?.role])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  const handleEditStart = (key: string, currentLabel: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setEditingLabel(key)
    setEditValue(currentLabel)
  }

  const handleEditSave = async (key: string) => {
    if (!editValue.trim()) {
      setEditingLabel(null)
      return
    }

    const newLabels = {
      ...labels,
      [key]: editValue.trim(),
    }

    try {
      const response = await fetch('/api/admin/navigation-labels', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLabels),
      })

      if (response.ok) {
        const data = await response.json()
        setLabels(newLabels)
        console.log('[v0] Navigation labels updated successfully')
      } else {
        console.error('[v0] Failed to save navigation label')
      }
    } catch (error) {
      console.error('[v0] Error saving navigation label:', error)
    }

    setEditingLabel(null)
    setEditValue('')
  }

  const handleEditCancel = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    setEditingLabel(null)
    setEditValue('')
  }

  const initials = user?.fullName
    ? user.fullName
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
    : '?'

  return (
    <header 
      className="sticky top-0 z-50 h-20 border-b border-border flex items-center justify-between px-6 shadow-card"
      style={{ backgroundColor: '#274d80' }}
    >
      {/* Left: Practical Wisdom Project Logo + Portal Name */}
      <Link href="/dashboard" className="flex items-center gap-3">
        <Image 
          src="/pwp-logo.png" 
          alt="Practical Wisdom Project - Abigail Adams Institute" 
          width={140}
          height={90}
          className="h-16 w-auto"
          priority
        />
        <div className="text-lg font-vollkorn font-semibold text-white hidden sm:block">
          WaW Fellows Portal
        </div>
      </Link>

      {/* Center: Horizontal Nav */}
      <nav className="hidden md:flex items-center gap-8">
        <div className="relative group">
          {editingLabel === 'dashboard' ? (
            <div className="flex items-center gap-1">
              <Input
                autoFocus
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="h-8 px-2 text-sm w-24"
              />
              <button
                onClick={() => handleEditSave('dashboard')}
                className="p-1 hover:bg-primary-light rounded"
              >
                <Check className="h-4 w-4 text-green-300" />
              </button>
              <button
                onClick={(e) => handleEditCancel(e)}
                className="p-1 hover:bg-primary-light rounded"
              >
                <X className="h-4 w-4 text-red-300" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1 group/nav">
              <Link
                href="/dashboard"
                className="text-sm font-medium text-white/80 hover:text-white transition-colors"
              >
                {labels.dashboard}
              </Link>
              {user?.role === 'admin' && (
                <button
                  onClick={(e) => handleEditStart('dashboard', labels.dashboard, e)}
                  className="p-0.5 hover:bg-primary-light rounded transition-opacity"
                  title="Edit label"
                >
                  <Edit2 className="h-3 w-3 text-white/60" />
                </button>
              )}
            </div>
          )}
        </div>

        <div className="relative group">
          {editingLabel === 'about' ? (
            <div className="flex items-center gap-1">
              <Input
                autoFocus
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="h-8 px-2 text-sm w-20"
              />
              <button
                onClick={() => handleEditSave('about')}
                className="p-1 hover:bg-primary-light rounded"
              >
                <Check className="h-4 w-4 text-green-300" />
              </button>
              <button
                onClick={(e) => handleEditCancel(e)}
                className="p-1 hover:bg-primary-light rounded"
              >
                <X className="h-4 w-4 text-red-300" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1 group/nav">
              <Link
                href="/about"
                className="text-sm font-medium text-white/80 hover:text-white transition-colors"
              >
                {labels.about}
              </Link>
              {user?.role === 'admin' && (
                <button
                  onClick={(e) => handleEditStart('about', labels.about, e)}
                  className="p-0.5 hover:bg-primary-light rounded transition-opacity"
                  title="Edit label"
                >
                  <Edit2 className="h-3 w-3 text-white/60" />
                </button>
              )}
            </div>
          )}
        </div>

        <div className="relative group">
          {editingLabel === 'library' ? (
            <div className="flex items-center gap-1">
              <Input
                autoFocus
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="h-8 px-2 text-sm w-24"
              />
              <button
                onClick={() => handleEditSave('library')}
                className="p-1 hover:bg-primary-light rounded"
              >
                <Check className="h-4 w-4 text-green-300" />
              </button>
              <button
                onClick={(e) => handleEditCancel(e)}
                className="p-1 hover:bg-primary-light rounded"
              >
                <X className="h-4 w-4 text-red-300" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1 group/nav">
              <Link
                href="/resources"
                className="text-sm font-medium text-white/80 hover:text-white transition-colors"
              >
                {labels.library}
              </Link>
              {user?.role === 'admin' && (
                <button
                  onClick={(e) => handleEditStart('library', labels.library, e)}
                  className="p-0.5 hover:bg-primary-light rounded transition-opacity"
                  title="Edit label"
                >
                  <Edit2 className="h-3 w-3 text-white/60" />
                </button>
              )}
            </div>
          )}
        </div>

        <div className="relative group">
          {editingLabel === 'community' ? (
            <div className="flex items-center gap-1">
              <Input
                autoFocus
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="h-8 px-2 text-sm w-24"
              />
              <button
                onClick={() => handleEditSave('community')}
                className="p-1 hover:bg-primary-light rounded"
              >
                <Check className="h-4 w-4 text-green-300" />
              </button>
              <button
                onClick={(e) => handleEditCancel(e)}
                className="p-1 hover:bg-primary-light rounded"
              >
                <X className="h-4 w-4 text-red-300" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1 group/nav">
              <Link
                href="/community"
                className="text-sm font-medium text-white/80 hover:text-white transition-colors"
              >
                {labels.community}
              </Link>
              {user?.role === 'admin' && (
                <button
                  onClick={(e) => handleEditStart('community', labels.community, e)}
                  className="p-0.5 hover:bg-primary-light rounded transition-opacity"
                  title="Edit label"
                >
                  <Edit2 className="h-3 w-3 text-white/60" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Custom Pages */}
        {customPages.map((page) => (
          <Link
            key={page.id}
            href={`/pages/${page.slug}`}
            className="text-sm font-medium text-white/80 hover:text-white transition-colors"
          >
            {page.title}
          </Link>
        ))}

        {user?.role === 'admin' && (
          <Link
            href="/admin"
            className="text-sm font-medium text-white/80 hover:text-white transition-colors flex items-center gap-1"
          >
            <Shield className="h-4 w-4" />
            Admin
          </Link>
        )}

        {user?.role === 'admin' && <PreviewCohortMenu />}
      </nav>

      {/* Right: notifications bell + user menu. The bell shows an
          unread badge driven by /api/notifications/unread-count and
          links to the full /notifications inbox. */}
      <div className="flex items-center gap-4">
        {user ? <NotificationsBell /> : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-primary-light"
              aria-label="User menu"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary-light text-white font-serif">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium text-text">
                {user?.fullName ?? 'Signed out'}
              </p>
              <p className="text-xs text-text-muted">
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
              <Link
                href="/profile"
                className="flex items-center gap-2 cursor-pointer"
              >
                <UserIcon className="h-4 w-4" />
                <span>Profile</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link
                href="/settings"
                className="flex items-center gap-2 cursor-pointer"
              >
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </Link>
            </DropdownMenuItem>
            {user?.role === 'admin' && (
              <DropdownMenuItem asChild>
                <Link
                  href="/admin"
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Shield className="h-4 w-4" />
                  <span>Admin console</span>
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault()
                handleSignOut()
              }}
              className="flex items-center gap-2 cursor-pointer text-destructive"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
