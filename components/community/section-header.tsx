import { PageHeader } from '@/components/page-header'
import { PostComposer } from '@/components/community/post-composer'
import type { CommunitySection } from '@/lib/community/sections'

/**
 * Lightweight serialisable shape for the framework dropdown. Mirrors
 * the FrameworkOption type in lib/community/load-frameworks.ts but
 * is duplicated here to keep this file's import surface small.
 */
interface FrameworkOption {
  id: string
  title: string
}

interface Props {
  section: CommunitySection
  /** Whether the current viewer can compose in this section. */
  canPost: boolean
  /**
   * Optional list of PWF Protocols to surface as a framework picker
   * inside the composer. Forwarded as-is; the composer hides the
   * dropdown when this list is empty / missing.
   */
  frameworks?: FrameworkOption[]
  /**
   * When true, the composer enforces the Ask category picker. Used
   * by the Asks section to make categorisation a hard requirement.
   */
  requireAskCategory?: boolean
  /**
   * When true, the composer requires + surfaces a star rating picker
   * (1-5 stars). Used by the Wins section to capture win valuation.
   */
  requireStarRating?: boolean
  /**
   * When true, the composer requires + surfaces visibility/scope options
   * (public, cohort, school_team). Used by the Wins section.
   */
  requireVisibilitySettings?: boolean
}

/**
 * Header rendered at the top of every Community section page.
 * Keeps the layout consistent: section name, count badge, one-line
 * description, and (when allowed) the "New post" composer trigger.
 */
export function SectionHeader({
  section,
  canPost,
  frameworks,
  requireAskCategory = false,
  requireStarRating = false,
  requireVisibilitySettings = false,
}: Props) {
  return (
    <PageHeader
      className="mb-8"
      eyebrow="Community of Practice"
      title={section.label}
      description={section.description}
      actions={
        section.writeKind ? (
          /*
            Pass primitive fields only - PostComposer is a Client
            Component, and serializing the full section object would
            try to ship `section.icon` (a Lucide React component
            function) across the boundary, which React refuses.
          */
          <PostComposer
            writeKind={section.writeKind}
            description={section.description}
            titlePlaceholder={section.composerTitlePlaceholder}
            bodyPlaceholder={section.composerBodyPlaceholder}
            composerCta={section.composerCta}
            canPost={canPost}
            frameworks={frameworks}
            requireAskCategory={requireAskCategory}
            requireStarRating={requireStarRating}
            requireVisibilitySettings={requireVisibilitySettings}
          />
        ) : undefined
      }
    />
  )
}
