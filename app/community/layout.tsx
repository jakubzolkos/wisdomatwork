import { TopBar } from '@/components/top-bar'
import { CommunitySidebar } from '@/components/community/community-sidebar'
import { requireUser } from '@/lib/auth-server'
import { redirect } from 'next/navigation'
import { getMenuCustomPages } from '@/lib/custom-pages/menu'
import { canSeeCommunity } from '@/lib/features'

export const metadata = {
  title: 'Community | Leadership Fellowship',
  description:
    'Fellow bios, announcements, reflections, wins, and peer Q&A across the Fellowship.',
}

/**
 * /community layout - persistent shell shared by every nested route.
 *
 * Renders:
 *   1. TopBar (same as the rest of the app)
 *   2. The Community sidebar (Overview + sections)
 *   3. The active route's content as `children`
 *
 * Caching note: requireUser() is request-scoped, so calling
 * requireUser() here AND in each child page costs only one
 * round-trip thanks to React's per-request cache().
 */
export default async function CommunityLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Independent, so run them in parallel rather than back to back.
  const [user, customPages] = await Promise.all([requireUser(), getMenuCustomPages()])
  // Hidden from fellows at launch (lib/features.ts); staff can still review it.
  if (!canSeeCommunity(user.role)) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-canvas">
      <TopBar customPages={customPages} />
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:py-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
          <CommunitySidebar />
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </div>
  )
}
