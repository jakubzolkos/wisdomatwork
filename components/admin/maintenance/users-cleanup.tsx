'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  AlertCircle,
  Trash2,
  Archive,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface User {
  id: string
  name: string
  email: string
  role: string
  cohort: string | null
  school: string | null
  deactivated: boolean
  postsCount: number
  reflectionsCount: number
  commentsCount: number
  relatedContentCount: number
}

export function UsersCleanupSection() {
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())
  const [actionInProgress, setActionInProgress] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; userId?: string; action?: string; user?: User }>({ open: false })
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)

  useEffect(() => {
    fetchUsers()
  }, [page, roleFilter, statusFilter, search])

  const fetchUsers = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        ...(roleFilter && { role: roleFilter }),
        ...(statusFilter && { status: statusFilter }),
        ...(search && { search }),
      })

      const response = await fetch(`/api/admin/maintenance/users?${params}`)
      if (!response.ok) {
        throw new Error('Failed to load users')
      }
      const data = await response.json()
      setUsers(data.users || [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load users'
      console.error('[v0] Error fetching users:', message)
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectUser = (userId: string) => {
    const newSelected = new Set(selectedUsers)
    if (newSelected.has(userId)) {
      newSelected.delete(userId)
    } else {
      newSelected.add(userId)
    }
    setSelectedUsers(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedUsers.size === users.length) {
      setSelectedUsers(new Set())
    } else {
      setSelectedUsers(new Set(users.map((u) => u.id)))
    }
  }

  const handleArchiveUser = async (userId: string) => {
    setActionInProgress(true)
    try {
      const response = await fetch('/api/admin/maintenance/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action: 'archive' }),
      })

      if (response.ok) {
        const result = await response.json()
        setUsers(users.filter((u) => u.id !== userId))
        setActionSuccess(result.message || 'User archived successfully')
        setConfirmDialog({ open: false })
        setTimeout(() => setActionSuccess(null), 3000)
      } else {
        const err = await response.json()
        setError(err.error || 'Failed to archive user')
      }
    } catch (error) {
      console.error('[v0] Error archiving user:', error)
      setError(error instanceof Error ? error.message : 'Failed to archive user')
    } finally {
      setActionInProgress(false)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    setActionInProgress(true)
    try {
      const response = await fetch('/api/admin/maintenance/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action: 'delete' }),
      })

      if (!response.ok) {
        const error = await response.json()
        if (error.hasContent) {
          setConfirmDialog({
            open: true,
            userId,
            action: 'delete_warning',
            user: users.find((u) => u.id === userId),
          })
          return
        }
      } else {
        setUsers(users.filter((u) => u.id !== userId))
        setConfirmDialog({ open: false })
      }
    } catch (error) {
      console.error('[v0] Error deleting user:', error)
    } finally {
      setActionInProgress(false)
    }
  }

  const testUsers = users.filter((u) => u.email?.includes('@test'))
  const neverLoggedIn = users.filter((u) => u.deactivated)

  return (
    <div className="space-y-6">
      <div>
        <h2>Users & Invitations</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          View and manage user accounts, pending invitations, and test users
        </p>
      </div>

      {testUsers.length > 0 && (
        <Alert className="bg-warning-soft border-warning/30">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertDescription className="text-warning">
            {testUsers.length} test user{testUsers.length !== 1 ? 's' : ''} found ({testUsers
              .map((u) => u.email)
              .join(', ')}
            )
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {actionSuccess && (
        <Alert className="bg-success-soft border-success/30">
          <AlertDescription className="text-success">{actionSuccess}</AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Input
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
        />
        <Select 
          value={roleFilter || 'all'} 
          onValueChange={(v) => {
            setRoleFilter(v === 'all' ? '' : v)
            setPage(1)
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Filter by role..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="fellow">Fellow</SelectItem>
            <SelectItem value="facilitator">Facilitator</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>

        <Select 
          value={statusFilter || 'all'} 
          onValueChange={(v) => {
            setStatusFilter(v === 'all' ? '' : v)
            setPage(1)
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Filter by status..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Users</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="deactivated">Deactivated</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Users Table */}
      <Card className="gap-0 overflow-hidden pb-0">
        <CardHeader className="border-b [.border-b]:pb-5">
          <CardTitle>Users</CardTitle>
          <CardDescription>
            {users.length} user{users.length !== 1 ? 's' : ''} shown
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {isLoading ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">Loading users...</p>
          ) : users.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">No users found</p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="[&_td]:px-4 [&_td]:py-3">
                <TableHeader className="bg-muted/50 [&_th]:h-auto [&_th]:px-4 [&_th]:py-3 [&_th]:text-xs [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-muted-foreground">
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedUsers.size === users.length && users.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Content</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedUsers.has(user.id)}
                          onCheckedChange={() => handleSelectUser(user.id)}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-sm">{user.email}</TableCell>
                      <TableCell>{user.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{user.role}</Badge>
                      </TableCell>
                      <TableCell>
                        {user.deactivated ? (
                          <Badge variant="secondary">Deactivated</Badge>
                        ) : (
                          <Badge variant="outline" className="border-success/30 bg-success-soft text-success">Active</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.relatedContentCount > 0 && (
                          <div className="flex items-center gap-1 text-xs">
                            <AlertTriangle className="h-3 w-3 text-warning" />
                            {user.relatedContentCount} items
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Dialog open={confirmDialog.open && confirmDialog.userId === user.id} onOpenChange={(open) => {
                            if (!open) setConfirmDialog({ open: false })
                          }}>
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setConfirmDialog({
                                    open: true,
                                    userId: user.id,
                                    action: 'archive',
                                    user,
                                  })
                                }
                              >
                                <Archive className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Archive User</DialogTitle>
                                <DialogDescription>
                                  Deactivate {user.email}? They will no longer be able to log in, but their data will be preserved.
                                </DialogDescription>
                              </DialogHeader>
                              <DialogFooter>
                                <Button
                                  variant="outline"
                                  onClick={() => setConfirmDialog({ open: false })}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  variant="destructive"
                                  onClick={() => handleArchiveUser(user.id)}
                                  disabled={actionInProgress}
                                >
                                  {actionInProgress ? 'Archiving...' : 'Archive'}
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>

                          <Dialog open={confirmDialog.open && confirmDialog.userId === user.id && confirmDialog.action === 'delete_warning'} onOpenChange={(open) => {
                            if (!open) setConfirmDialog({ open: false })
                          }}>
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setConfirmDialog({
                                    open: true,
                                    userId: user.id,
                                    action: 'delete',
                                    user,
                                  })
                                }
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle className="text-destructive">Cannot Delete User</DialogTitle>
                                <DialogDescription>
                                  {user.email} has {user.relatedContentCount} related content items:
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-2 text-sm">
                                {user.postsCount > 0 && (
                                  <p>{user.postsCount} community posts</p>
                                )}
                                {user.reflectionsCount > 0 && (
                                  <p>{user.reflectionsCount} reflections</p>
                                )}
                                {user.commentsCount > 0 && (
                                  <p>{user.commentsCount} comments</p>
                                )}
                              </div>
                              <Alert>
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>
                                  Archive the user instead to preserve their contributions. You can delete test users with no content.
                                </AlertDescription>
                              </Alert>
                              <DialogFooter>
                                <Button
                                  variant="outline"
                                  onClick={() => setConfirmDialog({ open: false })}
                                >
                                  Close
                                </Button>
                                <Button
                                  onClick={() => handleArchiveUser(user.id)}
                                  disabled={actionInProgress}
                                >
                                  {actionInProgress ? 'Archiving...' : 'Archive Instead'}
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

