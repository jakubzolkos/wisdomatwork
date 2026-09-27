'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const fmt = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export function MaintenanceAuditLog() {
  const [logs, setLogs] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [filterActionType, setFilterActionType] = useState('')
  const [filterItemType, setFilterItemType] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchLogs()
  }, [page, filterActionType, filterItemType, searchTerm])

  const fetchLogs = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        ...(filterActionType && { actionType: filterActionType }),
        ...(filterItemType && { itemType: filterItemType }),
        ...(searchTerm && { search: searchTerm }),
      })

      const response = await fetch(`/api/admin/maintenance/audit-log?${params}`)
      if (response.ok) {
        const data = await response.json()
        setLogs(data.logs || [])
      }
    } catch (error) {
      console.error('[v0] Error fetching audit logs:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const actionTypes = ['archive', 'delete', 'restore', 'unpublish', 'publish', 'resend_invite']
  const itemTypes = [
    'user',
    'invitation',
    'phase',
    'lab',
    'activity',
    'resource',
    'reflection',
    'comment',
    'win',
    'ask',
    'notification',
    'custom_page',
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2>Maintenance Audit Log</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Complete record of all portal maintenance actions performed by admins
        </p>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Input
          placeholder="Search by name, email, or ID..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value)
            setPage(1)
          }}
        />
        <Select 
          value={filterActionType || 'all'} 
          onValueChange={(v) => {
          setFilterActionType(v === 'all' ? '' : v)
          setPage(1)
        }}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by action..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {actionTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select 
          value={filterItemType || 'all'} 
          onValueChange={(v) => {
          setFilterItemType(v === 'all' ? '' : v)
          setPage(1)
        }}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by item type..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {itemTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Audit Log Table */}
      <Card className="gap-0 overflow-hidden pb-0">
        <CardHeader className="border-b [.border-b]:pb-5">
          <CardTitle>Recent Actions</CardTitle>
          <CardDescription>All maintenance actions are logged for accountability</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {isLoading ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">Loading audit log...</p>
          ) : logs.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">No actions logged yet</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table className="[&_td]:px-4 [&_td]:py-3">
                  <TableHeader className="bg-muted/50 [&_th]:h-auto [&_th]:px-4 [&_th]:py-3 [&_th]:text-xs [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-muted-foreground">
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Admin</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Item Type</TableHead>
                      <TableHead>Item Name</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs">
                          {fmt.format(new Date(log.created_at))}
                        </TableCell>
                        <TableCell className="text-sm">{log.admin_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {log.action_type.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{log.item_type}</TableCell>
                        <TableCell className="text-sm">{log.item_name || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between border-t px-4 py-3">
                <p className="text-sm text-muted-foreground">Page {page}</p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page + 1)}
                    disabled={logs.length === 0}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
