'use client'

import { useId, useMemo, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Spinner } from '@/components/ui/spinner'
import { Search, X } from 'lucide-react'
import {
  createNotification,
  updateNotification,
  type NotificationFormResult,
} from './actions'
import {
  NOTIFICATION_KINDS,
  NOTIFICATION_KIND_LABELS,
  type NotificationKind,
} from '@/lib/notifications/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AudienceScope = 'global' | 'cohort' | 'school_team' | 'users'
export type ScheduleAction = 'send_now' | 'schedule' | 'draft'

export interface NotificationFormInitial {
  id: string | null
  kind: NotificationKind
  audience_scope: AudienceScope
  cohort_codes: string[]
  school_team_ids: string[]
  user_ids: string[]
  title: string
  body: string
  pinned: boolean
  content_id: string | null
  cta_label: string | null
  cta_url: string | null
  email_enabled: boolean
  email_subject: string | null
  scheduled_for: string | null
}

export interface SchoolTeamOption {
  id: string
  name: string
}

export interface FellowOption {
  id: string
  fullName: string
  email: string | null
  cohort: string | null
}

export interface ContentOption {
  id: string
  label: string
  phaseId: string
  phaseTitle: string
}

interface Props {
  mode: 'create' | 'edit'
  initial?: Partial<NotificationFormInitial>
  schoolTeams: SchoolTeamOption[]
  fellows: FellowOption[]
  contentOptions: ContentOption[]
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (next: boolean) => void
}

const DEFAULTS: NotificationFormInitial = {
  id: null,
  kind: 'announcement',
  audience_scope: 'global',
  cohort_codes: [],
  school_team_ids: [],
  user_ids: [],
  title: '',
  body: '',
  pinned: false,
  content_id: null,
  cta_label: null,
  cta_url: null,
  // Default new notifications to "also send by email". Admins can
  // uncheck the box per-notification, but the common case is that a
  // new in-portal notification should also reach inboxes - the
  // previous default of `false` made it easy to miss the toggle and
  // ship a notification with no email at all (which is what
  // happened with notification b4c529f9... on 2026-05-10).
  email_enabled: true,
  email_subject: null,
  scheduled_for: null,
}

const COHORT_CODES = ['A', 'B', 'C'] as const
const NO_CONTENT = '__none__'

/**
 * Convert an ISO timestamp to the `YYYY-MM-DDTHH:mm` value an HTML
 * `datetime-local` input expects (in the user's local timezone).
 */
