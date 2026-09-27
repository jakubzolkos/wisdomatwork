'use client'

import { useState, useTransition } from 'react'
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from '@hello-pangea/dnd'
import { Pencil, Plus, Trash2, GripVertical, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
import {
  createAdminPageContent,
  updateAdminPageContent,
  deleteAdminPageContent,
  reorderAdminPageContent,
} from '@/app/admin/actions'

interface AdminPageContentItem {
  id: string
  page_id: string
  slot_name: string
  order_index: number
  title: string | null
  content: string
  created_at: string
}

interface AdminPageContentSlotProps {
  pageId: string
  slotName: string
  items: AdminPageContentItem[]
  isEditMode: boolean
  isAdmin: boolean
}

export function AdminPageContentSlot({
  pageId,
  slotName,
  items,
  isEditMode,
  isAdmin,
}: AdminPageContentSlotProps) {
  const [localItems, setLocalItems] = useState(items)
  const [createOpen, setCreateOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [reordering, startReorder] = useTransition()

  const canEdit = isAdmin && isEditMode

  async function handleDragEnd(result: DropResult) {
    const { source, destination, draggableId } = result

    if (!destination) return
    if (source.index === destination.index) return

    // Optimistic update
    const newOrder = Array.from(localItems)
    const [movedItem] = newOrder.splice(source.index, 1)
    newOrder.splice(destination.index, 0, movedItem)
    setLocalItems(newOrder)

    // Server update
    startReorder(async () => {
      const orderedIds = newOrder.map(item => item.id)
      const res = await reorderAdminPageContent(pageId, slotName, orderedIds)
      if (!res.ok) {
        console.error('[v0] Reorder failed:', res.message)
        setLocalItems(items) // Revert on error
      }
    })
  }

  async function handleCreate(title: string, content: string) {
    const res = await createAdminPageContent({
      page_id: pageId,
      slot_name: slotName,
      title: title || undefined,
      content,
    })

    if (res.ok) {
      // Refresh items would require a server-side fetch, but revalidatePath is called
      setCreateOpen(false)
    } else {
      console.error('[v0] Create failed:', res.message)
    }
  }

  async function handleUpdate(id: string, title: string, content: string) {
    const res = await updateAdminPageContent(id, {
      title: title || undefined,
      content,
    })

    if (res.ok) {
      setEditingId(null)
      // Update local state optimistically
      setLocalItems(
        localItems.map(item =>
          item.id === id
            ? { ...item, title: title || null, content, updated_at: new Date().toISOString() }
            : item
        )
      )
    } else {
      console.error('[v0] Update failed:', res.message)
    }
  }

  async function handleDelete(id: string) {
    const res = await deleteAdminPageContent(id)

    if (res.ok) {
      setLocalItems(localItems.filter(item => item.id !== id))
    } else {
      console.error('[v0] Delete failed:', res.message)
    }
  }

  if (!canEdit && localItems.length === 0) {
    return null // Don't render empty slot when not in edit mode
  }

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground text-sm">{slotName}</h3>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="h-4 w-4" />
                Add block
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add content block</DialogTitle>
                <DialogDescription>Add a new editable text block to this slot.</DialogDescription>
              </DialogHeader>
              <CreateContentForm
                onSave={(title, content) => {
                  handleCreate(title, content)
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      )}

      {canEdit ? (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId={slotName} type="ADMIN_CONTENT">
            {(provided, snapshot) => (
              <ul
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`space-y-2 rounded-lg border border-dashed border-border p-3 transition-colors ${
                  snapshot.isDraggingOver ? 'bg-primary-soft/60' : ''
                }`}
              >
                {localItems.map((item, index) => (
                  <Draggable key={item.id} draggableId={item.id} index={index}>
                    {(provided, snapshot) => (
                      <li
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`flex items-start gap-2 rounded border border-border bg-card p-3 transition-colors ${
                          snapshot.isDragging ? 'bg-muted/50' : ''
                        }`}
                      >
                        <div
                          {...provided.dragHandleProps}
                          className="flex shrink-0 cursor-grab items-center text-muted-foreground active:cursor-grabbing"
                        >
                          <GripVertical className="h-4 w-4" />
                        </div>

                        <div className="min-w-0 flex-1 text-sm">
                          {item.title && <p className="font-medium text-foreground">{item.title}</p>}
                          <p className="line-clamp-2 text-muted-foreground">{item.content}</p>
                        </div>

                        <div className="flex shrink-0 items-center gap-1">
                          <Dialog
                            open={editingId === item.id}
                            onOpenChange={(open) => {
                              if (open) {
                                setEditTitle(item.title || '')
                                setEditContent(item.content)
                              }
                              setEditingId(open ? item.id : null)
                            }}
                          >
                            <DialogTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                aria-label="Edit"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Edit content block</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <label className="block text-sm font-medium text-foreground mb-1">
                                    Title (optional)
                                  </label>
                                  <Input
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    placeholder="Block title"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-foreground mb-1">
                                    Content
                                  </label>
                                  <Textarea
                                    value={editContent}
                                    onChange={(e) => setEditContent(e.target.value)}
                                    placeholder="Block content"
                                    className="min-h-24"
                                  />
                                </div>
                                <div className="flex gap-2 justify-end">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => setEditingId(null)}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    onClick={() => {
                                      handleUpdate(item.id, editTitle, editContent)
                                    }}
                                  >
                                    Save
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                aria-label="Delete"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete content block?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(item.id)}
                                  className="bg-destructive text-white hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </li>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </ul>
            )}
          </Droppable>
        </DragDropContext>
      ) : (
        // Display mode: render content without editing UI
        <div className="space-y-2">
          {localItems.map((item) => (
            <div key={item.id} className="rounded-lg border border-border bg-card p-4">
              {item.title && <p className="font-medium text-foreground mb-2">{item.title}</p>}
              <p className="text-sm text-foreground whitespace-pre-wrap">{item.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CreateContentForm({
  onSave,
}: {
  onSave: (title: string, content: string) => void
}) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Title (optional)
        </label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Block title"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Content</label>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Block content"
          className="min-h-24"
        />
      </div>
      <div className="flex gap-2 justify-end">
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setTitle('')
            setContent('')
          }}
        >
          Clear
        </Button>
        <Button
          onClick={() => {
            if (content.trim()) {
              onSave(title, content)
              setTitle('')
              setContent('')
            }
          }}
          disabled={!content.trim()}
        >
          Add block
        </Button>
      </div>
    </div>
  )
}
