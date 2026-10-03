'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Loader2, Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { PDFDocumentProxy } from 'pdfjs-dist'

const MIN_ZOOM = 0.5
const MAX_ZOOM = 3
const ZOOM_STEP = 0.25

/**
 * Renders a PDF page-by-page onto canvases with pdf.js. Unlike the
 * browser's built-in viewer there is no toolbar, so no download,
 * print or "open in new tab" controls, and it works the same on
 * phones (where embedded PDFs otherwise render badly or not at all).
 *
 * This deters casual saving; it can't prevent it - the browser still
 * receives the file in order to draw it.
 *
 * `src` is the /api/files route: same-origin, so the session cookie
 * goes along for the access check, then a redirect to a fresh signed
 * storage URL (which allows any origin via CORS).
 */
export function PdfViewer({
  src,
  title,
  leading,
}: {
  src: string
  title: string
  /** Heading content (back button, title) shown left of the zoom controls. */
  leading?: ReactNode
}) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [error, setError] = useState(false)
  const [zoom, setZoom] = useState(1)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    // Destroying the loading task also tears down the document.
    let task: { destroy: () => Promise<void> } | null = null

    async function load() {
      try {
        // Imported lazily: pdf.js touches browser-only globals at
        // module load, so it can't run during server rendering.
        const pdfjs = await import('pdfjs-dist')
        if (!pdfjs.GlobalWorkerOptions.workerPort) {
          pdfjs.GlobalWorkerOptions.workerPort = new Worker(
            new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url),
            { type: 'module' },
          )
        }
        // Storage doesn't expose Content-Range to other origins, so
        // range requests can't work; fetch the whole file instead.
        const loadingTask = pdfjs.getDocument({ url: src, disableRange: true })
        task = loadingTask
        const doc = await loadingTask.promise
        if (!cancelled) setPdf(doc)
      } catch (err) {
        console.error('[pdf-viewer] failed to load', err)
        if (!cancelled) setError(true)
      }
    }

    void load()
    return () => {
      cancelled = true
      void task?.destroy()
    }
  }, [src])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* One compact row: page heading on the left, zoom on the right. */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">{leading}</div>
        {pdf && (
          <div className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground">
            <span className="mr-2 hidden sm:inline">
              {pdf.numPages} {pdf.numPages === 1 ? 'page' : 'pages'}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP))}
              disabled={zoom <= MIN_ZOOM}
              aria-label="Zoom out"
            >
              <Minus aria-hidden="true" />
            </Button>
            <span className="w-12 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP))}
              disabled={zoom >= MAX_ZOOM}
              aria-label="Zoom in"
            >
              <Plus aria-hidden="true" />
            </Button>
          </div>
        )}
      </div>

      {error ? (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-border bg-card p-10 text-center shadow-xs">
          <p className="max-w-sm text-sm text-muted-foreground">
            This file couldn&apos;t be loaded. Refresh the page to try again.
          </p>
        </div>
      ) : !pdf ? (
        <div className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card p-10 text-sm text-muted-foreground shadow-xs">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading document...
        </div>
      ) : (
        // Fixed-height frame that fills the rest of the screen, so
        // both scrollbars sit on its edges instead of the horizontal
        // one ending up below the last page.
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-auto rounded-xl border border-border bg-muted/40 p-2 sm:p-4"
          // No "Save image as..." on the rendered pages.
          onContextMenu={(e) => e.preventDefault()}
          role="document"
          aria-label={title}
        >
          <div className="mx-auto flex flex-col gap-3 sm:gap-4" style={{ width: `${zoom * 100}%` }}>
            {Array.from({ length: pdf.numPages }, (_, i) => (
              <PdfPage
                key={i}
                pdf={pdf}
                pageNumber={i + 1}
                zoom={zoom}
                scrollRef={scrollRef}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * One page. Reserves its height from the page's aspect ratio up front
 * so scrolling is stable, and only draws once it's near the viewport,
 * so long readings don't render every page at load.
 */
function PdfPage({
  pdf,
  pageNumber,
  zoom,
  scrollRef,
}: {
  pdf: PDFDocumentProxy
  pageNumber: number
  zoom: number
  scrollRef: React.RefObject<HTMLDivElement | null>
}) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [aspect, setAspect] = useState(11 / 8.5)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      // Observe within the scroll frame so the margin pre-renders
      // pages just below its fold.
      { root: scrollRef.current, rootMargin: '600px 0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [scrollRef])

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    let task: { cancel: () => void } | null = null

    async function draw() {
      const page = await pdf.getPage(pageNumber)
      const base = page.getViewport({ scale: 1 })
      if (cancelled) return
      setAspect(base.height / base.width)

      const canvas = canvasRef.current
      const wrapper = wrapperRef.current
      if (!canvas || !wrapper) return
      // Draw at the displayed width times the screen's pixel density
      // so text stays sharp on high-DPI displays and when zoomed.
      const cssWidth = wrapper.clientWidth
      const scale = (cssWidth / base.width) * (window.devicePixelRatio || 1)
      const viewport = page.getViewport({ scale })
      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)

      const renderTask = page.render({ canvas, viewport })
      task = renderTask
      try {
        await renderTask.promise
      } catch {
        // Cancelled by a newer render (zoom change / unmount).
      }
    }

    void draw()
    return () => {
      cancelled = true
      task?.cancel()
    }
  }, [visible, pdf, pageNumber, zoom])

  return (
    <div
      ref={wrapperRef}
      className="relative w-full overflow-hidden rounded-sm bg-white shadow-sm"
      style={{ aspectRatio: `1 / ${aspect}` }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 size-full"
        aria-label={`Page ${pageNumber}`}
      />
    </div>
  )
}