function isoToLocalInputValue(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NotificationDialog({
  mode,
  initial,
  schoolTeams,
  fellows,
  contentOptions,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: Props) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : uncontrolledOpen
  const setOpen = (next: boolean) => {
    if (!isControlled) setUncontrolledOpen(next)
    onOpenChange?.(next)
  }
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const merged: NotificationFormInitial = { ...DEFAULTS, ...initial }

  const [kind, setKind] = useState<NotificationKind>(merged.kind)
  const [scope, setScope] = useState<AudienceScope>(merged.audience_scope)
  const [cohortCodes, setCohortCodes] = useState<string[]>(merged.cohort_codes)
  const [schoolTeamIds, setSchoolTeamIds] = useState<string[]>(
    merged.school_team_ids,
  )
  const [userIds, setUserIds] = useState<string[]>(merged.user_ids)
  const [contentId, setContentId] = useState<string | null>(merged.content_id)
  const [emailEnabled, setEmailEnabled] = useState<boolean>(merged.email_enabled)
  const [scheduleAction, setScheduleAction] = useState<ScheduleAction>(
    merged.scheduled_for ? 'schedule' : 'send_now',
  )
  const [scheduledFor, setScheduledFor] = useState<string>(
    isoToLocalInputValue(merged.scheduled_for),
  )

  const [schoolQuery, setSchoolQuery] = useState('')
  const [fellowQuery, setFellowQuery] = useState('')

  const titleId = useId()
  const bodyId = useId()
  const contentSelectId = useId()
  const ctaLabelId = useId()
  const ctaUrlId = useId()
  const emailSubjectId = useId()
  const scheduledForId = useId()

  const filteredSchools = useMemo(() => {
    const q = schoolQuery.trim().toLowerCase()
    const list = q
      ? schoolTeams.filter((s) => s.name.toLowerCase().includes(q))
      : schoolTeams
    return [...list].sort((a, b) => a.name.localeCompare(b.name))
  }, [schoolTeams, schoolQuery])

  const filteredFellows = useMemo(() => {
    const q = fellowQuery.trim().toLowerCase()
    const list = q
      ? fellows.filter(
          (f) =>
            f.fullName.toLowerCase().includes(q) ||
            (f.email ?? '').toLowerCase().includes(q),
        )
      : fellows
    return [...list].sort((a, b) => a.fullName.localeCompare(b.fullName))
  }, [fellows, fellowQuery])

  const schoolById = useMemo(
    () => new Map(schoolTeams.map((s) => [s.id, s])),
    [schoolTeams],
  )
  const fellowById = useMemo(
    () => new Map(fellows.map((f) => [f.id, f])),
    [fellows],
  )

  const toggle = (
    list: string[],
    setList: (next: string[]) => void,
    value: string,
  ) => {
    setList(
      list.includes(value) ? list.filter((x) => x !== value) : [...list, value],
    )
  }

  const handleSubmit = (fd: FormData) => {
    setError(null)
    startTransition(async () => {
      try {
        let result: NotificationFormResult
        if (mode === 'edit' && merged.id) {
          fd.set('id', merged.id)
          result = await updateNotification(fd)
        } else {
          result = await createNotification(fd)
        }
        if (!result.ok) {
          setError(result.message)
          return
        }
        setOpen(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save')
      }
    })
  }

  const submitLabel = (() => {
    if (mode === 'edit') return 'Save changes'
    if (scheduleAction === 'draft') return 'Save draft'
    if (scheduleAction === 'schedule') return 'Schedule'
    return 'Send now'
  })()

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) {
          setKind(merged.kind)
          setScope(merged.audience_scope)
          setCohortCodes(merged.cohort_codes)
          setSchoolTeamIds(merged.school_team_ids)
          setUserIds(merged.user_ids)
          setContentId(merged.content_id)
          setEmailEnabled(merged.email_enabled)
          setScheduleAction(merged.scheduled_for ? 'schedule' : 'send_now')
          setScheduledFor(isoToLocalInputValue(merged.scheduled_for))
          setSchoolQuery('')
          setFellowQuery('')
          setError(null)
        }
      }}
    >
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'New notification' : 'Edit notification'}
          </DialogTitle>
          <DialogDescription>
            Notifications appear in the in-portal feed and can optionally be
            emailed to recipients.
          </DialogDescription>
        </DialogHeader>

        <form action={handleSubmit} className="space-y-5">
          {/* Kind */}
          <div className="space-y-2">
            <Label>Type</Label>
            <Select
              name="kind"
              value={kind}
              onValueChange={(v) => setKind(v as NotificationKind)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NOTIFICATION_KINDS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {NOTIFICATION_KIND_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Audience scope */}
          <div className="space-y-2">
            <Label>Audience</Label>
            <Select
              name="audience_scope"
              value={scope}
              onValueChange={(v) => setScope(v as AudienceScope)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="global">Everyone</SelectItem>
                <SelectItem value="cohort">Specific Cohort</SelectItem>
                <SelectItem
                  value="school_team"
                  disabled={schoolTeams.length === 0}
                >
                  Specific School Team
                </SelectItem>
                <SelectItem value="users" disabled={fellows.length === 0}>
                  Specific Fellow
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {scope === 'cohort' && (
            <fieldset className="space-y-2 rounded-lg border border-border p-4">
              <legend className="px-1 text-sm font-medium">
                Cohorts (pick one or more)
              </legend>
              <div className="flex flex-wrap gap-3">
                {COHORT_CODES.map((code) => {
                  const checked = cohortCodes.includes(code)
                  return (
                    <label
                      key={code}
                      className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm cursor-pointer transition-colors hover:bg-accent"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() =>
                          toggle(cohortCodes, setCohortCodes, code)
                        }
                      />
                      Cohort {code}
                    </label>
                  )
                })}
              </div>
              {cohortCodes.map((code) => (
                <input
                  key={code}
                  type="hidden"
                  name="cohort_codes"
                  value={code}
                />
              ))}
            </fieldset>
          )}

          {scope === 'school_team' && (
            <fieldset className="space-y-3 rounded-lg border border-border p-4">
              <legend className="px-1 text-sm font-medium">
                School teams (pick one or more)
              </legend>
              <div className="relative">
                <Search
                  className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  type="search"
                  value={schoolQuery}
                  onChange={(e) => setSchoolQuery(e.target.value)}
                  placeholder="Search school teams..."
                  className="pl-8"
                />
              </div>
              {schoolTeamIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {schoolTeamIds.map((id) => {
                    const s = schoolById.get(id)
                    if (!s) return null
                    return (
                      <Badge
                        key={id}
                        variant="secondary"
                        className="pl-2 pr-1 gap-1"
                      >
                        {s.name}
                        <button
                          type="button"
                          aria-label={`Remove ${s.name}`}
                          className="ml-1 rounded-sm p-0.5 hover:bg-muted"
                          onClick={() =>
                            toggle(schoolTeamIds, setSchoolTeamIds, id)
                          }
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    )
                  })}
                </div>
              )}
              <ScrollArea className="h-48 rounded-md border border-border">
                <ul className="divide-y divide-border">
                  {filteredSchools.length === 0 ? (
                    <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                      No matches
                    </li>
                  ) : (
                    filteredSchools.map((s) => {
                      const checked = schoolTeamIds.includes(s.id)
                      return (
                        <li key={s.id}>
                          <label className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer transition-colors hover:bg-accent">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() =>
                                toggle(schoolTeamIds, setSchoolTeamIds, s.id)
                              }
                            />
                            <span className="truncate">{s.name}</span>
                          </label>
                        </li>
                      )
                    })
                  )}
                </ul>
              </ScrollArea>
              {schoolTeamIds.map((id) => (
                <input
                  key={id}
                  type="hidden"
                  name="school_team_ids"
                  value={id}
                />
              ))}
            </fieldset>
          )}

          {scope === 'users' && (
            <fieldset className="space-y-3 rounded-lg border border-border p-4">
              <legend className="px-1 text-sm font-medium">
                Fellows (filter by name and pick)
              </legend>
              <div className="relative">
                <Search
                  className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  type="search"
                  value={fellowQuery}
                  onChange={(e) => setFellowQuery(e.target.value)}
                  placeholder="Search by name or email..."
                  className="pl-8"
                />
              </div>
              {userIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {userIds.map((id) => {
                    const f = fellowById.get(id)
                    if (!f) return null
                    return (
                      <Badge
                        key={id}
                        variant="secondary"
                        className="pl-2 pr-1 gap-1"
                      >
                        {f.fullName}
                        <button
                          type="button"
                          aria-label={`Remove ${f.fullName}`}
                          className="ml-1 rounded-sm p-0.5 hover:bg-muted"
                          onClick={() => toggle(userIds, setUserIds, id)}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    )
                  })}
                </div>
              )}
              <ScrollArea className="h-56 rounded-md border border-border">
                <ul className="divide-y divide-border">
                  {filteredFellows.length === 0 ? (
                    <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                      No matches
                    </li>
                  ) : (
                    filteredFellows.map((f) => {
                      const checked = userIds.includes(f.id)
                      return (
                        <li key={f.id}>
                          <label className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer transition-colors hover:bg-accent">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() =>
                                toggle(userIds, setUserIds, f.id)
                              }
                            />
                            <span className="flex-1 min-w-0">
                              <span className="block truncate font-medium">
                                {f.fullName}
                              </span>
                              {f.email && (
                                <span className="block truncate text-xs text-muted-foreground">
                                  {f.email}
                                </span>
                              )}
                            </span>
                            {f.cohort && (
                              <Badge variant="outline" className="shrink-0">
                                Cohort {f.cohort}
                              </Badge>
                            )}
                          </label>
                        </li>
                      )
                    })
                  )}
                </ul>
              </ScrollArea>
              {userIds.map((id) => (
                <input key={id} type="hidden" name="user_ids" value={id} />
              ))}
            </fieldset>
          )}

          {/* Title / body */}
          <div className="space-y-2">
            <Label htmlFor={titleId}>Title</Label>
            <Input
              id={titleId}
              name="title"
              defaultValue={merged.title}
              placeholder="e.g. New reading added to Lab 3"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={bodyId}>Message</Label>
            <Textarea
              id={bodyId}
              name="body"
              defaultValue={merged.body}
              placeholder="Share context, links, reminders..."
              rows={6}
              required
            />
          </div>

          {/* Optional CTA */}
          <fieldset className="space-y-3 rounded-lg border border-border p-4">
            <legend className="px-1 text-sm font-medium">
              Call-to-action (optional)
            </legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={ctaLabelId} className="text-xs">
                  Button label
                </Label>
                <Input
                  id={ctaLabelId}
                  name="cta_label"
                  defaultValue={merged.cta_label ?? ''}
                  placeholder="e.g. Open the lab"
                  maxLength={64}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={ctaUrlId} className="text-xs">
                  Link URL
                </Label>
                <Input
                  id={ctaUrlId}
                  name="cta_url"
                  defaultValue={merged.cta_url ?? ''}
                  placeholder="https:// or /path"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Both fields are required together. Leaving them blank hides the
              button.
            </p>
          </fieldset>

          {/* Pin to curriculum item (legacy support) */}
          <div className="space-y-2">
            <Label htmlFor={contentSelectId}>Pin to a curriculum item</Label>
            <Select
              value={contentId ?? NO_CONTENT}
              onValueChange={(v) => setContentId(v === NO_CONTENT ? null : v)}
              disabled={contentOptions.length === 0}
            >
              <SelectTrigger id={contentSelectId}>
                <SelectValue
                  placeholder={
                    contentOptions.length === 0
                      ? 'No curriculum items yet'
                      : 'No pinned content'
                  }
                />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value={NO_CONTENT}>No pinned content</SelectItem>
                {contentOptions.map((opt) => (
                  <SelectItem key={opt.id} value={opt.id}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input
              type="hidden"
              name="content_id"
              value={contentId ?? ''}
              readOnly
            />
          </div>

          {/* Email */}
          <fieldset className="space-y-3 rounded-lg border border-border p-4">
            <legend className="px-1 text-sm font-medium">Email</legend>
            <label className="inline-flex items-start gap-2 text-sm">
              <Checkbox
                checked={emailEnabled}
                onCheckedChange={(v) => setEmailEnabled(Boolean(v))}
                className="mt-0.5"
              />
              <span>
                Also email this notification to recipients
                <span className="block text-xs text-muted-foreground">
                  When checked, an email is sent to each fellow in the audience as
                  soon as the notification is published.
                </span>
              </span>
            </label>
            {/* Always submit email_enabled: when checked it's "on", when unchecked the input is omitted so fd.get() returns null, which becomes false */}
            <input
              type="hidden"
              name="email_enabled"
              value={emailEnabled ? 'on' : 'off'}
            />
            {emailEnabled && (
              <div className="space-y-1.5">
                <Label htmlFor={emailSubjectId} className="text-xs">
                  Email subject (optional)
                </Label>
                <Input
                  id={emailSubjectId}
                  name="email_subject"
                  defaultValue={merged.email_subject ?? ''}
                  placeholder="Defaults to the notification title"
                  maxLength={140}
                />
              </div>
            )}
          </fieldset>

          {/* Pin to top */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="pinned"
              name="pinned"
              defaultChecked={merged.pinned}
              className="h-4 w-4 rounded border-border"
            />
            <Label htmlFor="pinned" className="font-normal">
              Pin to the top of the in-portal feed
            </Label>
          </div>

          {/* Schedule */}
          {mode === 'create' && (
            <fieldset className="space-y-3 rounded-lg border border-border p-4">
              <legend className="px-1 text-sm font-medium">Delivery</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {(
                  [
                    { value: 'send_now', label: 'Send now' },
                    { value: 'schedule', label: 'Schedule' },
                    { value: 'draft', label: 'Save as draft' },
                  ] as const
                ).map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex cursor-pointer items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm ${
                      scheduleAction === opt.value
                        ? 'border-primary/40 bg-primary-soft text-primary'
                        : 'border-border transition-colors hover:bg-accent'
                    }`}
                  >
                    <input
                      type="radio"
                      name="schedule_action"
                      value={opt.value}
                      checked={scheduleAction === opt.value}
                      onChange={() => setScheduleAction(opt.value)}
                      className="sr-only"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
              {scheduleAction === 'schedule' && (
                <div className="space-y-1.5">
                  <Label htmlFor={scheduledForId} className="text-xs">
                    Send at (your local time)
                  </Label>
                  <Input
                    id={scheduledForId}
                    name="scheduled_for"
                    type="datetime-local"
                    value={scheduledFor}
                    onChange={(e) => setScheduledFor(e.target.value)}
                    required
                  />
                </div>
              )}
            </fieldset>
          )}

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Spinner className="mr-2 h-4 w-4" />}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
