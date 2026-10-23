import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { requireUser } from '@/lib/auth-server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadFullCurriculum, type CurriculumItem } from '@/lib/curriculum-tree'

export const dynamic = 'force-dynamic'

const DATE = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

type ReflectionRow = { content_id: string; response: string; submitted_at: string }

/**
 * "My reflections": everything the fellow has written, in curriculum
 * order, with the prompt and a link back to edit it.
 */
export default async function MyReflectionsPage() {
  const user = await requireUser()
  const curriculum = await loadFullCurriculum()

  // Reflections are owner-only under RLS. In "Preview as a fellow" the
  // signed-in account is the admin, so read the previewed fellow's rows
  // with the service role (getCurrentUser only grants preview to admins).
  const hasRealId = user.id !== '__preview__'
  const client = user.preview ? createAdminClient() : await createClient()
  const { data: rows } = hasRealId
    ? await client
        .from('user_content_reflections')
        .select('content_id, response, submitted_at')
        .eq('profile_id', user.id)
        .returns<ReflectionRow[]>()
    : { data: [] as ReflectionRow[] }
  const byItem = new Map((rows ?? []).map((r) => [r.content_id, r]))

  const ids = [...byItem.keys()]
  const { data: prompts } = ids.length
    ? await client.from('labs').select('id, reflection_prompt').in('id', ids)
    : { data: [] as Array<{ id: string; reflection_prompt: string | null }> }
  const promptById = new Map((prompts ?? []).map((p) => [p.id, p.reflection_prompt]))

  // Walk the curriculum so reflections read in program order; anything
  // no longer in the fellow's curriculum is left out.
  const sections = curriculum.phases
    .map((phase) => ({
      title: phase.title,
      modules: phase.modules
        .map((module) => ({
          title: module.title,
          entries: module.items
            .filter((item) => byItem.has(item.id))
            .map((item) => ({ item, reflection: byItem.get(item.id)! })),
        }))
        .filter((m) => m.entries.length > 0),
    }))
    .filter((p) => p.modules.length > 0)
  const count = sections.reduce((n, p) => n + p.modules.reduce((k, m) => k + m.entries.length, 0), 0)

  return (
    <div className="space-y-8">
      <PageHeader
        className="mb-0"
        title="My reflections"
        description={
          count
            ? `${count} reflection${count === 1 ? '' : 's'}, in program order. Open one to edit it.`
            : 'Reflections you write on curriculum items will collect here.'
        }
      />

      {count === 0 && (
        <p className="rounded-md border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
          You haven&rsquo;t written any reflections yet.
        </p>
      )}

      {sections.map((phase) => (
        <section key={phase.title} aria-label={phase.title} className="space-y-4">
          {sections.length > 1 && <h2 className="font-serif text-xl">{phase.title}</h2>}
          {phase.modules.map((module) => (
            <div key={module.title} className="space-y-2">
              <h3 className="eyebrow">{module.title}</h3>
              {module.entries.map(({ item, reflection }) => (
                <ReflectionCard
                  key={item.id}
                  item={item}
                  prompt={promptById.get(item.id) ?? null}
                  response={reflection.response}
                  submittedAt={reflection.submitted_at}
                />
              ))}
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}

function ReflectionCard({
  item,
  prompt,
  response,
  submittedAt,
}: {
  item: CurriculumItem
  prompt: string | null
  response: string
  submittedAt: string
}) {
  return (
    <Card className="gap-0 py-0">
      <CardContent className="space-y-3 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="text-sm font-semibold text-foreground">{item.title}</p>
          <p className="text-xs text-muted-foreground">{DATE.format(new Date(submittedAt))}</p>
        </div>
        {prompt?.trim() && <p className="text-xs italic text-muted-foreground">{prompt.trim()}</p>}
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{response}</p>
        <Link
          href={item.href}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Open to edit
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </CardContent>
    </Card>
  )
}
