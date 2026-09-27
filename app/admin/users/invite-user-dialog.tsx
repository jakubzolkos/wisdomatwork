'use client'

import { useState, useTransition } from 'react'
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
import { Field, FieldGroup, FieldLabel, FieldDescription } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { UserPlus } from 'lucide-react'
import { inviteUserAction } from './actions'
import { ROLE_LABELS, type Role } from '@/lib/roles'
import { COHORTS } from '@/lib/cohorts'

type Props = {
  cohorts: { id: string; name: string }[]
}

const NONE_TEAM = '__none__'
const NONE_COHORT = '__none_cohort__'

export function InviteUserDialog({ cohorts }: Props) {
  const [open, setOpen] = useState(false)
  const [role, setRole] = useState<Role>('fellow')
  const [schoolTeamId, setSchoolTeamId] = useState<string>(NONE_TEAM)
  const [cohortLetter, setCohortLetter] = useState<string>(NONE_COHORT)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

  // Cohort labels (A/B/C) only apply to fellows. Admins and facilitators
  // have unrestricted access to every phase, item, and resource and are
  // never bound to a cohort - so we hide the field for non-fellow roles
  // and never submit a value with the form.
  const isFellow = role === 'fellow'

  function onSubmit(formData: FormData) {
    setMessage(null)
    formData.set('role', role)
    formData.set('cohortId', schoolTeamId === NONE_TEAM ? '' : schoolTeamId)
    formData.set(
      'cohortLetter',
      isFellow && cohortLetter !== NONE_COHORT ? cohortLetter : '',
    )
    startTransition(async () => {
      const result = await inviteUserAction(formData)
      if (result.ok) {
        setMessage({ type: 'ok', text: result.message })
        setTimeout(() => {
          setOpen(false)
          setMessage(null)
        }, 1200)
      } else {
        setMessage({ type: 'err', text: result.message })
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) {
          setMessage(null)
          setRole('fellow')
          setSchoolTeamId(NONE_TEAM)
          setCohortLetter(NONE_COHORT)
        }
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="h-4 w-4" />
          Invite user
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite a new user</DialogTitle>
          <DialogDescription>
            They&apos;ll receive an email with a link to set their password and join the program.
          </DialogDescription>
        </DialogHeader>

        <form action={onSubmit}>
          <FieldGroup>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="firstName">First Name</FieldLabel>
                <Input id="firstName" name="firstName" required autoComplete="off" />
              </Field>
              <Field>
                <FieldLabel htmlFor="lastName">Last Name</FieldLabel>
                <Input id="lastName" name="lastName" required autoComplete="off" />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="email">Email Address</FieldLabel>
              <Input id="email" name="email" type="email" required autoComplete="off" />
            </Field>
            <Field>
              <FieldLabel htmlFor="title">Title (optional)</FieldLabel>
              <Input
                id="title"
                name="title"
                placeholder="e.g. Assistant Principal"
                autoComplete="off"
              />
            </Field>
            <Field>
              <FieldLabel>Role</FieldLabel>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>
                Fellows participate in the program. Facilitators lead cohorts. Admins manage the
                whole program.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel>School Name (optional)</FieldLabel>
              <Select value={schoolTeamId} onValueChange={setSchoolTeamId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_TEAM}>No school</SelectItem>
                  {cohorts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>
                The school team the fellow is part of. Used for grouping and team-level reporting.
              </FieldDescription>
            </Field>
            {isFellow ? (
              <Field>
                <FieldLabel>Cohort (optional)</FieldLabel>
                <Select value={cohortLetter} onValueChange={setCohortLetter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_COHORT}>No cohort</SelectItem>
                    {COHORTS.map((c) => (
                      <SelectItem key={c} value={c}>
                        Cohort {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription>
                  Cohorts (A, B, C) gate which curriculum phases and library resources
                  the fellow can see. Fellows only access content assigned to their
                  cohort.
                </FieldDescription>
              </Field>
            ) : (
              <Field>
                <FieldLabel>Cohort</FieldLabel>
                <p className="text-sm text-muted-foreground">
                  {role === 'admin' ? 'Admins' : 'Facilitators'} are not assigned to a
                  cohort and have access to all curriculum and library content.
                </p>
              </Field>
            )}

            {message && (
              <p
                className={
                  message.type === 'ok'
                    ? 'text-sm text-success'
                    : 'text-sm text-destructive'
                }
                role="status"
              >
                {message.text}
              </p>
            )}
          </FieldGroup>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Spinner className="h-4 w-4" />}
              Send invite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
