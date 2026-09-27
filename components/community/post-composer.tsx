'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Spinner } from '@/components/ui/spinner'
import { createCommunityPost } from '@/app/community/actions'
import { ASK_CATEGORIES } from '@/lib/community/ask-categories'

/** Sentinel for "no framework selected" - SelectItem can't have empty value. */
const NO_FRAMEWORK = '__none__'

/** Sentinel for "no category selected" in the ask composer. */
const NO_CATEGORY = '__none__'

interface FrameworkOption {
  id: string
  title: string
}

interface Props {
  /**
   * Only the primitive section fields the composer actually needs.
   * Receiving the full CommunitySection object would force the
   * server-rendered SectionHeader to serialize `section.icon` (a
   * Lucide React component) into this client boundary, which React
   * rejects with "Functions cannot be passed directly to Client
   * Components". Strings + the writable kind are all this dialog
   * uses, so we accept exactly that.
   */
  /** The kind to write into community_posts.kind on submit. */
  writeKind: string
  /** One-liner shown as the dialog description. */
  description: string
  /** Title-input placeholder. */
  titlePlaceholder: string
  /** Body-textarea placeholder. */
  bodyPlaceholder: string
  /** Label on both the trigger button and the submit button. */
  composerCta: string
  /**
   * Whether the current user is allowed to post in this section.
   * Computed server-side from `staffOnly` + role and passed in so
   * fellows simply don't see the trigger for staff-only sections.
   */
  canPost: boolean
  /**
   * PWF Protocol options for the framework dropdown. When provided,
   * the composer renders a select for the fellow to attribute their
   * win to a specific protocol. Empty array hides the dropdown.
   */
  frameworks?: FrameworkOption[]
  /**
   * When true, the composer requires + surfaces an Ask category
   * picker. Used by the Asks composer to enforce categorisation.
   */
  requireAskCategory?: boolean
  /**
   * When true, the composer surfaces a star rating picker (1-5).
   * Used by the Wins composer to capture subjective value rating.
   */
  requireStarRating?: boolean
  /**
   * When true, the composer surfaces visibility/scope options
   * (public, cohort, school_team). Used by the Wins composer to
   * control who can see each win. Only for wins kind.
   */
  requireVisibilitySettings?: boolean
}

/**
 * Composer button + modal for a Community section.
 *
 * Stays client-side because the dialog needs local state and we want
 * optimistic feedback on submit. Submission goes through the
 * `createCommunityPost` server action which validates kind + role
 * and inserts a published row.
 */
