'use client'

import {
  Globe,
  HandHelping,
  Linkedin,
  Mail,
  Sparkles,
  Twitter,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  type DirectoryProfile,
  initialsFor,
  roleLabelFor,
} from '@/lib/types/profile'

/**
 * Full-profile body. Designed to be rendered inside any container
 * (Dialog, dedicated page, side sheet) - it stops at flex layout
 * and never opens its own portal. The modal wrapper is exported
 * separately as {@link ProfileModal}.
 *
 * Sections, in order:
 *  - Large avatar + name + role/cohort badges
 *  - Title + team (school) row
 *  - Bio paragraph (whitespace-pre-wrap so newlines survive)
 *  - Contact email link, only when present
 */
interface ProfileViewProps {
  profile: DirectoryProfile
  /**
   * Whether to render the "Cohort A/B/C" chip. Mirrors MemberCard
   * - admin-only by default. Server passes the value derived from
   * `user.role === 'admin'` so fellows never see staging metadata.
   */
  showCohort?: boolean
}

export function ProfileView({ profile, showCohort = false }: ProfileViewProps) {
  const name = profile.full_name?.trim() || profile.email || 'Unnamed member'
  const initials = initialsFor(profile.full_name, profile.email)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:items-start sm:gap-5 sm:text-left">
        <Avatar className="h-24 w-24 shrink-0">
          {profile.avatar_url ? (
            <AvatarImage src={profile.avatar_url} alt="" />
          ) : null}
          <AvatarFallback className="bg-primary-soft text-xl font-medium text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <h2 className="text-balance text-2xl text-foreground">
            {name}
          </h2>
          {profile.title && (
            <p className="mt-1 text-sm text-muted-foreground">
              {profile.title}
            </p>
          )}
          {profile.school_name && (
            <p className="text-sm text-muted-foreground">
              {profile.school_name}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 sm:justify-start">
            <Badge variant="secondary" className="text-xs">
              {roleLabelFor(profile.role)}
            </Badge>
            {/* Cohort chip is admin-only - same rule as MemberCard. */}
            {showCohort && profile.cohort && (
              <Badge variant="outline" className="text-xs">
                Cohort {profile.cohort}
              </Badge>
            )}
            {profile.community_role && (
              <Badge variant="outline" className="text-xs">
                {profile.community_role}
              </Badge>
            )}
            {typeof profile.years_in_education === 'number' &&
              profile.years_in_education > 0 && (
                <Badge variant="outline" className="text-xs">
                  {profile.years_in_education} years in education
                </Badge>
              )}
          </div>
        </div>
      </div>

      {profile.bio?.trim() && (
        <section className="flex flex-col gap-2">
          <h3 className="eyebrow">
            About
          </h3>
          <p className="whitespace-pre-wrap text-pretty font-serif text-[15px] leading-relaxed text-foreground">
            {profile.bio}
          </p>
        </section>
      )}

      {/*
        Looking for / willing to help. Rendered side-by-side on
        wider screens so the "want / offer" symmetry is obvious;
        each side hides if the user hasn't filled it in.
      */}
      {(profile.looking_for?.trim() || profile.willing_to_help?.trim()) && (
        <section className="grid gap-3 sm:grid-cols-2">
          {profile.looking_for?.trim() && (
            <div className="flex flex-col gap-1.5 rounded-lg bg-muted/60 p-4">
              <h3 className="eyebrow inline-flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                Looking for
              </h3>
              <p className="whitespace-pre-wrap text-pretty text-sm leading-relaxed text-foreground">
                {profile.looking_for}
              </p>
            </div>
          )}
          {profile.willing_to_help?.trim() && (
            <div className="flex flex-col gap-1.5 rounded-lg bg-muted/60 p-4">
              <h3 className="eyebrow inline-flex items-center gap-1.5">
                <HandHelping className="h-3.5 w-3.5" aria-hidden="true" />
                Can help with
              </h3>
              <p className="whitespace-pre-wrap text-pretty text-sm leading-relaxed text-foreground">
                {profile.willing_to_help}
              </p>
            </div>
          )}
        </section>
      )}

      {/*
        Contact + links combined into one section so the modal
        doesn't sprout four headings for sparsely-filled profiles.
        Each row is independently optional.
      */}
      {(profile.email ||
        profile.linkedin_url ||
        profile.twitter_url ||
        profile.website_url) && (
        <section className="flex flex-col gap-2">
          <h3 className="eyebrow">
            Connect
          </h3>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            {profile.email && (
              <a
                href={`mailto:${profile.email}`}
                className="inline-flex items-center gap-1.5 font-medium text-primary underline-offset-[3px] hover:underline"

              >
                <Mail className="h-4 w-4" aria-hidden="true" />
                {profile.email}
              </a>
            )}
            {profile.linkedin_url && (
              <a
                href={profile.linkedin_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 font-medium text-primary underline-offset-[3px] hover:underline"

              >
                <Linkedin className="h-4 w-4" aria-hidden="true" />
                LinkedIn
              </a>
            )}
            {profile.twitter_url && (
              <a
                href={profile.twitter_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 font-medium text-primary underline-offset-[3px] hover:underline"

              >
                <Twitter className="h-4 w-4" aria-hidden="true" />
                Twitter / X
              </a>
            )}
            {profile.website_url && (
              <a
                href={profile.website_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 font-medium text-primary underline-offset-[3px] hover:underline"

              >
                <Globe className="h-4 w-4" aria-hidden="true" />
                Website
              </a>
            )}
          </div>
        </section>
      )}
    </div>
  )
}

interface ProfileModalProps {
  /** When non-null the modal is open and renders that profile. */
  profile: DirectoryProfile | null
  /** Called when the dialog wants to close - parent clears state. */
  onOpenChange: (open: boolean) => void
  /** Forwarded to ProfileView - admin-only cohort chip. */
  showCohort?: boolean
}

/**
 * Convenience wrapper that pairs ProfileView with a shadcn Dialog.
 * Keeps each call site to a one-liner: pass the currently-selected
 * profile (or null) and a setter that toggles it.
 */
export function ProfileModal({
  profile,
  onOpenChange,
  showCohort = false,
}: ProfileModalProps) {
  return (
    <Dialog open={!!profile} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="sr-only">
          <DialogTitle>
            {profile?.full_name?.trim() || profile?.email || 'Profile'}
          </DialogTitle>
          <DialogDescription>Member profile details</DialogDescription>
        </DialogHeader>
        {profile && (
          <ProfileView profile={profile} showCohort={showCohort} />
        )}
      </DialogContent>
    </Dialog>
  )
}
