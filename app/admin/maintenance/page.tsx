import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth-server'
import { createClient } from '@/lib/supabase/server'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle } from 'lucide-react'
import { MaintenanceClient } from '@/components/admin/maintenance/maintenance-client'

export const metadata = {
  title: 'Portal Maintenance | Admin',
  description: 'Clean up test, duplicate, or unused content before launch',
}

export default async function PortalMaintenancePage() {
  await requireAdmin()
  const supabase = await createClient()

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <section>
        <h1 className="text-balance font-serif text-4xl text-foreground">
          Portal Maintenance
        </h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
          Clean up test data, duplicate content, and unused resources before launch. All
          actions are logged for accountability.
        </p>
      </section>

      {/* Safety Warning */}
      <Alert variant="destructive" className="border-warning/30 bg-warning-soft">
        <AlertTriangle className="h-4 w-4 text-warning" />
        <AlertDescription className="text-warning">
          Use caution when deleting content. Archive or unpublish instead where possible.
          All actions are permanently logged and cannot be undone.
        </AlertDescription>
      </Alert>

      {/* Card-based Navigation and Content */}
      <MaintenanceClient />
    </div>
  )
}
