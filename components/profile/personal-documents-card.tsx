import Link from 'next/link'
import { FileText } from 'lucide-react'
import {
  PERSONAL_DOCUMENTS,
  storedFileUrl,
  type PersonalDocumentKey,
} from '@/lib/stored-files'

/**
 * The fellow's own program documents (personalized Orientation Guide,
 * later the signed RPP). Links open the in-app viewer, which only ever
 * serves files from the signed-in user's own folder.
 */
export function PersonalDocumentsCard({ documents }: { documents: PersonalDocumentKey[] }) {
  if (documents.length === 0) return null
  return (
    <section className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Your documents
      </p>
      <ul className="mt-2 flex flex-col">
        {documents.map((key) => (
          <li key={key}>
            <Link
              href={storedFileUrl('mine', key)}
              className="-mx-2 flex items-center gap-2 rounded-md px-2 py-2 text-sm text-foreground transition-colors hover:bg-muted/60"
            >
              <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              {PERSONAL_DOCUMENTS[key]}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
