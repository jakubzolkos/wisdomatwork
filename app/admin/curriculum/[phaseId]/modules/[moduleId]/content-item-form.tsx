'use client'

import { useId, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CohortAccessField } from '@/components/admin/cohort-access-field'
import { StoredFileField } from '@/components/admin/stored-file-field'
import { isStoredFileUrl } from '@/lib/stored-files'
import {
  CONTENT_CATEGORIES,
  RESOURCE_TYPES,
  type ContentCategory,
  type ResourceType,
} from '@/lib/curriculum'
import { createContent, updateContent } from '../../../actions'

export interface ContentItemDraft {
  id?: string
  category: ContentCategory
  resource_type: ResourceType
  title: string
  description: string
  body: string
  url: string
  /** Uploaded PDF's key in the course-files bucket; null for a link. */
  file_path: string | null
  /** Optional estimated duration in minutes; null when not set. */
  duration_minutes: number | null
  /**
   * Per-item reflection gate. When enabled the fellow must submit a
   * response to `reflection_prompt` before they can mark the item
   * complete.
   */
  reflection_enabled: boolean
  reflection_prompt: string | null
  /**
   * Wall-clock start time for live-session items, ISO 8601 (UTC).
   * NULL for non-live items, or live items the admin has not yet
   * scheduled. Combined with `duration_minutes` to compute the
   * end of the session for the live-session status block.
   */
  scheduled_at: string | null
  /**
   * `null`  -> inherit from the module
   * `[]`    -> locked (no fellows)
   * `[...]` -> override with this exact list
   */
  cohorts: string[] | null
}

/**
 * Convert an ISO 8601 timestamp into the local-time string the
 * `datetime-local` HTML input expects (`YYYY-MM-DDTHH:MM`). Returns
 * an empty string when no value is set so the input renders blank.
 *
 * The browser's `<input type="datetime-local">` shows and accepts
 * naive local time only - no timezone suffix - so we have to peel
 * the timezone off the stored ISO value and re-render in whichever
 * tz the admin's browser is currently in. This means an admin in
 * one timezone will see the same wall-clock value an admin in a
 * different timezone scheduled it as, only converted; that's the
 * conventional behaviour for browser datetime pickers and matches
 * how Google Calendar / Zoom present session times.
 */
function isoToLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  )
}

interface Props {
  phaseId: string
  moduleId: string
  /** Raw module override; used for the inheritance hint in the form. */
  moduleCohorts: string[] | null
  /** Resolved list a content item inherits when its own override is null. */
  moduleEffectiveCohorts: string[]
  /** When supplied this is an edit; when omitted it's a fresh create. */
  initial?: ContentItemDraft
  /** Pre-fill category for the create flow. */
  defaultCategory?: ContentCategory
  onSaved?: () => void
}

