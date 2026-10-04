/**
 * Upload each fellow's personalized Orientation Guide to their private
 * folder (fellows/<profile id>/orientation-guide.pdf), where /profile
 * shows it under "Your documents".
 *
 *   bun --env-file=.env.local scripts/upload-orientation-guides.ts <folder>           # dry run
 *   bun --env-file=.env.local scripts/upload-orientation-guides.ts <folder> --apply   # upload
 *
 * <folder> is searched recursively for PDFs (e.g. the unzipped Drive
 * downloads). Each guide is matched by the Unique ID printed inside it,
 * not by file name, against profile_research_ids. Needs `pdftotext`
 * (poppler; ships with Git for Windows). Re-running replaces files.
 */
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { STORED_FILES_BUCKET, personalDocumentPath } from '../lib/stored-files'

const APPLY = process.argv.includes('--apply')
const folder = process.argv.slice(2).find((a) => !a.startsWith('--'))
if (!folder) {
  console.error('Usage: upload-orientation-guides.ts <folder> [--apply]')
  process.exit(1)
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
})

function pdfs(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return pdfs(path)
    return name.toLowerCase().endsWith('.pdf') ? [path] : []
  })
}

/** The Unique ID printed in the guide ("Your Unique ID: WAW..."). */
function researchIdIn(path: string): string | null {
  const text = execFileSync('pdftotext', [path, '-'], { encoding: 'utf8' })
  return text.match(/Unique ID:\s*(WAW[A-Z0-9]+)/)?.[1] ?? null
}

async function main() {
  const { data: ids, error } = await sb.from('profile_research_ids').select('profile_id, research_id')
  if (error) throw error
  const profileByResearchId = new Map(ids!.map((r) => [r.research_id, r.profile_id]))

  console.log(APPLY ? 'UPLOADING' : 'DRY RUN (pass --apply to upload)')
  const files = pdfs(folder!)
  const seen = new Map<string, string>()
  let uploaded = 0
  let failures = 0
  for (const file of files) {
    const name = basename(file)
    const researchId = researchIdIn(file)
    const profileId = researchId ? profileByResearchId.get(researchId) : undefined
    if (!researchId || !profileId) {
      console.log(`  skip  ${name}  (${researchId ?? 'no Unique ID found'}: no fellow with this ID)`)
      continue
    }
    if (seen.has(profileId)) {
      console.log(`  skip  ${name}  (duplicate of ${seen.get(profileId)})`)
      continue
    }
    seen.set(profileId, name)
    console.log(`  ${APPLY ? 'put ' : 'would put'}  ${researchId}  ${name}`)
    if (!APPLY) continue
    const { error: upErr } = await sb.storage
      .from(STORED_FILES_BUCKET)
      .upload(personalDocumentPath(profileId, 'orientation-guide'), readFileSync(file), {
        contentType: 'application/pdf',
        upsert: true,
      })
    if (upErr) {
      failures++
      console.error(`  ! ${name}: ${upErr.message}`)
    } else uploaded++
  }

  const missing = ids!.filter((r) => !seen.has(r.profile_id)).map((r) => r.research_id)
  console.log(`\n${files.length} PDFs, ${seen.size} matched${APPLY ? `, ${uploaded} uploaded` : ''}.`)
  if (missing.length) console.log(`Fellows without a guide (${missing.length}): ${missing.join(', ')}`)
  process.exit(failures ? 1 : 0)
}

main()
