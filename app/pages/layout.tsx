import { TopBar } from '@/components/top-bar'
import { Footer } from '@/components/footer'
import { getMenuCustomPages } from '@/lib/custom-pages/menu'

export const dynamic = 'force-dynamic'

export default async function PagesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const customPages = await getMenuCustomPages()

  return (
    <div className="min-h-screen bg-canvas">
      <TopBar customPages={customPages} />
      {children}
      <Footer />
    </div>
  )
}
