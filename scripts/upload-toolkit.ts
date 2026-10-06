/**
 * Attach the Wisdom at Work Companion Toolkit PDF to Cohort A's Toolkit
 * item (private storage; fellows open it in the portal's viewer).
 *
 *   bun --env-file=.env.local scripts/upload-toolkit.ts "<path to pdf>"           # dry run
 *   bun --env-file=.env.local scripts/upload-toolkit.ts "<path to pdf>" --apply   # upload
 */
import { readFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'
import { STORED_FILES_BUCKET, storedFileUrl } from '@/lib/stored-files'

const TOOLKIT_MODULE = 'fac3a2c5-3f42-45f8-802c-4648e7ff7ad0'

async function main() {
  const file = process.argv[2]
  const apply = process.argv.includes('--apply')
  if (!file) throw new Error('Pass the PDF path')
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })
  const { data: item, error } = await sb
    .from('labs')
    .select('id, title, file_path')
    .eq('module_id', TOOLKIT_MODULE)
    .single()
  if (error || !item) throw new Error(`Toolkit item not found: ${error?.message}`)

  const bytes = await readFile(file)
  // Same layout as uploads from the admin panel (components/admin/stored-file-field.tsx).
  const path = `labs/${TOOLKIT_MODULE}/${Date.now()}-waw-companion-toolkit.pdf`
  console.log(`${apply ? '' : '[dry] '}upload ${(bytes.byteLength / 1e6).toFixed(1)} MB -> ${path}`)
  console.log(`${apply ? '' : '[dry] '}attach to "${item.title}" (${item.id})${item.file_path ? `, replacing ${item.file_path}` : ''}`)
  if (!apply) return

  const up = await sb.storage.from(STORED_FILES_BUCKET).upload(path, bytes, { contentType: 'application/pdf' })
  if (up.error) throw new Error(up.error.message)
  const { error: updateError } = await sb
    .from('labs')
    .update({ file_path: path, url: storedFileUrl('labs', item.id) })
    .eq('id', item.id)
  if (updateError) throw new Error(updateError.message)
  console.log('done')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
