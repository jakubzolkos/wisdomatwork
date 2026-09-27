import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes that do not require authentication.
// (Edited to bust the Turbopack edge cache after switching from middleware.ts to proxy.ts.)
const PUBLIC_PATH_PREFIXES = ['/auth', '/_next', '/favicon', '/icon', '/apple']

function isPublicPath(pathname: string): boolean {
  if (pathname === '/') return true // root does its own redirect
  return PUBLIC_PATH_PREFIXES.some((p) => pathname.startsWith(p))
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // If Supabase env vars are not set, skip auth check and let requests through
  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse
  }

  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Do not run code between createServerClient and supabase.auth.getClaims().
  // A simple mistake could make it very hard to debug issues with users
  // being randomly logged out.
  //
  // getClaims() refreshes an expiring session (writing new cookies via
  // setAll above) and verifies the JWT locally against the project's
  // cached ES256 JWKS, so unlike getUser() it costs no Auth round-trip.
  const { data } = await supabase.auth.getClaims()
  const user = data?.claims ?? null

  const { pathname } = request.nextUrl

  // Block unauthenticated access to everything except /auth/* and friends.
  if (!user && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // Signed-in users hitting /auth/login or /auth/sign-up get bounced
  // into the app.
  if (
    user &&
    (pathname === '/auth/login' || pathname === '/auth/sign-up')
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    url.search = ''
    return NextResponse.redirect(url)
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  return supabaseResponse
}
