import type { Metadata } from 'next'
import { Inter, Source_Serif_4 } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { UserProvider } from '@/lib/user-context'
import { getCurrentUser } from '@/lib/auth-server'
import { AdminPreviewBanner } from '@/components/admin/preview-banner'
import { SkipNav } from '@/components/skip-nav'
import './globals.css'

// Skip prerendering for the entire app since it requires Supabase which may not be available at build time
export const dynamic = 'force-dynamic'

/* UI sans + reading/display serif. Exposed as CSS variables that
   app/globals.css maps onto font-sans / font-serif / font-display. */
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-source-serif',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'WaW Fellows Portal',
  description: 'The Wisdom at Work Fellowship portal for professional development and leadership learning',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const user = await getCurrentUser()

  return (
    <html lang="en" className={`${inter.variable} ${sourceSerif.variable}`}>
      {/* `suppressHydrationWarning` here is scoped to <body> only -
          it silences the false-positive caused by browser extensions
          (Grammarly, LastPass, etc.) that inject `data-gr-*` /
          `data-lastpass-*` attributes after the server HTML is
          delivered. Real hydration mismatches anywhere else in the
          tree still surface as warnings. */}
      <body
        suppressHydrationWarning
        className="font-sans antialiased"
      >
        <SkipNav />
        <UserProvider initialUser={user}>
          {user?.preview && (
            <AdminPreviewBanner
              label={user.preview.label}
              mode={user.preview.mode}
              actualAdminName={user.preview.actualAdminName}
            />
          )}
          <main id="main-content">
            {children}
          </main>
        </UserProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
