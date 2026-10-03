import Link from 'next/link'
import { FileLock2 } from 'lucide-react'
import { TopBar } from '@/components/top-bar'
import { Button } from '@/components/ui/button'
import { requireUser } from '@/lib/auth-server'
import { isStoredFileKind, storedFileApiUrl } from '@/lib/stored-files'
import { resolveStoredFile } from '@/lib/stored-files-server'
import { BackButton } from './back-button'
import { PdfViewer } from './pdf-viewer'

export const dynamic = 'force-dynamic'

/**
 * In-app viewer for a file in the private course-files bucket. This
 * is the URL fellows see and share, so it never expires: every load
 * re-checks access, and the PDF is fetched through /api/files, which
 * mints a fresh signed URL per request. The raw storage link (which
 * does expire) never reaches the address bar.
 */
export default async function StoredFilePage({
  params,
}: {
  params: Promise<{ kind: string; id: string }>
}) {
  const { kind, id } = await params
  const user = await requireUser()
  const file = isStoredFileKind(kind) ? await resolveStoredFile(user, kind, id) : null

  return (
    // Viewport-height shell: the PDF scrolls inside its own frame
    // (see PdfViewer), not the window.
    <div className="flex h-svh flex-col bg-canvas">
      <TopBar />
      {file && isStoredFileKind(kind) ? (
        <main className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col px-4 py-3 sm:py-4">
          {/* Rendered with pdf.js rather than the browser's PDF viewer
              so there are no download / print / open-in-tab controls. */}
          <PdfViewer
            src={storedFileApiUrl(kind, id)}
            title={file.title}
            leading={
              <>
                <BackButton />
                <h1 className="truncate text-lg sm:text-xl">{file.title}</h1>
              </>
            }
          />
        </main>
      ) : (
        <main className="flex flex-1 items-center justify-center px-4 py-16">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-xs">
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
              <FileLock2 className="size-6 text-muted-foreground" aria-hidden="true" />
            </div>
            <h1 className="text-xl">This file isn&apos;t available</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
              It may not be open to your cohort yet, or it may have been moved.
              If you think you should have access, contact the WaW team.
            </p>
            <div className="mt-6 flex justify-center gap-2">
              <BackButton withLabel />
              <Button asChild>
                <Link href="/dashboard">Go to dashboard</Link>
              </Button>
            </div>
          </div>
        </main>
      )}
    </div>
  )
}
