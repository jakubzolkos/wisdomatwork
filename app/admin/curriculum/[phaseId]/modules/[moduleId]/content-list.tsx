'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from '@hello-pangea/dnd'
import {
  ExternalLink,
  FileText,
  Pencil,
  Plus,
  Trash2,
  GripVertical,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { CohortBadge } from '@/components/admin/cohort-access-field'
import { getResourceType, CONTENT_CATEGORIES, type ContentCategory } from '@/lib/curriculum'
import type { ContentRow } from './page'
import { ContentItemForm } from './content-item-form'
import { deleteContent, reorderContent } from '../../../actions'

interface Props {
  phaseId: string
  moduleId: string
  /** Raw module override; null means "inherit from phase". */
  moduleCohorts: string[] | null
  /** Pre-resolved cohort list a content item inherits when its own override is null. */
  moduleEffectiveCohorts: string[]
  items: ContentRow[]
}

/**
 * Flat list grouped by content category, with drag-to-reorder within each category.
 *
 * Uses react-beautiful-dnd for accessible drag-and-drop reordering. Each category
 * is a separate droppable zone so items can only be reordered within their category.
 * Cohort inheritance is now resolved through the module rather than the phase.
 */
export function ContentList({
  phaseId,
  moduleId,
  moduleCohorts,
  moduleEffectiveCohorts,
  items,
}: Props) {
  const [createOpen, setCreateOpen] = useState(false)
  const [reordering, startReorder] = useTransition()
  const router = useRouter()

  // Group items by category
  const itemsByCategory = new Map<ContentCategory, ContentRow[]>()
  for (const item of items) {
    if (!itemsByCategory.has(item.category)) {
      itemsByCategory.set(item.category, [])
    }
    itemsByCategory.get(item.category)!.push(item)
  }

  // Get categories in display order
  const categoriesInOrder = CONTENT_CATEGORIES.map(c => c.value as ContentCategory).filter(
    cat => itemsByCategory.has(cat)
  )

  async function handleDragEnd(result: DropResult) {
    const { source, destination, draggableId } = result

    // No drop zone or dropped in same place
    if (!destination) return
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return
    }

    const category = source.droppableId as ContentCategory
    const categoryItems = itemsByCategory.get(category) || []
    
    // Create new order by moving the item
    const newOrder = Array.from(categoryItems)
    const [movedItem] = newOrder.splice(source.index, 1)
    newOrder.splice(destination.index, 0, movedItem)

    // Optimistic update
    itemsByCategory.set(category, newOrder)

    // Server update
    startReorder(async () => {
      const orderedIds = newOrder.map(item => item.id)
      const res = await reorderContent(phaseId, moduleId, category, orderedIds)
      if (!res.ok) {
        console.error('[v0] Reorder failed:', res.message)
        router.refresh()
      }
    })
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-5">
        <div>
          <h2 className="text-base">Content</h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Every piece of fellow-facing content in this module, grouped by category and in display
            order. Drag items to reorder within their category.
          </p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4" />
              Add content
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add content</DialogTitle>
              <DialogDescription>
                Create a new content item in this module.
              </DialogDescription>
            </DialogHeader>
            <ContentItemForm
              phaseId={phaseId}
              moduleId={moduleId}
              moduleCohorts={moduleCohorts}
              moduleEffectiveCohorts={moduleEffectiveCohorts}
              onSaved={() => setCreateOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </header>

      {items.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted-foreground">
          No content yet. Click &ldquo;Add content&rdquo; to create the first
          item.
        </p>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          {categoriesInOrder.map(category => {
            const categoryItems = itemsByCategory.get(category) || []
            const categoryConfig = CONTENT_CATEGORIES.find(c => c.value === category)

            return (
              <div key={category} className="border-b border-border last:border-b-0">
                {/* Category Header */}
                <div className="bg-muted/50 px-5 py-3">
                  <h3 className="text-sm font-semibold text-foreground">
                    {categoryConfig?.label}
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {categoryConfig?.description}
                  </p>
                </div>

                {/* Droppable Zone for Category */}
                <Droppable droppableId={category} type="CONTENT">
                  {(provided, snapshot) => (
                    <ul
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`divide-y divide-border ${snapshot.isDraggingOver ? 'bg-primary-soft/60' : ''}`}
                    >
                      {categoryItems.map((item, index) => (
                        <Draggable
                          key={item.id}
                          draggableId={item.id}
                          index={index}
                          isDragDisabled={reordering}
                        >
                          {(provided, snapshot) => (
                            <li
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={`flex flex-wrap items-start gap-3 px-5 py-4 transition-colors ${
                                snapshot.isDragging
                                  ? 'bg-muted/50'
                                  : snapshot.isDragging
                                    ? 'bg-muted/30'
                                    : ''
                              }`}
                            >
                              {/* Drag Handle */}
                              <div
                                {...provided.dragHandleProps}
                                className="flex shrink-0 cursor-grab items-center text-muted-foreground hover:text-foreground active:cursor-grabbing"
                                aria-label="Drag to reorder"
                              >
                                <GripVertical className="h-5 w-5" />
                              </div>

                              <ContentRowItemContent
                                item={item}
                                phaseId={phaseId}
                                moduleId={moduleId}
                                moduleCohorts={moduleCohorts}
                                moduleEffectiveCohorts={moduleEffectiveCohorts}
                              />
                            </li>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </ul>
                  )}
                </Droppable>
              </div>
            )
          })}
        </DragDropContext>
      )}
    </section>
  )
}

function ContentRowItemContent({
  item,
  phaseId,
  moduleId,
  moduleCohorts,
  moduleEffectiveCohorts,
}: {
  item: ContentRow
  phaseId: string
  moduleId: string
  moduleCohorts: string[] | null
  moduleEffectiveCohorts: string[]
}) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [deleting, startDelete] = useTransition()
  const resource = getResourceType(item.resource_type)
  const inherits = item.cohorts === null

  function onDelete() {
    const fd = new FormData()
    fd.set('id', item.id)
    fd.set('phase_id', phaseId)
    fd.set('module_id', moduleId)
    startDelete(async () => {
      const res = await deleteContent(fd)
      if (res.ok) router.refresh()
    })
  }

  return (
    <>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {resource.label}
          </span>
          {inherits ? (
            <span
              className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-xs font-medium text-muted-foreground"
              title="Inherits cohort access from the module"
            >
              Inherits module
            </span>
          ) : (
            <CohortBadge cohorts={item.cohorts} />
          )}
        </div>
        <p className="mt-1 font-medium text-foreground">{item.title}</p>
        {item.description && (
          <p className="mt-0.5 line-clamp-2 max-w-2xl text-sm text-muted-foreground">
            {item.description}
          </p>
        )}
        {(item.url || item.body) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {item.url && (
              <span className="inline-flex items-center gap-1">
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
                Link attached
              </span>
            )}
            {item.body && (
              <span className="inline-flex items-center gap-1">
                <FileText className="h-3 w-3" aria-hidden="true" />
                Body content
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Edit content">
              <Pencil className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit content</DialogTitle>
              <DialogDescription>
                Update this content item. Changes are visible to fellows
                immediately.
              </DialogDescription>
            </DialogHeader>
            <ContentItemForm
              phaseId={phaseId}
              moduleId={moduleId}
              moduleCohorts={moduleCohorts}
              moduleEffectiveCohorts={moduleEffectiveCohorts}
              initial={{
                id: item.id,
                category: item.category,
                resource_type: item.resource_type,
                title: item.title,
                description: item.description ?? '',
                body: item.body ?? '',
                url: item.url ?? '',
                duration_minutes: item.duration_minutes,
                reflection_enabled: item.reflection_enabled,
                reflection_prompt: item.reflection_prompt,
                scheduled_at: item.scheduled_at,
                cohorts: item.cohorts,
              }}
              onSaved={() => setEditOpen(false)}
            />
            <DialogFooter className="mt-2">
              <DialogClose asChild>
                <Button type="button" variant="ghost">
                  Close
                </Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-destructive"
              aria-label="Delete content"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this content item?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently remove &ldquo;{item.title}&rdquo; from
                this module.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={onDelete}
                disabled={deleting}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  )
}
