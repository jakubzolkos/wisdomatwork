'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  PlayCircle,
  FileQuestion,
  File,
  FileText,
  Table2,
  Presentation,
  Archive,
  ImageIcon,
  ExternalLink,
} from 'lucide-react'
import {
  analyzeResource,
  getFileTypeColor,
  getFileTypeIcon,
  formatDuration,
  type ResourcePreviewData,
} from '@/lib/resource-preview'

interface ResourcePreviewCardProps {
  title: string
  url: string
  durationMinutes?: number
  className?: string
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  'File': File,
  'FileText': FileText,
  'Table2': Table2,
  'Presentation': Presentation,
  'Archive': Archive,
  'Image': ImageIcon,
  'FileQuestion': FileQuestion,
}

export function ResourcePreviewCard({
  title,
  url,
  durationMinutes,
  className = '',
}: ResourcePreviewCardProps) {
  const [preview, setPreview] = useState<ResourcePreviewData | null>(null)
  const [thumbnailError, setThumbnailError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadPreview = async () => {
      try {
        const data = await analyzeResource(url)
        setPreview(data)
      } catch (error) {
        console.error('Error analyzing resource:', error)
        setPreview({ type: 'document', isExternalLink: true })
      } finally {
        setIsLoading(false)
      }
    }

    loadPreview()
  }, [url])

  if (isLoading) {
    return (
      <div className={`flex items-center gap-3 rounded-lg border border-border bg-muted px-4 py-3 ${className}`}>
        <div className="h-16 w-20 animate-pulse rounded bg-border" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-24 animate-pulse rounded bg-border" />
          <div className="h-2 w-16 animate-pulse rounded bg-border" />
        </div>
      </div>
    )
  }

  if (!preview) {
    return null
  }

  const isVideo = preview.type === 'video'
  const duration = durationMinutes ? formatDuration(durationMinutes * 60) : null
  const fileTypeColor = !isVideo ? getFileTypeColor(preview.fileType) : ''
  const IconComponent = !isVideo ? iconMap[getFileTypeIcon(preview.fileType)] || FileQuestion : null

  return (
    <Link
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={isVideo ? `Watch video: ${title} (opens in new tab)` : `Open document: ${title} (opens in new tab)`}
      className={`group flex items-center gap-3 overflow-hidden rounded-lg border border-border bg-card shadow-xs transition hover:border-border-strong hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${className}`}
    >
      {/* Thumbnail / Icon Section */}
      <div className="relative h-20 w-24 flex-shrink-0 overflow-hidden bg-muted">
        {isVideo && preview.thumbnailUrl && !thumbnailError ? (
          <>
            <Image
              src={preview.thumbnailUrl}
              alt=""
              fill
              className="object-cover"
              onError={() => setThumbnailError(true)}
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
              <PlayCircle className="h-8 w-8 text-white drop-shadow-lg" />
            </div>
            {preview.platform && (
              <div className="absolute top-1 right-1 rounded-full bg-black/70 px-2 py-0.5 text-xs font-semibold text-white capitalize">
                {preview.platform}
              </div>
            )}
          </>
        ) : !isVideo ? (
          <div className={`flex h-full w-full items-center justify-center ${fileTypeColor}`}>
            {IconComponent && <IconComponent className="h-8 w-8" />}
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted">
            <PlayCircle className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <h3 className="truncate text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
          {title}
        </h3>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {isVideo && duration && (
            <span className="inline-block rounded bg-muted px-2 py-0.5">{duration}</span>
          )}
          {!isVideo && preview.fileType && (
            <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${fileTypeColor}`}>
              {preview.fileType.toUpperCase()}
            </span>
          )}
        </div>
      </div>

      {/* External Link Icon */}
      <div className="flex-shrink-0 text-muted-foreground group-hover:text-primary group-focus-visible:text-primary transition-colors">
        <ExternalLink className="h-4 w-4" />
      </div>
    </Link>
  )
}