export function PostComposer({
  writeKind,
  description,
  titlePlaceholder,
  bodyPlaceholder,
  composerCta,
  canPost,
  frameworks,
  requireAskCategory = false,
  requireStarRating = false,
  requireVisibilitySettings = false,
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [framework, setFramework] = useState<string>(NO_FRAMEWORK)
  const [askCategory, setAskCategory] = useState<string>(NO_CATEGORY)
  const [starRating, setStarRating] = useState<number | null>(null)
  const [visibility, setVisibility] = useState<'public' | 'cohort' | 'school_team'>('public')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  if (!canPost) return null

  const offerFrameworks = (frameworks?.length ?? 0) > 0

  function reset() {
    setTitle('')
    setBody('')
    setFramework(NO_FRAMEWORK)
    setAskCategory(NO_CATEGORY)
    setStarRating(null)
    setVisibility('public')
    setError(null)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    
    // For wins, the framework is required (not using NO_FRAMEWORK sentinel)
    if (requireStarRating) {
      if (!framework) {
        return setError('Select a PWF Protocol.')
      }
    } else {
      // For non-wins, validate the title
      const t = title.trim()
      if (!t) return setError('Add a title.')
    }
    
    const b = body.trim()
    if (!b) return setError('Add some content.')
    if (requireAskCategory && askCategory === NO_CATEGORY) {
      return setError('Pick a category for your question.')
    }
    if (requireStarRating && !starRating) {
      return setError('Rate your win (1-5 stars).')
    }

    startTransition(async () => {
      const result = await createCommunityPost({
        kind: writeKind,
        // For wins, use body as title (no separate title field); for other posts, use title
        title: requireStarRating ? body.trim().split('\n')[0] : title.trim(),
        body: b,
        frameworkResourceId:
          framework === NO_FRAMEWORK ? null : framework,
        askCategory:
          askCategory === NO_CATEGORY ? null : askCategory,
        starRating: requireStarRating ? starRating : null,
        visibility: requireVisibilitySettings ? visibility : undefined,
      })
      if (!result.ok) {
        setError(result.message)
        return
      }
      reset()
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus aria-hidden="true" />
          {composerCta}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{composerCta}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {requireStarRating ? (
            // Wins composer: framework dropdown instead of title input
            <div className="flex flex-col gap-2">
              <Label htmlFor="composer-framework">
                Which of the Practical Wisdom Framework (PWF)™ would you like to share a win about?
              </Label>
              <Select
                value={framework}
                onValueChange={setFramework}
                disabled={pending}
              >
                <SelectTrigger id="composer-framework">
                  <SelectValue placeholder="Select a PWF Protocol" />
                </SelectTrigger>
                <SelectContent>
                  {frameworks && frameworks.length > 0 ? (
                    frameworks.map((fw) => (
                      <SelectItem key={fw.id} value={fw.id}>
                        {fw.title}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="_empty" disabled>
                      No PWF Protocols available
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          ) : (
            // Standard title input for non-wins
            <div className="flex flex-col gap-2">
              <Label htmlFor="composer-title">Title</Label>
              <Input
                id="composer-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={titlePlaceholder}
                maxLength={200}
                autoFocus
                disabled={pending}
              />
            </div>
          )}

          {requireAskCategory && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="composer-ask-category">Category</Label>
              <Select
                value={askCategory}
                onValueChange={setAskCategory}
                disabled={pending}
              >
                <SelectTrigger id="composer-ask-category">
                  <SelectValue placeholder="Pick a category" />
                </SelectTrigger>
                <SelectContent>
                  {ASK_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Categories help peers and program staff route your
                question to the right people.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="composer-body">
              {requireStarRating ? 'Tell us more:' : 'Content'}
            </Label>
            <Textarea
              id="composer-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={requireStarRating ? '' : bodyPlaceholder}
              rows={7}
              maxLength={10_000}
              disabled={pending}
            />
            {!requireStarRating && (
              <p className="text-xs text-muted-foreground">
                {body.length.toLocaleString()}/10,000 characters
                {' · '}
                Tip: use #hashtags to make your post easier to find.
              </p>
            )}
          </div>

          {offerFrameworks && !requireStarRating && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="composer-framework">
                PWF Protocol used (optional)
              </Label>
              <Select
                value={framework}
                onValueChange={setFramework}
                disabled={pending}
              >
                <SelectTrigger id="composer-framework">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_FRAMEWORK}>None</SelectItem>
                  {frameworks!.map((fw) => (
                    <SelectItem key={fw.id} value={fw.id}>
                      {fw.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Tag the protocol you used so other fellows can learn
                from your example.
              </p>
            </div>
          )}

          {requireStarRating && (
            <div className="flex flex-col gap-2">
              <Label>What's your star rating for this protocol?</Label>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    type="button"
                    onClick={() => setStarRating(rating)}
                    disabled={pending}
                    className="rounded-md p-0.5 text-muted-foreground transition-colors hover:text-warning"
                  >
                    <Star
                      className={[
                        'size-6',
                        starRating && rating <= starRating
                          ? 'fill-warning text-warning'
                          : '',
                      ].join(' ')}
                      aria-hidden="true"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {requireVisibilitySettings && (
            <div className="flex flex-col gap-2 border-t pt-5">
              <Label htmlFor="visibility-select">Who can see this win?</Label>
              <Select
                value={visibility}
                onValueChange={(v) => setVisibility(v as 'public' | 'cohort' | 'school_team')}
                disabled={pending}
              >
                <SelectTrigger id="visibility-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="school_team">
                    Visible to my school team only
                  </SelectItem>
                  <SelectItem value="cohort">
                    All fellows in my cohort
                  </SelectItem>
                  <SelectItem value="public">
                    All fellows
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Choose who can see this win in the community.
              </p>
            </div>
          )}

          {error && (
            <p
              role="alert"
              className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={pending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending && <Spinner className="size-3.5" />}
              {composerCta}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
