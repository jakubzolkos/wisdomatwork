import { NextResponse, type NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth-server'
import { canUserSeeItem, canUserSeeLibraryResource } from '@/lib/content-access'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import {
  SIGNED_URL_TTL_SECONDS,
  STORED_FILES_BUCKET,
  isStoredFileKind,
} from '@/lib/stored-files'

export const dynamic = 'force-dynamic'

/**
 * Gatekeeper for files in the private `course-files` bucket.
 *
 *   GET /api/files/labs/<labs.id>
 *   GET /api/files/library/<community_resources.id>
 *
 * Loads the row the file belongs to, runs the same access check as the
 * page that shows it (lib/content-access.ts), then redirects to a
 * signed URL that expires in SIGNED_URL_TTL_SECONDS. Every refusal is a
 * plain 404 so the response never confirms that a file exists.
 * Signed-out visitors never reach this handler: the auth proxy sends
 * them to /auth/login?next=<this path> first.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ kind: string; id: string }> },
) {
  const { kind, id } = await params
  if (!isStoredFileKind(kind)) return notFound()

  const user = await getCurrentUser()
  if (!user) return notFound()

  const filePath =
    kind === 'labs' ? await labFilePath(user, id) : await libraryFilePath(user, id)
  if (!filePath) return notFound()

  // The bucket grants fellows nothing, so signing needs the service role.
  const { data, error } = await createAdminClient()
    .storage.from(STORED_FILES_BUCKET)
    .createSignedUrl(filePath, SIGNED_URL_TTL_SECONDS)
  if (error || !data?.signedUrl) {
    console.error('[files] could not sign', { kind, id, filePath, error: error?.message })
    return notFound()
  }

  const response = NextResponse.redirect(data.signedUrl, 302)
  // The redirect target is per-request; never let a cache replay it.
  response.headers.set('Cache-Control', 'private, no-store')
  return response
}

type User = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>

async function labFilePath(user: User, id: string): Promise<string | null> {
  const supabase = await createClient()
  const { data: item } = await supabase
    .from('labs')
    .select('cohorts, file_path, module_id')
    .eq('id', id)
    .maybeSingle<{ cohorts: string[] | null; file_path: string | null; module_id: string }>()
  if (!item?.file_path) return null

  const { data: module } = await supabase
    .from('modules')
    .select('cohorts, phase_id')
    .eq('id', item.module_id)
    .maybeSingle<{ cohorts: string[] | null; phase_id: string }>()
  if (!module) return null

  const { data: phase } = await supabase
    .from('years')
    .select('cohorts')
    .eq('id', module.phase_id)
    .maybeSingle<{ cohorts: string[] | null }>()
  if (!phase) return null

  return canUserSeeItem(user, phase, module, item) ? item.file_path : null
}

async function libraryFilePath(user: User, id: string): Promise<string | null> {
  const supabase = await createClient()
  const { data: resource } = await supabase
    .from('community_resources')
    .select('cohorts, is_universal, file_path')
    .eq('id', id)
    .maybeSingle<{ cohorts: string[] | null; is_universal: boolean | null; file_path: string | null }>()
  if (!resource?.file_path) return null

  return canUserSeeLibraryResource(user, resource) ? resource.file_path : null
}

function notFound() {
  return new NextResponse('Not found', {
    status: 404,
    headers: { 'Cache-Control': 'private, no-store' },
  })
}
