'use client'

import { useId, useRef, useState } from 'react'
import { ExternalLink, FileText, Loader2, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { MAX_UPLOAD_BYTES, STORED_FILES_BUCKET, storedFileName } from '@/lib/stored-files'

interface Props {
  /** Form field the chosen file's storage key is submitted under. */
  name: string
  /** Current storage key, or null when nothing is uploaded yet. */
  initialPath: string | null
  /** Folder inside the bucket new uploads go to, e.g. `labs/<module id>`. */
  folder: string
  onChange?: (path: string | null) => void
}

/**
 * PDF upload for the admin editors. The file goes straight from the
 * browser to the private course-files bucket under the admin's own
 * session (the bucket's staff policy allows it), so large PDFs never
 * pass through a server action. The form only submits the resulting
 * storage key; the server turns it into the in-app viewer link.
 */
export function StoredFileField({ name, initialPath, folder, onChange }: Props) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [path, setPath] = useState<string | null>(initialPath)
  const [busy, setBusy] = useState<'upload' | 'preview' | null>(null)
  const [error, setError] = useState<string | null>(null)

  function choose(next: string | null) {
    setPath(next)
    onChange?.(next)
  }

  async function upload(file: File) {
    setError(null)
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Upload a PDF. The portal shows files in its own PDF viewer.')
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(`That file is ${(file.size / 1024 / 1024).toFixed(1)} MB; the limit is 25 MB.`)
      return
    }
    setBusy('upload')
    const safeName =
      file.name
        .toLowerCase()
        .replace(/\.pdf$/, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || 'file'
    // The timestamp prefix keeps every upload's key unique, so a
    // replacement never overwrites a file another item may point at.
    const key = `${folder}/${Date.now()}-${safeName}.pdf`
    const { error: upErr } = await createClient()
      .storage.from(STORED_FILES_BUCKET)
      .upload(key, file, { contentType: 'application/pdf', upsert: false })
    setBusy(null)
    if (upErr) {
      setError(`Upload failed: ${upErr.message}`)
      return
    }
    choose(key)
  }

  /** Opens the file (saved or just uploaded) through a short-lived signed link. */
  async function preview() {
    if (!path) return
    setError(null)
    // Open the tab synchronously so the popup blocker allows it.
    const tab = window.open('', '_blank')
    setBusy('preview')
    const { data, error: signErr } = await createClient()
      .storage.from(STORED_FILES_BUCKET)
      .createSignedUrl(path, 120)
    setBusy(null)
    if (signErr || !data?.signedUrl) {
      tab?.close()
      setError(`Could not open the file: ${signErr?.message ?? 'no link returned'}`)
      return
    }
    if (tab) tab.location.href = data.signedUrl
    else window.open(data.signedUrl, '_blank')
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={path ?? ''} />
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = '' // allow picking the same file again
          if (file) void upload(file)
        }}
      />

      {path ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
          <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-sm" title={path}>
            {storedFileName(path)}
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={preview} disabled={busy !== null}>
            {busy === 'preview' ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <ExternalLink className="size-4" aria-hidden="true" />
            )}
            Preview
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={busy !== null}
          >
            {busy === 'upload' ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Upload className="size-4" aria-hidden="true" />
            )}
            Replace
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Remove file"
            onClick={() => choose(null)}
            disabled={busy !== null}
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={busy !== null}
        >
          {busy === 'upload' ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Upload className="size-4" aria-hidden="true" />
          )}
          {busy === 'upload' ? 'Uploading…' : 'Upload PDF'}
        </Button>
      )}

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
