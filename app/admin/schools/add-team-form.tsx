'use client'

import { useState, useTransition, useId } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Plus, ChevronDown, X } from 'lucide-react'
import { createCohortAction } from './actions'

export function AddTeamForm({
  schoolId,
  defaultName,
}: {
  schoolId: string
  defaultName: string
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(defaultName)
  const [year, setYear] = useState('1')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const nameId = useId()
  const yearId = useId()

  const handle = (fd: FormData) => {
    setError(null)
    startTransition(async () => {
      const res = await createCohortAction(fd)
      if (!res.ok) {
        setError(res.message)
        return
      }
      setName(defaultName)
      setYear('1')
      setOpen(false)
    })
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="text-muted-foreground hover:text-foreground"
      >
        <Plus className="mr-1.5 h-4 w-4" />
        Add new team
      </Button>
    )
  }

  return (
    <form
      action={handle}
      className="flex flex-col gap-4 rounded-lg bg-muted/60 p-4"
    >
      <input type="hidden" name="schoolId" value={schoolId} />
      
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor={nameId} className="text-sm font-medium">
            Team name
          </Label>
          <Input
            id={nameId}
            name="name"
            placeholder="e.g., Leadership Circle, Core Team..."
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Choose a name that reflects your team's purpose or focus area.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={yearId} className="text-sm font-medium">
            Cohort level
          </Label>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger id={yearId} className="text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Cohort A</SelectItem>
              <SelectItem value="2">Cohort B</SelectItem>
              <SelectItem value="3">Cohort C</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Select the cohort level for this team.
          </p>
        </div>
        <input type="hidden" name="currentYear" value={year} />
      </div>

      {error ? (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          {error}
        </div>
      ) : null}

      <div className="flex gap-2">
        <Button 
          type="submit" 
          size="sm" 
          disabled={isPending || !name.trim()}
          className="flex-1 sm:flex-none"
        >
          {isPending ? <Spinner className="mr-1.5 h-3 w-3" /> : null}
          Create team
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setOpen(false)
            setError(null)
            setName(defaultName)
            setYear('1')
          }}
          disabled={isPending}
        >
          <X className="mr-1.5 h-4 w-4" />
          Cancel
        </Button>
      </div>
    </form>
  )
}
