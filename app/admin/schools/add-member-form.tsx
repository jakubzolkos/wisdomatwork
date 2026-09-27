'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Plus, Users } from 'lucide-react'
import { addMemberAction } from './actions'

export interface AvailableFellow {
  id: string
  label: string
}

export function AddMemberForm({
  cohortId,
  fellows,
}: {
  cohortId: string
  fellows: AvailableFellow[]
}) {
  const [profileId, setProfileId] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  if (fellows.length === 0) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Users className="h-4 w-4" />
          <p className="text-sm">All fellows are already assigned to teams.</p>
        </div>
        <p className="text-xs text-muted-foreground ml-6">
          <a href="/admin/users" className="text-primary hover:underline">
            Add more fellows
          </a>
          {' '}to your organization to expand your teams.
        </p>
      </div>
    )
  }

  const handle = () => {
    if (!profileId) return
    setError(null)
    const fd = new FormData()
    fd.set('cohortId', cohortId)
    fd.set('profileId', profileId)
    startTransition(async () => {
      const res = await addMemberAction(fd)
      if (!res.ok) {
        setError(res.message)
        return
      }
      setProfileId('')
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1 min-w-0">
          <label className="text-xs font-medium text-muted-foreground block mb-1.5">
            Add fellow to this team
          </label>
          <Select value={profileId} onValueChange={setProfileId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a fellow..." />
            </SelectTrigger>
            <SelectContent>
              {fellows.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={handle}
          disabled={isPending || !profileId}
          className="w-full sm:w-auto"
        >
          {isPending ? (
            <Spinner className="mr-1 h-3 w-3" />
          ) : (
            <Plus className="mr-1 h-4 w-4" />
          )}
          Add member
        </Button>
      </div>
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
