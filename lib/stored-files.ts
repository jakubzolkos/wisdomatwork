/**
 * Files hosted in our own private Supabase Storage bucket (as opposed
 * to an external link like Google Drive).
 *
 * The bucket has no read policy for fellows, so nobody can fetch an
 * object directly. A row that points at a stored file keeps the
 * storage key in `file_path` and stores `storedFileUrl(...)` in its
 * `url` column. That URL hits app/api/files/[kind]/[id]/route.ts, which
 * re-runs the same access check as the page the row is shown on and
 * only then redirects to a short-lived signed URL.
 */

export const STORED_FILES_BUCKET = 'course-files'

/** Signed URLs are minted per click, so they only need to outlive the redirect. */
export const SIGNED_URL_TTL_SECONDS = 60

export type StoredFileKind = 'labs' | 'library'

export function isStoredFileKind(value: unknown): value is StoredFileKind {
  return value === 'labs' || value === 'library'
}

/** The in-app URL a row's `url` column holds when its file is stored with us. */
export function storedFileUrl(kind: StoredFileKind, id: string): string {
  return `/api/files/${kind}/${encodeURIComponent(id)}`
}

/** True for URLs produced by {@link storedFileUrl}. */
export function isStoredFileUrl(url: string): boolean {
  return /^\/api\/files\/(labs|library)\/[^/]+$/.test(url)
}
