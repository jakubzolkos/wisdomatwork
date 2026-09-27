import { TopBar } from '@/components/top-bar'
import { Footer } from '@/components/footer'

interface StandalonePageTemplateProps {
  metadata?: {
    title: string
    description?: string
  }
  children: React.ReactNode
}

/**
 * Template for standalone pages (like About) that includes their own TopBar and Footer.
 * Use this for pages that are NOT within the /pages route.
 */
export function StandalonePageTemplate({ metadata, children }: StandalonePageTemplateProps) {
  return (
    <div className="min-h-screen bg-canvas">
      <TopBar />
      <main className="w-full">
        {children}
        <Footer />
      </main>
    </div>
  )
}
