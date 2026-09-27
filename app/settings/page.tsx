import { requireUser } from '@/lib/auth-server'
import { TopBar } from '@/components/top-bar'
import { SettingsPanel } from '@/components/settings/settings-panel'
import { PageHeader } from '@/components/page-header'

export const metadata = {
  title: 'Settings | Leadership Fellowship',
  description: 'Manage your account settings and preferences.',
}

export default async function SettingsPage() {
  const user = await requireUser()

  return (
    <div className="min-h-screen bg-canvas">
      <TopBar />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:py-10">
        <PageHeader
          title="Settings"
          description="Manage your account settings and communication preferences."
        />

        <SettingsPanel userId={user.id} userEmail={user.email} />
      </main>
    </div>
  )
}
