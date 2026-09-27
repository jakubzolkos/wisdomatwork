'use client'

import { useState, useTransition } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { MoreHorizontal, Mail, Trash2, UserX, UserCheck } from 'lucide-react'
import { ROLE_LABELS, type Role } from '@/lib/roles'
import { COHORTS, type Cohort } from '@/lib/cohorts'
import {
  deleteUserAction,
  resendInviteAction,
  toggleDeactivateAction,
  updateCohortAction,
  updateCohortLetterAction,
  updateRoleAction,
} from './actions'

type SchoolTeam = { id: string; name: string }

type InvitationStatus =
  | 'pending'
  | 'sent'
  | 'accepted'
  | 'failed'
  | 'expired'
  | 'cancelled'

type UserRowData = {
  id: string
  full_name: string | null
  email: string | null
  title: string | null
  role: Role
  cohort: Cohort | null
  deactivated_at: string | null
  cohort_id: string | null
  cohort_name: string | null
  last_sign_in_at: string | null
  invited_at: string | null
  email_confirmed_at: string | null
  invitation_status: InvitationStatus | null
  invitation_last_sent_at: string | null
}

const NONE_TEAM = '__none__'
const NONE_COHORT = '__none_cohort__'

export function UserRow({ user, cohorts }: { user: UserRowData; cohorts: SchoolTeam[] }) {
  const [pending, startTransition] = useTransition()
  const [toast, setToast] = useState<string | null>(null)
  const [role, setRole] = useState<Role>(user.role)
  const [schoolTeamId, setSchoolTeamId] = useState<string>(user.cohort_id ?? NONE_TEAM)
  const [cohortLetter, setCohortLetter] = useState<string>(user.cohort ?? NONE_COHORT)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleteErr, setDeleteErr] = useState<string | null>(null)

  function run(action: () => Promise<{ ok: boolean; message: string }>) {
    setToast(null)
    startTransition(async () => {
      const res = await action()
      setToast(res.message)
      setTimeout(() => setToast(null), 2500)
    })
  }

  function handleRoleChange(next: string) {
    const nextRole = next as Role
    setRole(nextRole)
    // Promotion off the fellow role implicitly clears the cohort - the
    // server enforces this too via a CHECK constraint, but we mirror the
    // change locally so the UI stays in sync without a refetch.
    if (nextRole !== 'fellow') {
      setCohortLetter(NONE_COHORT)
    }
    const fd = new FormData()
    fd.set('userId', user.id)
    fd.set('role', next)
    run(() => updateRoleAction(fd))
  }

  function handleSchoolTeamChange(next: string) {
    setSchoolTeamId(next)
    const fd = new FormData()
    fd.set('userId', user.id)
    fd.set('cohortId', next === NONE_TEAM ? '' : next)
    run(() => updateCohortAction(fd))
  }

  function handleCohortLetterChange(next: string) {
    setCohortLetter(next)
    const fd = new FormData()
    fd.set('userId', user.id)
    fd.set('cohort', next === NONE_COHORT ? '' : next)
    run(() => updateCohortLetterAction(fd))
  }

  function handleResend() {
    if (!user.email) return
    const fd = new FormData()
    fd.set('email', user.email)
    run(() => resendInviteAction(fd))
  }

  function handleDeactivate(deactivate: boolean) {
    const fd = new FormData()
    fd.set('userId', user.id)
    fd.set('deactivate', String(deactivate))
    run(() => toggleDeactivateAction(fd))
  }

  // Require the admin to retype the email so a permanent delete is
  // never a single mis-click. Falls back to the name if no email on file.
  const deleteMatchToken = (user.email ?? user.full_name ?? '').trim()
  const canConfirmDelete = deleteConfirmText.trim() === deleteMatchToken

  function handleDelete() {
    if (!canConfirmDelete) return
    setDeleteErr(null)
    const fd = new FormData()
    fd.set('userId', user.id)
    startTransition(async () => {
      const res = await deleteUserAction(fd)
      if (res.ok) {
        setDeleteOpen(false)
        setDeleteConfirmText('')
        setToast(res.message)
        setTimeout(() => setToast(null), 2500)
      } else {
        setDeleteErr(res.message)
      }
    })
  }

  const initials = (user.full_name ?? user.email ?? '?')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const isDeactivated = Boolean(user.deactivated_at)
  const isPending = !user.email_confirmed_at && !user.last_sign_in_at

  return (
    <li className="grid grid-cols-12 items-center gap-4 px-4 py-3 transition-colors hover:bg-accent/60">
      <div className="col-span-12 flex items-center gap-3 md:col-span-3">
        <Avatar className="h-9 w-9">
          <AvatarFallback className="bg-primary-soft text-xs font-medium text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-foreground">
              {user.full_name ?? 'Unnamed user'}
            </p>
            {isDeactivated && (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                Deactivated
              </Badge>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          {user.title && (
            <p className="truncate text-xs text-muted-foreground">{user.title}</p>
          )}
        </div>
      </div>

      <div className="col-span-6 md:col-span-2">
        <Select value={role} onValueChange={handleRoleChange} disabled={pending}>
          <SelectTrigger className="h-9">
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
      </div>

      <div className="col-span-6 md:col-span-3">
        <Select
          value={schoolTeamId}
          onValueChange={handleSchoolTeamChange}
          disabled={pending}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="No team" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE_TEAM}>No team</SelectItem>
            {cohorts.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="col-span-6 md:col-span-1">
        {role === 'fellow' ? (
          <Select
            value={cohortLetter}
            onValueChange={handleCohortLetterChange}
            disabled={pending}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_COHORT}>—</SelectItem>
              {COHORTS.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          // Admins and facilitators are not cohort-scoped: they always
          // have full access to every phase, item, and library resource.
          <span
            className="flex h-9 items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground"
            title={`${role === 'admin' ? 'Admins' : 'Facilitators'} have unrestricted access and aren't assigned to a cohort`}
          >
            n/a
          </span>
        )}
      </div>

      <div className="col-span-10 md:col-span-2">
        <StatusBadge
          isDeactivated={isDeactivated}
          isPending={isPending}
          lastSignInAt={user.last_sign_in_at}
          invitationStatus={user.invitation_status}
        />
        {toast && <p className="mt-1 text-xs text-muted-foreground">{toast}</p>}
      </div>

      <div className="col-span-2 flex items-center justify-end md:col-span-1">
        {pending ? (
          <Spinner className="h-4 w-4 text-muted-foreground" />
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={handleResend} disabled={!user.email}>
                <Mail className="h-4 w-4" />
                Resend invite
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {isDeactivated ? (
                <DropdownMenuItem onSelect={() => handleDeactivate(false)}>
                  <UserCheck className="h-4 w-4" />
                  Reactivate
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onSelect={() => handleDeactivate(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <UserX className="h-4 w-4" />
                  Deactivate
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={(e) => {
                  // Keep the dropdown's focus-return from racing the dialog open.
                  e.preventDefault()
                  setDeleteErr(null)
                  setDeleteConfirmText('')
                  setDeleteOpen(true)
                }}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                Delete user
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(v) => {
          setDeleteOpen(v)
          if (!v) {
            setDeleteConfirmText('')
            setDeleteErr(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {user.full_name ?? user.email ?? 'this user'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the account, their profile, school team membership,
              and all progress records. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {deleteMatchToken ? (
            <div className="grid gap-2">
              <Label htmlFor={`confirm-del-${user.id}`}>
                Type <span className="font-mono">{deleteMatchToken}</span> to confirm
              </Label>
              <Input
                id={`confirm-del-${user.id}`}
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                autoComplete="off"
                placeholder={deleteMatchToken}
              />
            </div>
          ) : null}

          {deleteErr && (
            <p role="alert" className="text-sm text-destructive">
              {deleteErr}
            </p>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDelete()
              }}
              disabled={!canConfirmDelete || pending}
              className="bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20"
            >
              {pending && <Spinner className="h-4 w-4" />}
              Delete user
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  )
}

/**
 * Invitation-aware status. Order of precedence:
 *   1. Deactivated wins everything (the user is locked out).
 *   2. The invitations row, if any, drives the activation states:
 *      - sent / pending  -> "Invited"   (waiting for activation)
 *      - failed          -> "Send failed"
 *      - expired         -> "Expired"
 *      - cancelled       -> "Cancelled"
 *      - accepted        -> fall through to the auth-based label
 *        below (so we show "Last seen ..." for active users instead
 *        of a stale "Accepted" forever).
 *   3. Auth-derived fallback: "Invited" if email never confirmed +
 *      never signed in, otherwise last-seen / Active.
 */
function StatusBadge({
  isDeactivated,
  isPending,
  lastSignInAt,
  invitationStatus,
}: {
  isDeactivated: boolean
  isPending: boolean
  lastSignInAt: string | null
  invitationStatus: InvitationStatus | null
}) {
  if (isDeactivated) {
    return (
      <Badge variant="outline" className="text-xs text-muted-foreground">
        Deactivated
      </Badge>
    )
  }

  if (invitationStatus === 'sent' || invitationStatus === 'pending') {
    return (
      <Badge variant="secondary" className="text-xs">
        Invited
      </Badge>
    )
  }
  if (invitationStatus === 'failed') {
    return (
      <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-xs text-destructive">
        Send failed
      </Badge>
    )
  }
  if (invitationStatus === 'expired') {
    return (
      <Badge variant="outline" className="text-xs text-muted-foreground">
        Expired
      </Badge>
    )
  }
  if (invitationStatus === 'cancelled') {
    return (
      <Badge variant="outline" className="text-xs text-muted-foreground">
        Cancelled
      </Badge>
    )
  }

  if (isPending) {
    return (
      <Badge variant="secondary" className="text-xs">
        Invited
      </Badge>
    )
  }
  return (
    <span className="text-xs text-muted-foreground">
      {lastSignInAt
        ? `Last seen ${new Date(lastSignInAt).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          })}`
        : 'Active'}
    </span>
  )
}
