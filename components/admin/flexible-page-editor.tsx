'use client'

import { useState, useTransition } from 'react'
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from '@hello-pangea/dnd'
import { Plus, Trash2, GripVertical, Image as ImageIcon, Type, Zap, Upload, Loader2 } from 'lucide-react'
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
  block_type: 'text' | 'image' | 'text_image'
  title: string | null
  content: string
  image_url: string | null
  image_alt: string | null
  created_at: string
}

interface FlexiblePageEditorProps {
  pageId: string
  slotName: string
  items: AdminPageContentItem[]
  isEditMode: boolean
}

type BlockType = 'text' | 'image' | 'text_image'

export function FlexiblePageEditor({
  pageId,
  slotName,
  items,
  isEditMode,
}: FlexiblePageEditorProps) {
  const [localItems, setLocalItems] = useState(items)
  const [createOpen, setCreateOpen] = useState(false)
  const [blockTypeToCreate, setBlockTypeToCreate] = useState<BlockType>('text')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editBlockType, setEditBlockType] = useState<BlockType>('text')
  const [editContent, setEditContent] = useState('')
  const [editImageUrl, setEditImageUrl] = useState('')
  const [editImageAlt, setEditImageAlt] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [newImageUrl, setNewImageUrl] = useState('')
  const [newImageAlt, setNewImageAlt] = useState('')
  const [newImagePreview, setNewImagePreview] = useState<string | null>(null)
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null)
  const [newImageUploading, setNewImageUploading] = useState(false)
  const [editImageUploading, setEditImageUploading] = useState(false)
  const [reordering, startReorder] = useTransition()

  async function uploadImage(file: File, isEdit = false) {
    try {
      if (isEdit) {
        setEditImageUploading(true)
      } else {
        setNewImageUploading(true)
      }

      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/admin/upload-image', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Upload failed')
      }

      const { url } = await res.json()

      if (isEdit) {
        setEditImageUrl(url)
        setEditImagePreview(url)
      } else {
        setNewImageUrl(url)
        setNewImagePreview(url)
      }
    } catch (error) {
      alert(`Image upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      if (isEdit) {
        setEditImageUploading(false)
      } else {
        setNewImageUploading(false)
      }
    }
  }

  async function handleDragEnd(result: DropResult) {
    const { source, destination } = result

    if (!destination) return
    if (source.index === destination.index) return

    const newOrder = Array.from(localItems)
    const [movedItem] = newOrder.splice(source.index, 1)
    newOrder.splice(destination.index, 0, movedItem)
    setLocalItems(newOrder)

    startReorder(async () => {
      const orderedIds = newOrder.map(item => item.id)
      const res = await reorderAdminPageContent(pageId, slotName, orderedIds)
      if (!res.ok) {
        console.error('[v0] Reorder failed:', res.message)
        setLocalItems(items)
      }
    })
  }

  async function handleCreate() {
    if (!newContent.trim()) {
      alert('Content is required')
      return
    }

    const res = await createAdminPageContent({
      page_id: pageId,
      slot_name: slotName,
      block_type: blockTypeToCreate,
      title: newTitle || undefined,
      content: newContent,
      image_url: blockTypeToCreate !== 'text' ? newImageUrl || undefined : undefined,
      image_alt: blockTypeToCreate !== 'text' ? newImageAlt || undefined : undefined,
    })

    if (res.ok) {
      setNewTitle('')
      setNewContent('')
      setNewImageUrl('')
      setNewImageAlt('')
      setCreateOpen(false)
      // Refetch items
      window.location.reload()
    } else {
      alert(`Failed to create block: ${res.message}`)
    }
  }

  async function handleUpdate() {
    const item = localItems.find(i => i.id === editingId)
    if (!item) return

    const res = await updateAdminPageContent(editingId!, {
      block_type: editBlockType,
      title: editTitle || undefined,
      content: editContent,
      image_url: editBlockType !== 'text' ? editImageUrl || undefined : undefined,
      image_alt: editBlockType !== 'text' ? editImageAlt || undefined : undefined,
    })

    if (res.ok) {
      setEditingId(null)
      window.location.reload()
    } else {
      alert(`Failed to update block: ${res.message}`)
    }
  }

  async function handleDelete(id: string) {
    const res = await deleteAdminPageContent(id)
    if (res.ok) {
      window.location.reload()
    } else {
      alert(`Failed to delete block: ${res.message}`)
    }
  }

  function startEdit(item: AdminPageContentItem) {
    setEditingId(item.id)
    setEditBlockType(item.block_type)
    setEditTitle(item.title || '')
    setEditContent(item.content)
    setEditImageUrl(item.image_url || '')
    setEditImageAlt(item.image_alt || '')
  }

  function renderBlockPreview(item: AdminPageContentItem) {
    return (
      <div className="space-y-2">
        {item.title && <div className="font-semibold text-sm text-foreground">{item.title}</div>}
        {item.block_type !== 'image' && (
          <div className="text-sm text-muted-foreground line-clamp-2">{item.content}</div>
        )}
        {(item.block_type === 'image' || item.block_type === 'text_image') && item.image_url && (
          <div className="text-xs text-muted-foreground">Image: {item.image_url.split('/').pop()}</div>
        )}
      </div>
    )
  }

  if (!isEditMode) {
    return null
  }

  return (
    <div className="space-y-4">
      {/* Create new block */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline" className="gap-2">
            <Plus className="h-4 w-4" />
            Add Block
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Content Block</DialogTitle>
            <DialogDescription>Choose a block type and add your content</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Block type selector */}
            <div className="grid grid-cols-3 gap-2">
              {(['text', 'image', 'text_image'] as BlockType[]).map(type => (
                <button
                  key={type}
                  onClick={() => setBlockTypeToCreate(type)}
                  className={`p-3 rounded-lg border transition-colors flex flex-col items-center gap-2 ${
                    blockTypeToCreate === type
                      ? 'border-primary/40 bg-primary-soft text-primary'
                      : 'border-border hover:border-border-strong'
                  }`}
                >
                  {type === 'text' && <Type className="h-5 w-5" />}
                  {type === 'image' && <ImageIcon className="h-5 w-5" />}
                  {type === 'text_image' && <Zap className="h-5 w-5" />}
                  <span className="text-xs capitalize">{type.replace('_', ' + ')}</span>
                </button>
              ))}
            </div>

            {/* Title (optional) */}
            <div>
              <label className="text-sm font-medium">Title (optional)</label>
              <Input
                placeholder="Block title"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
              />
            </div>

            {/* Content */}
            {blockTypeToCreate !== 'image' && (
              <div>
                <label className="text-sm font-medium">Text Content</label>
                <Textarea
                  placeholder="Enter your text content"
                  value={newContent}
                  onChange={e => setNewContent(e.target.value)}
                  rows={4}
                />
              </div>
            )}

            {/* Image Upload */}
            {blockTypeToCreate !== 'text' && (
              <>
                <div>
                  <label className="text-sm font-medium block mb-2">Image</label>
                  <div className="flex gap-2">
                    <label className="flex-1">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
                        disabled={newImageUploading}
                        onChange={e => {
                          const file = e.currentTarget.files?.[0]
                          if (file) {
                            uploadImage(file, false)
                          }
                        }}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full cursor-pointer"
                        disabled={newImageUploading}
                        asChild
                      >
                        <span>
                          {newImageUploading ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Uploading...
                            </>
                          ) : (
                            <>
                              <Upload className="h-4 w-4 mr-2" />
                              Choose Image
                            </>
                          )}
                        </span>
                      </Button>
                    </label>
                  </div>
                  {newImagePreview && (
                    <div className="mt-2">
                      <img
                        src={newImagePreview}
                        alt="Preview"
                        className="w-full rounded-lg max-h-40 object-cover"
                      />
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium">Alt Text</label>
                  <Input
                    placeholder="Describe the image"
                    value={newImageAlt}
                    onChange={e => setNewImageAlt(e.target.value)}
                  />
                </div>
              </>
            )}

            <Button onClick={handleCreate} className="w-full">
              Create Block
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Drag-and-drop list */}
      {localItems.length > 0 ? (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="content-blocks">
            {(provided, snapshot) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className={`space-y-2 rounded-lg border border-dashed p-3 transition-colors ${
                  snapshot.isDraggingOver ? 'border-primary/40 bg-primary-soft/60' : 'border-border'
                }`}
              >
                {localItems.map((item, index) => (
                  <Draggable key={item.id} draggableId={item.id} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`flex items-center gap-3 rounded-lg border p-4 transition-all ${
                          snapshot.isDragging ? 'bg-accent shadow-md' : 'bg-card'
                        }`}
                      >
                        <div {...provided.dragHandleProps}>
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">{renderBlockPreview(item)}</div>
                        <div className="flex gap-2">
                          {/* Edit */}
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => startEdit(item)}
                              >
                                Edit
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Edit Content Block</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                {/* Block type selector */}
                                <div>
                                  <label className="text-sm font-medium mb-2 block">Block Type</label>
                                  <div className="grid grid-cols-3 gap-2">
                                    {(['text', 'image', 'text_image'] as BlockType[]).map(type => (
                                      <button
                                        key={type}
                                        onClick={() => setEditBlockType(type)}
                                        className={`p-3 rounded-lg border transition-colors flex flex-col items-center gap-2 ${
                                          editBlockType === type
                                            ? 'border-primary/40 bg-primary-soft text-primary'
                                            : 'border-border hover:border-border-strong'
                                        }`}
                                      >
                                        {type === 'text' && <Type className="h-5 w-5" />}
                                        {type === 'image' && <ImageIcon className="h-5 w-5" />}
                                        {type === 'text_image' && <Zap className="h-5 w-5" />}
                                        <span className="text-xs capitalize">{type.replace('_', ' + ')}</span>
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                {/* Title */}
                                <div>
                                  <label className="text-sm font-medium">Title (optional)</label>
                                  <Input
                                    value={editTitle}
                                    onChange={e => setEditTitle(e.target.value)}
                                  />
                                </div>

                                {/* Content */}
                                {editBlockType !== 'image' && (
                                  <div>
                                    <label className="text-sm font-medium">Text Content</label>
                                    <Textarea
                                      value={editContent}
                                      onChange={e => setEditContent(e.target.value)}
                                      rows={4}
                                    />
                                  </div>
                                )}

                                {/* Image Upload */}
                                {editBlockType !== 'text' && (
                                  <>
                                    <div>
                                      <label className="text-sm font-medium block mb-2">Image</label>
                                      <div className="flex gap-2">
                                        <label className="flex-1">
                                          <input
                                            type="file"
                                            accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
                                            disabled={editImageUploading}
                                            onChange={e => {
                                              const file = e.currentTarget.files?.[0]
                                              if (file) {
                                                uploadImage(file, true)
                                              }
                                            }}
                                            className="hidden"
                                          />
                                          <Button
                                            type="button"
                                            variant="outline"
                                            className="w-full cursor-pointer"
                                            disabled={editImageUploading}
                                            asChild
                                          >
                                            <span>
                                              {editImageUploading ? (
                                                <>
                                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                  Uploading...
                                                </>
                                              ) : (
                                                <>
                                                  <Upload className="h-4 w-4 mr-2" />
                                                  Choose Image
                                                </>
                                              )}
                                            </span>
                                          </Button>
                                        </label>
                                      </div>
                                      {(editImagePreview || editImageUrl) && (
                                        <div className="mt-2">
                                          <img
                                            src={editImagePreview || editImageUrl}
                                            alt="Preview"
                                            className="w-full rounded-lg max-h-40 object-cover"
                                          />
                                        </div>
                                      )}
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium">Alt Text</label>
                                      <Input
                                        value={editImageAlt}
                                        onChange={e => setEditImageAlt(e.target.value)}
                                      />
                                    </div>
                                  </>
                                )}

                                <Button onClick={handleUpdate} className="w-full">
                                  Update Block
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>

                          {/* Delete */}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Block</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive"
                                  onClick={() => handleDelete(item.id)}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted-foreground">No content blocks yet. Add one to get started!</p>
        </div>
      )}
    </div>
  )
}