export function ContentItemForm({
  phaseId,
  moduleId,
  moduleCohorts,
  moduleEffectiveCohorts,
  initial,
  defaultCategory,
  onSaved,
}: Props) {
  const router = useRouter()
  const isEdit = !!initial?.id
  const titleId = useId()
  const descId = useId()
  const bodyId = useId()
  const urlId = useId()
  const durationId = useId()
  const reflectionToggleId = useId()
  const reflectionPromptId = useId()

  const [category, setCategory] = useState<ContentCategory>(
    initial?.category ?? defaultCategory ?? CONTENT_CATEGORIES[0].value,
  )
  const [resourceType, setResourceType] = useState<ResourceType>(
    initial?.resource_type ?? 'reading',
  )
  const [reflectionEnabled, setReflectionEnabled] = useState<boolean>(
    initial?.reflection_enabled ?? false,
  )
  // Local-time string for the live-session datetime picker. Stored
  // separately from the ISO value because <input type="datetime-local">
  // shows and submits naive local time. We convert to UTC ISO at
  // submit time below.
  const [scheduledLocal, setScheduledLocal] = useState<string>(() =>
    isoToLocalInput(initial?.scheduled_at ?? null),
  )
  // Default new items to "inherit"; for edits, use whatever the row stored.
  const [inherit, setInherit] = useState<boolean>(
    initial ? initial.cohorts === null : true,
  )
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const scheduledAtId = useId()
  // Where the item's resource comes from: an uploaded PDF or a link.
  // Live sessions always use a link (the join URL).
  const [source, setSource] = useState<'link' | 'file'>(initial?.file_path ? 'file' : 'link')
  const usesFile = source === 'file' && resourceType !== 'live_session'

  function onSubmit(formData: FormData) {
    setError(null)
    formData.set('phase_id', phaseId)
    formData.set('module_id', moduleId)
    formData.set('category', category)
    formData.set('resource_type', resourceType)
    if (reflectionEnabled) formData.set('reflection_enabled', 'on')
    if (inherit) formData.set('cohorts_inherit', 'on')
    if (isEdit) formData.set('id', initial!.id!)
    // A file item's link is generated server-side from its id; a link
    // item carries no file. The hidden file_path input only exists
    // while the file picker is shown.
    if (usesFile) formData.set('url', '')
    else formData.delete('file_path')

    // Live sessions: convert the naive local datetime the admin
    // typed into a UTC ISO string the server can persist. We do
    // the conversion here (client-side) because only the browser
    // knows the admin's local timezone. An empty string clears
    // any existing schedule. Non-live resource types submit no
    // schedule at all; the server interprets that as NULL.
    if (resourceType === 'live_session') {
      if (scheduledLocal.trim().length > 0) {
        const parsed = new Date(scheduledLocal)
        if (!Number.isNaN(parsed.getTime())) {
          formData.set('scheduled_at', parsed.toISOString())
        } else {
          formData.set('scheduled_at', '')
        }
      } else {
        formData.set('scheduled_at', '')
      }
    } else {
      formData.set('scheduled_at', '')
    }

    startTransition(async () => {
      const res = isEdit
        ? await updateContent(formData)
        : await createContent(formData)
      if (!res.ok) {
        setError(res.message)
        return
      }
      onSaved?.()
      router.refresh()
    })
  }

  // Used purely for the inheritance hint - whether the parent module
  // has any cohort access at all.
  const inheritIsEmpty = moduleEffectiveCohorts.length === 0
  const moduleOverridden = moduleCohorts !== null

  return (
    <form action={onSubmit} className="flex flex-col gap-5">
      {/* Category and Resource type are both editable. Changing the
          category on save moves the item into a different lab bucket
          (Before / During / After) and re-indexes it at the tail of
          the destination bucket; that's handled server-side in
          updateContent. */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Category</Label>
          <Select
            value={category}
            onValueChange={(v) => setCategory(v as ContentCategory)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONTENT_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Resource type</Label>
          <Select
            value={resourceType}
            onValueChange={(v) => setResourceType(v as ResourceType)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RESOURCE_TYPES.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={titleId}>Title</Label>
        <Input
          id={titleId}
          name="title"
          required
          autoFocus
          defaultValue={initial?.title ?? ''}
          placeholder="e.g. Pre-reading: Foundations of Wisdom"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={descId}>Short description (optional)</Label>
        <Textarea
          id={descId}
          name="description"
          rows={2}
          defaultValue={initial?.description ?? ''}
          placeholder="One or two lines that introduce this content."
        />
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_140px]">
        <div className="space-y-2">
          {resourceType !== 'live_session' && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label htmlFor={usesFile ? undefined : urlId}>
                {usesFile ? 'File' : 'Link / URL (optional)'}
              </Label>
              <div
                role="group"
                aria-label="Resource source"
                className="inline-flex rounded-md border border-border p-0.5 text-xs"
              >
                {(['link', 'file'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={source === s}
                    onClick={() => setSource(s)}
                    className={
                      source === s
                        ? 'rounded-sm bg-muted px-2.5 py-1 font-medium text-foreground'
                        : 'rounded-sm px-2.5 py-1 text-muted-foreground hover:text-foreground'
                    }
                  >
                    {s === 'link' ? 'Link' : 'Upload PDF'}
                  </button>
                ))}
              </div>
            </div>
          )}
          {resourceType === 'live_session' && (
            <Label htmlFor={urlId}>Join link (required)</Label>
          )}
          {usesFile ? (
            <>
              <StoredFileField
                name="file_path"
                initialPath={initial?.file_path ?? null}
                folder={`labs/${moduleId}`}
              />
              <p className="text-xs text-muted-foreground">
                Fellows open it in the portal's viewer; only fellows who can see this item can open the file.
              </p>
            </>
          ) : (
            <>
              <Input
                id={urlId}
                name="url"
                type="url"
                inputMode="url"
                // The server still does the authoritative check, but
                // surfacing required-ness in the UI gives admins instant
                // feedback for live sessions.
                required={resourceType === 'live_session'}
                // An in-app file path isn't a URL the browser accepts;
                // switching a file item to a link starts blank.
                defaultValue={initial?.url && !isStoredFileUrl(initial.url) ? initial.url : ''}
                placeholder={
                  resourceType === 'live_session'
                    ? 'https://zoom.us/j/... or https://meet.google.com/...'
                    : 'https://...'
                }
              />
              <p className="text-xs text-muted-foreground">
                {resourceType === 'live_session'
                  ? 'Paste the Zoom, Google Meet, or other meeting URL fellows will use to join.'
                  : 'Use for videos, slide decks, surveys, or any link-based resource.'}
              </p>
            </>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor={durationId}>Duration (min)</Label>
          <Input
            id={durationId}
            name="duration_minutes"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            defaultValue={
              initial?.duration_minutes != null
                ? String(initial.duration_minutes)
                : ''
            }
            placeholder="e.g. 55"
          />
          <p className="text-xs text-muted-foreground">
            Shown to fellows in the curriculum tree.
          </p>
        </div>
      </div>

      {/* Live-session schedule. Only relevant when the resource type
          is a live session - we hide it everywhere else so the form
          stays focused. The duration field above doubles as the
          session length, so we don't ask for "end time" separately. */}
      {resourceType === 'live_session' && (
        <div className="space-y-2 rounded-lg bg-muted/60 p-4">
          <Label htmlFor={scheduledAtId}>Session date &amp; time</Label>
          <Input
            id={scheduledAtId}
            type="datetime-local"
            // Step in 5-minute increments - finer granularity is
            // rarely useful for a session start time.
            step={300}
            value={scheduledLocal}
            onChange={(e) => setScheduledLocal(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            When the session starts in your local timezone. Fellows
            will see a live countdown to this time, the join button
            unlocks shortly before the session begins, and the item
            auto-completes once the session has ended (start time +
            duration). Leave blank to keep the legacy &ldquo;Join
            now&rdquo; behaviour with no countdown.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor={bodyId}>Body (optional)</Label>
        <Textarea
          id={bodyId}
          name="body"
          rows={8}
          defaultValue={initial?.body ?? ''}
          placeholder="Plain-text body shown directly on the content page. Use this for prompts, instructions, or short readings."
        />
      </div>

      {/* Reflection gate. Toggle controls whether fellows must
          submit a written reflection before they can mark the item
          complete. The prompt textarea is required when the toggle
          is on - both the form and the server action enforce that. */}
      <div className="space-y-3 rounded-lg bg-muted/60 p-4">
        <label
          htmlFor={reflectionToggleId}
          className="flex items-start gap-2 text-sm"
        >
          <input
            id={reflectionToggleId}
            type="checkbox"
            checked={reflectionEnabled}
            onChange={(e) => setReflectionEnabled(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium text-foreground">
              Require a reflection
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Fellows will see the prompt below on the content page and
              must submit a response before they can mark the item
              complete.
            </span>
          </span>
        </label>
        {reflectionEnabled && (
          <div className="space-y-2 pt-1">
            <Label htmlFor={reflectionPromptId}>Reflection prompt</Label>
            <Textarea
              id={reflectionPromptId}
              name="reflection_prompt"
              rows={3}
              required
              defaultValue={initial?.reflection_prompt ?? ''}
              placeholder="e.g. What surprised you in this lesson? Where did you see your own thinking shift?"
            />
            <p className="text-xs text-muted-foreground">
              Plain text. The fellow&apos;s answer is private to them and
              the program team.
            </p>
          </div>
        )}
      </div>

      <div className="space-y-2 rounded-lg bg-muted/60 p-4">
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={inherit}
            onChange={(e) => setInherit(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium text-foreground">
              Inherit cohort access from this module
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {inheritIsEmpty
                ? `Module is currently unassigned${
                    moduleOverridden ? ' (overridden)' : ''
                  }, so no fellows can see this content.`
                : `Visible to fellows in ${moduleEffectiveCohorts
                    .map((c) => `Cohort ${c}`)
                    .join(', ')}${
                    moduleOverridden ? '' : ' (inherited from the phase)'
                  }.`}
            </span>
          </span>
        </label>
        {!inherit && (
          <div className="pt-2">
            <CohortAccessField
              defaultValue={
                Array.isArray(initial?.cohorts) ? initial!.cohorts! : []
              }
              idPrefix={`content-cohort-${initial?.id ?? 'new'}`}
              label="Override cohort access"
              description="Tick the cohorts that should see this content. Leaving all unchecked hides this item from every fellow even if they can see the module."
            />
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="flex justify-end pt-1">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving...' : isEdit ? 'Save changes' : 'Add content'}
        </Button>
      </div>
    </form>
  )
}
