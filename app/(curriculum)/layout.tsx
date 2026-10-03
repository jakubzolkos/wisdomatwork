import { TopBar } from '@/components/top-bar'
import { CurriculumTree } from '@/components/curriculum/curriculum-tree'
import { CompletionStateProvider } from '@/components/curriculum/completion-state'
import { loadFullCurriculum } from '@/lib/curriculum-tree'
import { getMenuCustomPages } from '@/lib/custom-pages/menu'

export const dynamic = 'force-dynamic'

/**
 * Course-player chrome shared by every "browsing the curriculum"
 * route. The full Phase -> Module -> Content tree lives here as a
 * sticky left rail, while the active page renders into the right
 * pane via `{children}`.
 *
 * Route groups don't change URLs, so /dashboard and
 * /phases/.../items/... still resolve to their original paths -
 * nesting them inside this group just gives them a shared layout.
 *
 * Why a single shared layout instead of one per route:
 *   1. The tree is fetched once and reused across navigations.
 *   2. Next.js preserves layouts across sibling client navigations,
 *      so the CurriculumTree client component instance survives the
 *      transition from dashboard -> item view -> dashboard. Its
 *      open/closed state is therefore stable, mimicking the
 *      "click a row, only the right side updates" feel from the
 *      design brief.
 */
export default async function CurriculumLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [curriculum, customPages] = await Promise.all([
    loadFullCurriculum(),
    getMenuCustomPages(),
  ])

  return (
    <div className="min-h-screen bg-canvas">
      <TopBar customPages={customPages} />
      <CompletionStateProvider>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-8 lg:flex-row lg:items-start lg:gap-10">
        <aside
          aria-label="Course outline"
          // Sticky on lg+ so the tree stays in view while the right
          // pane scrolls. max-h tracks the viewport minus topbar
          // (h-16) and a bit of padding, with internal overflow so
          // long curricula scroll independently.
          className="w-full shrink-0 lg:sticky lg:top-20 lg:max-h-[calc(100vh-5rem)] lg:w-80 lg:overflow-y-auto xl:w-[22rem] lg:pr-2"
        >
          <CurriculumTree phases={curriculum.phases} />
        </aside>

        <main id="main" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
      </CompletionStateProvider>
    </div>
  )
}
