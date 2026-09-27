'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  type DirectoryProfile,
  initialsFor,
  roleLabelFor,
} from '@/lib/types/profile'
import { cn } from '@/lib/utils'

interface Props {
  profile: DirectoryProfile
  /**
   * Card surface variant:
   *  - 'compact'  - photo on the left, two-line right column. Used
   *    in the Team grid and the Community Fellow Bios grid.
   *  - 'detailed' - same layout, plus a 2-line bio excerpt and the
   *    school name on its own row. Used by Community when a richer
   *    card is helpful.
   */
  variant?: 'compact' | 'detailed'
  /**
   * Whether to render the "Cohort A/B/C" chip. Cohort labels are
   * program-internal staging metadata - participants don't think of
   * themselves by cohort letter, so we only surface it for admins
   * (passed in by the server based on `user.role === 'admin'`).
   * Defaults to false so accidental omission errs on the side of
   * privacy.
   */
  showCohort?: boolean
  /** Optional click handler - when provided the card becomes a button. */
  onSelect?: (profile: DirectoryProfile) => void
}

/**
 * MemberCard renders a single directory entry. It's used in two
 * places (Team grid and Community Fellow Bios grid) and is the
 * trigger for the modal {@link ProfileView}.
 *
 * Design notes:
 *  - The whole card is one focusable element when interactive, so
 *    keyboard nav matches click affordance.
 *  - Cohort and role badges live on a single chip row beneath the
 *    title to avoid stacking badges vertically.
 *  - Bio excerpt uses `line-clamp-2` so cards stay equal height.
 */
export function MemberCard({
  profile,
  variant = 'compact',
  showCohort = false,
  onSelect,
}: Props) {
  const name = profile.full_name?.trim() || profile.email || 'Unnamed member'
  const initials = initialsFor(profile.full_name, profile.email)
  const interactive = !!onSelect
  const showBio = variant === 'detailed' && !!profile.bio?.trim()

  const Tag = interactive ? 'button' : 'div'

  return (
    <Tag
      type={interactive ? 'button' : undefined}
      onClick={interactive ? () => onSelect?.(profile) : undefined}
      className={cn(
        // Subtle shadow / brand-tinted border on hover instead of
        // the previous accent fill, which painted the card in the
        // brand rose and turned every label hard to read. The
        // background stays card-coloured; only the border + a
        // light shadow signal interactivity.
        'group flex w-full items-start gap-3 rounded-xl border border-border bg-card p-4 text-left shadow-xs transition',
        interactive &&
          'cursor-pointer hover:border-border-strong hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      )}
      aria-label={interactive ? `Open profile for ${name}` : undefined}
    >
      <Avatar className="h-12 w-12 shrink-0">
        {profile.avatar_url ? (
          <AvatarImage src={profile.avatar_url} alt="" />
        ) : null}
        <AvatarFallback className="bg-primary-soft text-sm font-medium text-primary">
          {initials}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground transition-colors group-hover:text-primary">{name}</p>
        {profile.title && (
          <p className="truncate text-xs text-muted-foreground">
            {profile.title}
          </p>
        )}
        {profile.school_name && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {profile.school_name}
          </p>
        )}

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className="text-[11px] font-medium"
>
            {roleLabelFor(profile.role)}
          </Badge>
          {/* Cohort chip is admin-only - see Props.showCohort. */}
          {showCohort && profile.cohort && (
            <Badge variant="outline" className="text-[11px] font-medium"
>
              Cohort {profile.cohort}
            </Badge>
          )}
          {/*
            Community-role chip ("Educator", "Coach", ...) is shown
            when the member set one. We don't gate on showCohort
            because community_role is self-described, not staging
            metadata.
          */}
          {profile.community_role && (
            <Badge variant="outline" className="text-[11px] font-medium"
>
              {profile.community_role}
            </Badge>
          )}
          {/* Years-in-education badge stays compact ("5y") so it
              fits on the same row without forcing the chip wrap. */}
          {typeof profile.years_in_education === 'number' &&
            profile.years_in_education > 0 && (
              <Badge variant="outline" className="text-[11px] font-medium"
>
                {profile.years_in_education}y in ed
              </Badge>
            )}
        </div>

        {showBio && (
          <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
            {profile.bio}
          </p>
        )}

        {/*
          Surface the most useful "what they want / what they offer"
          line on detailed cards so the directory reads as a real
          help-network instead of a static photo grid. We prefer the
          looking_for line because community-flow-wise that's what
          peers can act on; if it's missing we fall back to the
          willing_to_help line.
        */}
        {variant === 'detailed' &&
          (profile.looking_for?.trim() || profile.willing_to_help?.trim()) && (
            <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">
                {profile.looking_for?.trim() ? 'Looking for: ' : 'Can help: '}
              </span>
              {profile.looking_for?.trim() ?? profile.willing_to_help?.trim()}
            </p>
          )}
      </div>
    </Tag>
  )
}
