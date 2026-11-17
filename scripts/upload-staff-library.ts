/**
 * Add a PDF to the Staff Library (Admins + Facilitators only, never
 * fellows): uploads it to the private bucket and creates the library row.
 * Requires scripts/067_library_staff_only.sql first.
 *
 *   bun --env-file=.env.local scripts/upload-staff-library.ts "<pdf>" --title "<title>" [--author "<author>"] [--description "<text>"]           # dry run
 *   ... same command with --apply                                                                                                          # write
 *
 * The dry run only reads the local file; it does not touch the database.
 */
import { readFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'
import { STORED_FILES_BUCKET, storedFileUrl } from '@/lib/stored-files'

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? (process.argv[i + 1] ?? null) : null
}

async function main() {
  const file = process.argv[2]
  const title = arg('title')
  const author = arg('author') ?? 'Wisdom at Work'
  const description = arg('description')
  const apply = process.argv.includes('--apply')
  if (!file || file.startsWith('--')) throw new Error('Pass the PDF path first')
  if (!title) throw new Error('Pass --title')

  const bytes = await readFile(file)
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const path = `library/staff/${Date.now()}-${slug}.pdf`
  const tag = apply ? '' : '[dry] '
  console.log(`${tag}upload ${(bytes.byteLength / 1e6).toFixed(1)} MB -> ${STORED_FILES_BUCKET}/${path}`)
  console.log(`${tag}create Staff Library row "${title}" by ${author} (staff_only, no cohorts, not universal)`)
  if (!apply) return

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  // Row first (to get its id), then the file, then point the row at it.
  const { data: row, error: insertError } = await sb
    .from('community_resources')
    .insert({
      title,
      author,
      description: description ?? null,
      url: 'pending',
      resource_type: 'document',
      tags: [],
      cohorts: [],
      is_universal: false,
      staff_only: true,
    })
    .select('id')
    .single()
  if (insertError || !row) throw new Error(`Could not create the row: ${insertError?.message}`)

  const up = await sb.storage.from(STORED_FILES_BUCKET).upload(path, bytes, { contentType: 'application/pdf' })
  if (up.error) {
    await sb.from('community_resources').delete().eq('id', row.id)
    throw new Error(`Upload failed, row removed: ${up.error.message}`)
  }
  const { error: updateError } = await sb
    .from('community_resources')
    .update({ file_path: path, url: storedFileUrl('library', row.id) })
    .eq('id', row.id)
  if (updateError) throw new Error(`Row ${row.id} created and file uploaded, but linking failed: ${updateError.message}`)
  console.log(`done: ${row.id}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
