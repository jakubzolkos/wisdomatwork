'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  RotateCcw,
  Search,
} from 'lucide-react'
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { EmailLogEntry } from '@/lib/email/logs'
import { resendInvitationEmail, resendNotificationEmail } from '@/app/admin/email-logs/actions'

const STATUS_COLORS = {
  sent: 'text-success',
  failed: 'text-destructive',
  pending: 'text-warning',
}

const STATUS_ICONS = {
  sent: <CheckCircle2 className="h-4 w-4" />,
  failed: <AlertCircle className="h-4 w-4" />,
  pending: <Clock className="h-4 w-4" />,
}

interface EmailLogsClientProps {
  initialLogs: EmailLogEntry[]
  failedEmailCount: number
  currentPage: number
  totalLogs: number
  pageCount: number
}

export function EmailLogsClient({
  initialLogs,
  failedEmailCount,
  currentPage,
  totalLogs,
  pageCount,
}: EmailLogsClientProps) {
  const router = useRouter()
  const [logs, setLogs] = useState<EmailLogEntry[]>(initialLogs)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'sent' | 'failed' | 'pending'>('all')
  const [resendingId, setResendingId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const filteredLogs = logs.filter((log) => {
    const searchLower = (searchTerm || '').toLowerCase()
    
    const matchesSearch =
      (log.recipient_email?.toLowerCase().includes(searchLower) ?? false) ||
      (log.subject?.toLowerCase().includes(searchLower) ?? false) ||
      (log.recipient_name?.toLowerCase().includes(searchLower) ?? false)

    const matchesStatus = statusFilter === 'all' || log.status === statusFilter

    return matchesSearch && matchesStatus
  })

  const handleResend = async (log: EmailLogEntry) => {
    setResendingId(log.id)
    setMessage(null)

    try {
      let result
      if (log.type === 'invitation') {
        result = await resendInvitationEmail(log.id)
      } else {
        result = await resendNotificationEmail(log.id)
      }

      if (result.ok) {
        setMessage({
          text: result.message || 'Email resent successfully',
          type: 'success',
        })
        // Update the log in the UI
        setLogs((prev) =>
          prev.map((l) =>
            l.id === log.id
              ? { ...l, status: 'sent', sent_at: new Date().toISOString(), error_message: null }
              : l
          )
        )
        setTimeout(() => setMessage(null), 3000)
      } else {
        setMessage({
          text: result.error || 'Failed to resend email',
          type: 'error',
        })
        setTimeout(() => setMessage(null), 5000)
      }
    } catch (err) {
      setMessage({
        text: 'An error occurred while resending the email',
        type: 'error',
      })
      setTimeout(() => setMessage(null), 5000)
    } finally {
      setResendingId(null)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not sent'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const failedCount = logs.filter((log) => log.status === 'failed').length
  const sentCount = logs.filter((log) => log.status === 'sent').length
  const pendingCount = logs.filter((log) => log.status === 'pending').length

  return (
    <div className="flex flex-col gap-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card
          className={`cursor-pointer transition-all ${statusFilter === 'all' ? 'ring-2 ring-primary' : 'hover:border-primary'}`}
          onClick={() => setStatusFilter('all')}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Emails</p>
                <p className="text-2xl font-bold text-foreground">{totalLogs}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all ${statusFilter === 'sent' ? 'ring-2 ring-green-600' : 'hover:border-green-600'}`}
          onClick={() => setStatusFilter('sent')}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Successfully Sent</p>
                <p className="text-2xl font-bold text-success">{sentCount}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-success/50" />
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all ${statusFilter === 'failed' ? 'ring-2 ring-red-600' : 'hover:border-red-600'}`}
          onClick={() => setStatusFilter('failed')}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Failed</p>
                <p className="text-2xl font-bold text-destructive">{failedCount}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-destructive/50" />
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all ${statusFilter === 'pending' ? 'ring-2 ring-yellow-600' : 'hover:border-yellow-600'}`}
          onClick={() => setStatusFilter('pending')}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-warning">{pendingCount}</p>
              </div>
              <Clock className="h-8 w-8 text-warning/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Message Alert */}
      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.type === 'success' ? 'bg-success-soft text-success' : 'bg-destructive/10 text-destructive'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Filters & Search */}
      <Card>
        <CardHeader>
          <CardTitle>Email History (Past 7 Days)</CardTitle>
          <CardDescription>
            View all emails sent in the past 7 days with delivery status
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Search and Filter Bar */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by email, recipient name, or subject..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <Select
              value={statusFilter}
              onValueChange={(value: any) => setStatusFilter(value)}
            >
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses ({totalLogs})</SelectItem>
                <SelectItem value="sent">Sent ({sentCount})</SelectItem>
                <SelectItem value="failed">Failed ({failedCount})</SelectItem>
                <SelectItem value="pending">Pending ({pendingCount})</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Email Logs Table */}
          <div className="overflow-x-auto">
            {filteredLogs.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
                <p className="mt-3 text-sm font-medium text-muted-foreground">No emails found</p>
                <p className="text-xs text-muted-foreground">
                  Try adjusting your search or filters
                </p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/30">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Recipient
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Sent
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Error
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-4">
                        <div>
                          <p className="font-medium text-foreground">{log.recipient_email}</p>
                          {log.recipient_name && (
                            <p className="text-xs text-muted-foreground">{log.recipient_name}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant="outline" className="capitalize">
                          {log.type}
                        </Badge>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          {STATUS_ICONS[log.status as keyof typeof STATUS_ICONS]}
                          <Badge
                            className={`capitalize ${STATUS_COLORS[log.status as keyof typeof STATUS_COLORS]}`}
                            variant="outline"
                          >
                            {log.status}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-xs text-muted-foreground">
                          {formatDate(log.sent_at)}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        {log.error_message && (
                          <p className="text-xs text-destructive max-w-xs truncate" title={log.error_message}>
                            {log.error_message}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          {log.status === 'failed' && (
                            <Button
                              onClick={() => handleResend(log)}
                              disabled={resendingId === log.id}
                              variant="ghost"
                              size="sm"
                              className="gap-1"
                              title="Resend this email"
                            >
                              <RotateCcw className="h-3 w-3" />
                              <span className="hidden sm:inline">
                                {resendingId === log.id ? 'Sending...' : 'Resend'}
                              </span>
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {pageCount > 1 && (
            <div className="flex items-center justify-between border-t border-border pt-4">
              <p className="text-xs text-muted-foreground">
                Page {currentPage} of {pageCount} ({totalLogs} total)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`?page=${currentPage - 1}`)}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`?page=${currentPage + 1}`)}
                  disabled={currentPage === pageCount}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

