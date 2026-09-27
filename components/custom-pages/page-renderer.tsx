'use client'

import Link from 'next/link'
import Image from 'next/image'
import Markdown from 'react-markdown'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/page-header'
import { cn } from '@/lib/utils'
import { CustomPage, PageBlock } from '@/lib/custom-pages/types'

interface PageRendererProps {
  page: CustomPage
  showCTA?: boolean
}

/** Shared reading column so every block lines up on one measure. */
const COLUMN = 'mx-auto w-full max-w-3xl px-4'

export function PageRenderer({ page, showCTA = true }: PageRendererProps) {
  const blocks = page.blocks || []

  // Determine if we have any headers to render
  const hasAnyHeader = page.header1 || page.header2 || page.header3

  // Render header based on position
  const renderHeader = (content: string | null, position: string | undefined, size: 'large' | 'medium' | 'small') => {
    if (!content || position === 'hidden') return null

    const sizeClasses = {
      large: 'font-display text-3xl sm:text-[2.125rem] font-semibold tracking-tight',
      medium: 'font-display text-2xl sm:text-[1.75rem] font-semibold tracking-tight',
      small: 'text-lg sm:text-xl font-semibold',
    }

    return (
      <section className={cn(COLUMN, 'py-6 sm:py-8')}>
        <h2 className={cn('text-balance text-foreground', sizeClasses[size])}>
          {content}
        </h2>
      </section>
    )
  }

  return (
    <article className="w-full pb-16 pt-8 sm:pt-12">
      {/* Cover Image - Display at top if available */}
      {page.cover_image_url && (
        <section className="mx-auto mb-8 w-full max-w-4xl px-4">
          <div className="relative h-56 w-full overflow-hidden rounded-xl border border-border bg-muted shadow-xs sm:h-96">
            <Image
              src={page.cover_image_url}
              alt={page.title}
              fill
              className="object-cover"
              priority
            />
          </div>
        </section>
      )}

      {/* Headers positioned BEFORE blocks - render regardless of blocks */}
      {page.header1_position === 'before' && renderHeader(page.header1, 'before', 'large')}
      {page.header2_position === 'before' && renderHeader(page.header2, 'before', 'medium')}
      {page.header3_position === 'before' && renderHeader(page.header3, 'before', 'small')}

      {/* Body Content Blocks */}
      {blocks.length === 0 && !hasAnyHeader ? (
        <section className={COLUMN}>
          <div className="rounded-xl border border-dashed border-border-strong p-10 text-center">
            <p className="text-sm text-muted-foreground">No content available for this page.</p>
          </div>
        </section>
      ) : (
        <div>
          {blocks.map((block) => (
            <RenderBlock key={block.id} block={block} />
          ))}
        </div>
      )}

      {/* Headers positioned AFTER blocks - render regardless of blocks */}
      {page.header1_position === 'after' && renderHeader(page.header1, 'after', 'large')}
      {page.header2_position === 'after' && renderHeader(page.header2, 'after', 'medium')}
      {page.header3_position === 'after' && renderHeader(page.header3, 'after', 'small')}

      {/* Optional Subtitle Section - Only show if description exists */}
      {page.description && (
        <section className={cn(COLUMN, 'py-6 sm:py-8')}>
          <p className="border-t border-border pt-6 font-serif text-[1.0625rem] italic leading-relaxed text-muted-foreground">
            {page.description}
          </p>
        </section>
      )}

      {/* Call to action footer - matches About page */}
      {showCTA && (
        <section className={cn(COLUMN, 'py-6 sm:py-8')}>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/dashboard">
                Go to Dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      )}
    </article>
  )
}

interface RenderBlockProps {
  block: PageBlock
}

function RenderBlock({ block }: RenderBlockProps) {
  // Parse metadata if it's a string
  const metadata = typeof block.metadata === 'string' ? JSON.parse(block.metadata || '{}') : (block.metadata || {})

  switch (block.block_type) {
    case 'text': {
      const format = metadata.format
      const size = metadata.size

      // Special format: header section (welcome section with h1 + 2 paragraphs)
      if (format === 'header_section') {
        const lines = (block.content || '').split('\n\n').filter(Boolean)
        const [h1, p1, p2] = lines

        return (
          <section className={cn(COLUMN, 'pb-4')}>
            <PageHeader title={h1} description={p1} className="mb-4" />
            {p2 && (
              <p className="max-w-2xl text-pretty text-[15px] leading-relaxed text-muted-foreground">
                {p2}
              </p>
            )}
          </section>
        )
      }

      // Special format: prose section (multiple paragraphs)
      if (format === 'prose_section') {
        return (
          <section className={cn(COLUMN, 'py-4 sm:py-6')}>
            <div className="rich-text">
              {(block.content || '').split('\n\n').map((paragraph, idx) => (
                <p key={idx}>{paragraph}</p>
              ))}
            </div>
          </section>
        )
      }

      // Size-based text rendering (for backward compatibility)
      if (size === 'large') {
        return (
          <section className={cn(COLUMN, 'py-6 sm:py-8')}>
            <h2 className="text-balance font-display text-3xl font-semibold tracking-tight sm:text-[2.125rem]">
              {block.content}
            </h2>
          </section>
        )
      } else if (size === 'medium') {
        return (
          <section className={cn(COLUMN, 'py-3')}>
            <p className="text-pretty text-lg font-medium leading-relaxed text-foreground">
              {block.content}
            </p>
          </section>
        )
      } else if (size === 'small') {
        return (
          <section className={cn(COLUMN, 'py-3')}>
            <p className="text-pretty text-[15px] leading-relaxed text-muted-foreground">
              {block.content}
            </p>
          </section>
        )
      } else {
        // Default text rendering with Markdown support
        return (
          <section className={cn(COLUMN, 'py-4 sm:py-6')}>
            <div className="rich-text">
              <Markdown
                components={{
                  h3: ({ children }) => (
                    <h3 className="text-center">{children}</h3>
                  ),
                }}
              >
                {block.content || ''}
              </Markdown>
            </div>
          </section>
        )
      }
    }

    case 'image': {
      const containerClass = metadata.containerClass || 'py-6 sm:py-8'
      const imageClass = metadata.className || 'w-full rounded-xl border border-border shadow-xs'
      const sectionClass = metadata.section || ''

      return (
        <section className={sectionClass}>
          <div className={`${COLUMN} ${containerClass}`}>
            <img
              src={block.content || ''}
              alt={metadata.alt || 'Page image'}
              className={imageClass}
              style={metadata.style}
            />
          </div>
        </section>
      )
    }

    case 'cta': {
      const containerClass = metadata.containerClass || 'py-6 sm:py-8'
      const sectionClass = metadata.section || ''
      const href = metadata.href || '#'

      return (
        <section className={sectionClass}>
          <div className={`${COLUMN} ${containerClass}`}>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href={href}>
                  {block.content}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      )
    }

    default:
      return null
  }
}
