import Link from 'next/link'
import { Pencil } from 'lucide-react'
import { requireUser } from '@/lib/auth-server'
import { StandalonePageTemplate } from '@/components/custom-pages/standalone-page-template'
import { getAdminPageContent } from '@/app/admin/actions'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/page-header'

// Skip prerendering since this page requires authentication
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'WaW Fellowship | Wisdom at Work',
  description:
    'Welcome to the Wisdom at Work Fellowship Portal - your dashboard for the WAW Syllabus, Learning Journals, and Additional Resources.',
}

interface ContentBlock {
  id: string
  block_type: 'text' | 'image' | 'text_image'
  title: string | null
  content: string
  image_url: string | null
  image_alt: string | null
}

function renderContentBlock(block: ContentBlock) {
  switch (block.block_type) {
    case 'text':
      return (
        <div key={block.id} className="rich-text">
          {block.title && <h3>{block.title}</h3>}
          <p>{block.content}</p>
        </div>
      )
    case 'image':
      return (
        <figure key={block.id}>
          <img
            src={block.image_url || ''}
            alt={block.image_alt || 'Content image'}
            className="w-full rounded-xl border border-border shadow-xs"
          />
        </figure>
      )
    case 'text_image':
      return (
        <div key={block.id} className="grid items-center gap-6 md:grid-cols-2">
          <div className="rich-text">
            {block.title && <h3>{block.title}</h3>}
            <p>{block.content}</p>
          </div>
          <img
            src={block.image_url || ''}
            alt={block.image_alt || 'Content image'}
            className="w-full rounded-xl border border-border shadow-xs"
          />
        </div>
      )
    default:
      return null
  }
}

export default async function AboutPage() {
  await requireUser()

  // Fetch editable body content blocks
  const bodyContent = await getAdminPageContent('about', 'body')

  // Show edit features only if user is admin (indicated by successful fetch)
  const isAdmin = bodyContent.ok
  const blocks: ContentBlock[] = bodyContent.ok ? bodyContent.data : []

  return (
    <StandalonePageTemplate>
      <article className="mx-auto w-full max-w-3xl space-y-10 px-4 pb-16 pt-10 sm:pt-14">
        {/* Welcome header section */}
        <PageHeader
          className="mb-0"
          eyebrow="About the Fellowship"
          title={"Welcome to the Wisdom at Work Fellows' Portal"}
          description={
            <>
              <span className="block text-lg font-medium text-foreground">
                Congratulations and welcome to the{' '}
                <Link
                  href="#"
                  className="text-primary underline decoration-primary/30 underline-offset-[3px] hover:decoration-primary"
                >
                  Wisdom at Work Fellowship
                </Link>
                !
              </span>
              <span className="mt-2 block">
                This site is your dashboard for the WAW Syllabus, Learning Journals, Additional Resources.
              </span>
            </>
          }
          actions={
            /* Edit link - only show to admins */
            isAdmin ? (
              <Button asChild variant="outline" size="sm">
                <a href="/admin/about">
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  Edit Page
                </a>
              </Button>
            ) : undefined
          }
        />

        {/* Team discussion image */}
        <figure>
          <img
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-f3pmyp3Y4Su3IunOJebJvDjlTXdzRP.png"
            alt="Wisdom at Work Fellows in collaborative discussion"
            className="w-full rounded-xl border border-border shadow-xs"
          />
        </figure>

        {/* Editable body content blocks */}
        {blocks.length > 0 && (
          <section className="space-y-10">
            {blocks.map(block => renderContentBlock(block))}
          </section>
        )}

        {/* Curriculum structure section */}
        <figure>
          <img
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-b8MnjRcwfx4lrP2uHyE4GYgMWOaAas.png"
            alt="Wisdom at Work Three-Year Curriculum Structure"
            className="w-full rounded-xl border border-border shadow-xs"
          />
        </figure>

        {/* Foundation attribution section */}
        <section className="rounded-xl border border-border bg-card p-6 shadow-xs">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:gap-8">
            <p className="text-sm italic leading-relaxed text-muted-foreground sm:w-1/2">
              This project was made possible through the support of Grant 63617 from the John Templeton Foundation. The opinions expressed in this project are those of the grantee and do not necessarily reflect the views of the John Templeton Foundation.
            </p>
            <div className="text-center sm:w-1/2">
              <img
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-kCoiFTogFnqrrOloeNsvOSi9SOMEDN.png"
                alt="John Templeton Foundation"
                className="inline-block h-32 w-auto sm:h-40"
              />
            </div>
          </div>
        </section>
      </article>
    </StandalonePageTemplate>
  )
}
