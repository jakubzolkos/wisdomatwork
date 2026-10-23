import { createClient } from '@/lib/supabase/server'
import { LibraryAdmin, type AdminLibraryRow } from './library-admin'
import { requireAdminPage } from '@/lib/admin-access-server'

export const metadata = {
  title: 'Library | Admin',
  description: 'Add, edit, and remove Library resources.',
}

/** Allowed values mirror the CHECK constraint on community_resources. */
const VALID_TYPES = new Set<AdminLibraryRow['resourceType']>([
  'document',
  'video',
  'link',
  'reading',
])

interface RawResourceRow {
  id: string
  title: string
  /** Nullable for legacy rows created before migration 043. */
  author: string | null
  description: string | null
  url: string
  resource_type: string
  tags: string[] | null
  cohorts: string[] | null
  is_universal: boolean | null
  cover_url: string | null
  created_at: string | null
}

/**
 * Admin Library page. Lists every resource (cohort-gated AND
 * recommended) so an admin can browse the entire catalogue, then
 * jump into the same `AddResourceDialog` form to add a new row,
 * edit an existing one, or delete it. Read access is admin-only -
 * facilitators continue to manage from /resources where the same
 * dialog already lives, but they don't get the catalogue-wide list.
 */
export default async function AdminLibraryPage() {
  await requireAdminPage('content')
  const supabase = await createClient()

  const { data: rows } = await supabase
    .from('community_resources')
    .select(
      'id, title, author, description, url, resource_type, tags, cohorts, is_universal, cover_url, created_at',
    )
    .order('created_at', { ascending: false })
    .returns<RawResourceRow[]>()

  // Server normalisation. Coerce unknown resource_type values to
  // 'reading' so legacy rows still render. Tags / cohorts default to
  // empty arrays; an empty cohorts list means "no cohort gating yet"
  // (the row is hidden from every fellow until assigned).
  const resources: AdminLibraryRow[] = (rows ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    author: r.author ?? null,
    description: r.description,
    url: r.url,
    resourceType: VALID_TYPES.has(r.resource_type as AdminLibraryRow['resourceType'])
      ? (r.resource_type as AdminLibraryRow['resourceType'])
      : 'reading',
    tags: Array.isArray(r.tags) ? r.tags : [],
    cohorts: Array.isArray(r.cohorts) ? r.cohorts : [],
    isUniversal: r.is_universal === true,
    coverUrl: r.cover_url ?? null,
    createdAt: r.created_at,
  }))

  return <LibraryAdmin resources={resources} />
}
