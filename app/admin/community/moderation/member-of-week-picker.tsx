'use client'

import { useState, useTransition } from 'react'
import { CheckCircle2, Loader2, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { initialsFor } from '@/lib/types/profile'
import { setMemberOfWeek } from './actions'

interface ProfileOption {
  id: string
  fullName: string | null
  headline: string | null
}

interface CurrentMember {
  id: string
  fullName: string | null
  profileImageUrl: string | null
  headline: string | null
  /** ISO timestamp of the schedule end, exclusive. */
  until: string | null
}

interface Props {
  profiles: ProfileOption[]
  current: CurrentMember | null
}

/**
 * Sentinel for "no member selected" because Radix SelectItem can't
 * hold an empty value.
 */
const UNSET = '__unset__'

/**
 * Defaults the end date to one week from today (in the browser's
 * local timezone), formatted YYYY-MM-DD for `<input type="date">`.
 */
function defaultUntil() {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  return d.toISOString().slice(0, 10)
}

export function MemberOfWeekPicker({ profiles, current }: Props) {
  const [profileId, setProfileId] = useState<string>(current?.id ?? UNSET)
  const [until, setUntil] = useState<string>(() => {
    if (current?.until) return current.until.slice(0, 10)
    return defaultUntil()
  })
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function submit(action: 'save' | 'clear') {
    setError(null)
    setSuccess(null)
    start(async () => {
      const result = await setMemberOfWeek(
        action === 'clear'
          ? { profileId: null, until: null }
          : {
              profileId: profileId === UNSET ? null : profileId,
              until,
            },
      )
      if (!result.ok) {
        setError(result.message ?? 'Could not save')
        return
      }
      setSuccess(
        action === 'clear'
          ? 'Cleared member of the week.'
          : 'Saved member of the week.',
      )
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {current ? (
        <div className="flex items-center gap-3 rounded-lg bg-warning-soft p-3">
          <Avatar className="h-10 w-10">
            <AvatarImage
              src={current.profileImageUrl ?? undefined}
              alt=""
            />
            <AvatarFallback>
              {initialsFor(current.fullName, null)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 text-sm font-medium text-foreground">
              <Sparkles
                className="h-3 w-3 text-warning"
                aria-hidden="true"
              />
              {current.fullName ?? 'Member'}
            </p>
            <p className="text-xs text-muted-foreground">
              Until{' '}
              {current.until
                ? new Date(current.until).toLocaleDateString()
                : 'unknown'}
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="mow-profile"
            className="text-xs font-medium text-foreground"
          >
            Profile
          </label>
          <Select
            value={profileId}
            onValueChange={setProfileId}
            disabled={pending}
          >
            <SelectTrigger id="mow-profile">
              <SelectValue placeholder="Select a member" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNSET}>None</SelectItem>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.fullName ?? '(unnamed)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor="mow-until"
            className="text-xs font-medium text-foreground"
          >
            Until
          </label>
          <Input
            id="mow-until"
            type="date"
            value={until}
            onChange={(e) => setUntil(e.target.value)}
            disabled={pending}
          />
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            onClick={() => submit('save')}
            disabled={pending || profileId === UNSET}
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              'Save'
            )}
          </Button>
          {current && (
            <Button
              type="button"
              variant="outline"
              onClick={() => submit('clear')}
              disabled={pending}
              className="gap-1"
            >
              <X className="h-3 w-3" aria-hidden="true" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p
          className="flex items-center gap-1 text-sm text-success"
          role="status"
        >
          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
          {success}
        </p>
      )}
    </div>
  )
}
