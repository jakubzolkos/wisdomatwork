import { NextResponse, type NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth-server'
import { isStoredFileKind } from '@/lib/stored-files'
import { resolveStoredFile, signStoredFile } from '@/lib/stored-files-server'

export const dynamic = 'force-dynamic'

/**
 * Gatekeeper for files in the private `course-files` bucket.
 *
 *   GET /api/files/labs/<labs.id>
 *   GET /api/files/library/<community_resources.id>
 *
 * Runs the same access check as the page that shows the file
 * (lib/content-access.ts), then redirects to a signed URL that
 * expires in SIGNED_URL_TTL_SECONDS. Fellows never see this URL in
 * their address bar: they open the viewer page (/files/<kind>/<id>),
 * whose pdf.js viewer fetches from here, so every view re-signs.
 * Every refusal is a plain 404 so the response never confirms that a
 * file exists. Signed-out visitors never reach this handler: the
 * auth proxy sends them to /auth/login first.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ kind: string; id: string }> },
) {
  const { kind, id } = await params
  if (!isStoredFileKind(kind)) return notFound()

  const user = await getCurrentUser()
  if (!user) return notFound()

  const file = await resolveStoredFile(user, kind, id)
  if (!file) return notFound()

  const signedUrl = await signStoredFile(file)
  if (!signedUrl) return notFound()

  const response = NextResponse.redirect(signedUrl, 302)
  // The redirect target is per-request; never let a cache replay it.
  response.headers.set('Cache-Control', 'private, no-store')
  return response
}

function notFound() {
  return new NextResponse('Not found', {
    status: 404,
    headers: { 'Cache-Control': 'private, no-store' },
  })
}
