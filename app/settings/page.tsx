import { requireUser } from '@/lib/auth-server'
import { TopBar } from '@/components/top-bar'
import { SettingsPanel } from '@/components/settings/settings-panel'

export const metadata = {
  title: 'Settings | Leadership Fellowship',
  description: 'Manage your account settings and preferences.',
}

export default async function SettingsPage() {
  const user = await requireUser()

  return (
    <div className="min-h-screen bg-canvas">
      <TopBar />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage your account settings and communication preferences.
          </p>
        </div>

        <SettingsPanel userId={user.id} userEmail={user.email} />
      </main>
    </div>
  )
}
