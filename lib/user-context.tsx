'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { UserRole } from './roles'
import type { Cohort } from './cohorts'
import { createClient } from './supabase/client'

export interface CurrentUser {
  id: string
  email: string
  fullName: string
  role: UserRole
  schoolName: string
  schoolTeamId?: string
  profileImageUrl?: string
  bio?: string
  /**
   * High-level cohort label (A / B / C). Used purely for access gating
   * on phases, items, and library resources. Not surfaced to fellows in
   * the UI, only consumed by server-side filtering.
   */
  cohort?: Cohort | null
  /**
   * Set when an admin is using "Preview as fellow" to view the platform
   * from a fellow's perspective. The rest of the app receives a fellow-
   * shaped `CurrentUser` and runs its normal cohort gating, but the
   * presence of this field tells the UI to (a) keep showing a return-
   * to-admin banner, and (b) suppress destructive write actions from
   * the impersonated session.
   */
  preview?: PreviewMeta
}

export interface PreviewMeta {
  mode: 'by_fellow' | 'by_cohort'
  /** Display name of the previewed fellow or cohort (e.g. "Ada Lovelace" or "Cohort A"). */
  label: string
  /** ID of the actual admin running the preview, used by the banner. */
  actualAdminId: string
  actualAdminName: string
}

interface UserContextType {
  user: CurrentUser | null
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export function UserProvider({
  initialUser,
  children,
}: {
  initialUser: CurrentUser | null
  children: React.ReactNode
}) {
  const [user, setUser] = useState<CurrentUser | null>(initialUser)

  // useState only reads initialUser on the first render. Starting or
  // leaving admin preview re-renders the root layout with a different
  // user, so adopt it - otherwise client UI (top bar links, role
  // checks) keeps showing the real admin until a full reload.
  const userKey = (u: CurrentUser | null) =>
    u ? `${u.id}|${u.role}|${u.cohort ?? ''}|${u.preview?.mode ?? ''}|${u.preview?.label ?? ''}` : ''
  const [syncedKey, setSyncedKey] = useState(() => userKey(initialUser))
  if (userKey(initialUser) !== syncedKey) {
    setSyncedKey(userKey(initialUser))
    setUser(initialUser)
  }

  useEffect(() => {
    const supabase = createClient()

    // Set up auth state listener to update user when auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        // User logged out
        setUser(null)
      } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        // User logged in or updated - fetch fresh user data from server
        try {
          const response = await fetch('/api/user', {
            method: 'GET',
            credentials: 'include',
          })

          if (response.ok) {
            const freshUser = await response.json()
            setUser(freshUser)
          } else if (response.status === 401) {
            // Not authenticated
            setUser(null)
          }
        } catch (error) {
          console.error('[v0] Error fetching updated user:', error)
        }
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return (
    <UserContext.Provider value={{ user }}>
      {children}
    </UserContext.Provider>
  )
}

/**
 * Returns the signed-in user. Throws if called outside a UserProvider OR
 * on a page with no authenticated user. Authenticated routes are gated
 * by middleware, so callers on /dashboard, /admin/*, etc. can treat the
 * return value as non-null.
 */
export function useUser() {
  const context = useContext(UserContext)
  if (!context) {
    throw new Error('useUser must be used within UserProvider')
  }
  if (!context.user) {
    throw new Error(
      'useUser called on an unauthenticated page. Gate the route behind middleware or check useMaybeUser() instead.',
    )
  }
  return { user: context.user }
}

/** Safe variant that returns null when there is no signed-in user. */
export function useMaybeUser() {
  const context = useContext(UserContext)
  if (!context) {
    throw new Error('useMaybeUser must be used within UserProvider')
  }
  return { user: context.user }
}
