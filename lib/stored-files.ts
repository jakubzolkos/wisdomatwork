/**
 * Files hosted in our own private Supabase Storage bucket (as opposed
 * to an external link like Google Drive).
 *
 * The bucket has no read policy for fellows, so nobody can fetch an
 * object directly. A row that points at a stored file keeps the
 * storage key in `file_path` and stores `storedFileUrl(...)` in its
 * `url` column. That URL is the in-app viewer page
 * (app/files/[kind]/[id]/page.tsx); the viewer embeds
 * `storedFileApiUrl(...)`, the route that re-runs the access check and
 * redirects to a short-lived signed URL. Because the address bar only
 * ever shows our own URL, reloading or bookmarking it never hits an
 * expired storage link.
 */

export const STORED_FILES_BUCKET = 'course-files'

/** Signed URLs are minted per click, so they only need to outlive the redirect. */
export const SIGNED_URL_TTL_SECONDS = 60

/**
 * `labs` / `library`: id is the row id. `mine`: id is a personal
 * document key, always resolved inside the signed-in user's own folder.
 */
export type StoredFileKind = 'labs' | 'library' | 'mine'

export function isStoredFileKind(value: unknown): value is StoredFileKind {
  return value === 'labs' || value === 'library' || value === 'mine'
}

/**
 * Per-fellow documents, stored at `fellows/<profile id>/<key>.pdf`.
 * Only the owner can open them: the path comes from the session, never
 * from the URL. Uploaded by scripts/upload-orientation-guides.ts.
 */
export const PERSONAL_DOCUMENTS = {
  'orientation-guide': 'Your Orientation Guide',
  'research-partnership-agreement': 'Your signed Research Partnership Agreement',
} as const

export type PersonalDocumentKey = keyof typeof PERSONAL_DOCUMENTS

export function isPersonalDocumentKey(value: string): value is PersonalDocumentKey {
  return Object.prototype.hasOwnProperty.call(PERSONAL_DOCUMENTS, value)
}

export function personalDocumentPath(profileId: string, key: PersonalDocumentKey): string {
  return `fellows/${profileId}/${key}.pdf`
}

/** The viewer page a row's `url` column holds when its file is stored with us. */
export function storedFileUrl(kind: StoredFileKind, id: string): string {
  return `/files/${kind}/${encodeURIComponent(id)}`
}

/** The route that checks access and redirects to a fresh signed URL. */
export function storedFileApiUrl(kind: StoredFileKind, id: string): string {
  return `/api/files/${kind}/${encodeURIComponent(id)}`
}

/** True for URLs produced by {@link storedFileUrl} or {@link storedFileApiUrl}. */
export function isStoredFileUrl(url: string): boolean {
  return /^(\/api)?\/files\/(labs|library|mine)\/[^/?]+$/.test(url)
}

/**
 * Anchor props for a resource link: stored files open in the in-app
 * viewer in the same tab; external links keep opening in a new tab.
 */
export function linkTargetProps(url: string): { target?: string; rel?: string } {
  return isStoredFileUrl(url) ? {} : { target: '_blank', rel: 'noreferrer' }
}

/** Display name for a stored file: the key's last segment, minus the upload prefix. */
export function storedFileName(filePath: string): string {
  const base = filePath.split('/').pop() ?? filePath
  return base.replace(/^\d{13}-/, '')
}

/** Uploads accepted by the admin editors: PDFs, which the in-app viewer renders. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024
