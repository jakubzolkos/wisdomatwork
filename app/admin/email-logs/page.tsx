import { PageHeader } from '@/components/page-header'
import { requireAdmin } from '@/lib/auth-server'
import { getRecentEmailLogs, getFailedEmailsForRetry } from '@/lib/email/logs'
import { EmailLogsClient } from '@/components/email-logs/email-logs-client'

export const metadata = {
  title: 'Email Logs | Admin',
  description: 'View and manage email logs from the past week',
}

export default async function EmailLogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  await requireAdmin()

  const params = await searchParams
  const page = parseInt(params.page || '1', 10)

  const { logs, total, pageCount } = await getRecentEmailLogs(page, 20)
  const failedEmails = await getFailedEmailsForRetry(50)

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <PageHeader
        className="mb-0"
        eyebrow="Admin console"
        title="Email Logs"
        description="Track all emails sent in the past week. View delivery status and resend failed emails."
      />

      {/* Email Logs Interface */}
      <EmailLogsClient
        initialLogs={logs}
        failedEmailCount={failedEmails.length}
        currentPage={page}
        totalLogs={total}
        pageCount={pageCount}
      />
    </div>
  )
}
