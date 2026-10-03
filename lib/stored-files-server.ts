import 'server-only'

import { canUserSeeItem, canUserSeeLibraryResource } from '@/lib/content-access'
import { findCurriculumItem, loadFullCurriculum } from '@/lib/curriculum-tree'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import {
  SIGNED_URL_TTL_SECONDS,
  STORED_FILES_BUCKET,
  type StoredFileKind,
} from '@/lib/stored-files'
import type { CurrentUser } from '@/lib/user-context'

export interface StoredFile {
  title: string
  filePath: string
}

/**
 * The stored file behind a labs / library row, or null when the row
 * has no stored file or `user` may not open it. Used by both the
 * viewer page and the download route so they can never disagree.
 */
export async function resolveStoredFile(
  user: CurrentUser,
  kind: StoredFileKind,
  id: string,
): Promise<StoredFile | null> {
  return kind === 'labs' ? resolveLabFile(user, id) : resolveLibraryFile(user, id)
}

async function resolveLabFile(user: CurrentUser, id: string): Promise<StoredFile | null> {
  const supabase = await createClient()
  const { data: item } = await supabase
    .from('labs')
    .select('title, cohorts, file_path, module_id')
    .eq('id', id)
    .maybeSingle<{
      title: string
      cohorts: string[] | null
      file_path: string | null
      module_id: string
    }>()
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

  if (!canUserSeeItem(user, phase, module, item)) return null
  // Same sequence lock as the item page: no files from modules that
  // haven't opened yet.
  if (user.role === 'fellow') {
    const placement = findCurriculumItem(await loadFullCurriculum(), id)
    if (!placement || placement.module.isLocked) return null
  }
  return { title: item.title, filePath: item.file_path }
}

async function resolveLibraryFile(user: CurrentUser, id: string): Promise<StoredFile | null> {
  const supabase = await createClient()
  const { data: resource } = await supabase
    .from('community_resources')
    .select('title, cohorts, is_universal, file_path')
    .eq('id', id)
    .maybeSingle<{
      title: string
      cohorts: string[] | null
      is_universal: boolean | null
      file_path: string | null
    }>()
  if (!resource?.file_path) return null

  if (!canUserSeeLibraryResource(user, resource)) return null
  return { title: resource.title, filePath: resource.file_path }
}

/** Short-lived signed URL for a stored file. */
export async function signStoredFile(file: StoredFile): Promise<string | null> {
  // The bucket grants fellows nothing, so signing needs the service role.
  const { data, error } = await createAdminClient()
    .storage.from(STORED_FILES_BUCKET)
    .createSignedUrl(file.filePath, SIGNED_URL_TTL_SECONDS)
  if (error || !data?.signedUrl) {
    console.error('[files] could not sign', { filePath: file.filePath, error: error?.message })
    return null
  }
  return data.signedUrl
}
