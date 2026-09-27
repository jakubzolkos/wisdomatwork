'use client'

import { useState, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import Markdown from 'react-markdown'
import { Plus, Trash2, Upload, GripVertical, Eye, EyeOff, AlertCircle, Link as LinkIcon, Copy, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { CustomPage, PageBlock, PageImage, PageBlockType } from '@/lib/custom-pages/types'

interface PageEditorProps {
  page: CustomPage
  availableImages: PageImage[]
  onSave: (page: Partial<CustomPage>) => Promise<void>
  onPublish: (published: boolean) => Promise<void>
  isSaving?: boolean
  isUploading?: boolean
  isPublished?: boolean
}

export function PageEditor({
  page,
  availableImages,
  onSave,
  onPublish,
  isSaving = false,
  isUploading = false,
  isPublished = false,
}: PageEditorProps) {
  const [title, setTitle] = useState(page.title)
  const [slug, setSlug] = useState(page.slug)
  const [description, setDescription] = useState(page.description || '')
  const [header1, setHeader1] = useState(page.header1 || '')
  const [header1Position, setHeader1Position] = useState<any>(page.header1_position || 'before')
  const [header2, setHeader2] = useState(page.header2 || '')
  const [header2Position, setHeader2Position] = useState<any>(page.header2_position || 'before')
  const [header3, setHeader3] = useState(page.header3 || '')
  const [header3Position, setHeader3Position] = useState<any>(page.header3_position || 'before')
  const [showInMenu, setShowInMenu] = useState(page.show_in_menu ?? true)
  const [blocks, setBlocks] = useState<PageBlock[]>(page.blocks || [])
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [showImageDialog, setShowImageDialog] = useState(false)
  const [selectedImageForAdd, setSelectedImageForAdd] = useState<string | null>(null)

  // Track if there are unsaved changes
  useEffect(() => {
    // If we just saved, don't immediately show unsaved changes
    // This gives the parent component time to update the page prop
    if (justSaved) {
      setJustSaved(false)
      return
    }

    // Normalize blocks for comparison - exclude fields that change during save
    const normalizeBlock = (block: PageBlock) => {
      return {
        block_type: block.block_type,
        order_number: block.order_number,
        title: block.title || null,
        content: block.content || null,
        metadata: block.metadata || null,
        image_id: block.image_id || null,
      }
    }

    const currentBlocks = JSON.stringify(blocks.map(normalizeBlock))
    const savedBlocks = JSON.stringify((page.blocks || []).map(normalizeBlock))

    const hasChanges =
      title !== page.title ||
      slug !== page.slug ||
      description !== (page.description || '') ||
      header1 !== (page.header1 || '') ||
      header2 !== (page.header2 || '') ||
      header3 !== (page.header3 || '') ||
      showInMenu !== (page.show_in_menu ?? true) ||
      currentBlocks !== savedBlocks

    setHasUnsavedChanges(hasChanges)
  }, [title, slug, description, header1, header2, header3, showInMenu, blocks, page, justSaved])

  const addBlock = (type: PageBlockType) => {
    const newBlock: PageBlock = {
      id: `block-${Date.now()}`,
      page_id: page.id,
      block_type: type,
      order_number: blocks.length,
      title: null,
      content: null,
      metadata: null,
      image_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    setBlocks([...blocks, newBlock])
  }

  const handleAddImageBlock = () => {
    if (selectedImageForAdd) {
      const newBlock: PageBlock = {
        id: `block-${Date.now()}`,
        page_id: page.id,
        block_type: 'image',
        order_number: blocks.length,
        title: null,
        content: null,
        metadata: null,
        image_id: selectedImageForAdd,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      setBlocks([...blocks, newBlock])
      setShowImageDialog(false)
      setSelectedImageForAdd(null)
    }
  }

  const removeBlock = (blockId: string) => {
    setBlocks(blocks.filter((b) => b.id !== blockId))
  }

  const updateBlock = (blockId: string, updates: Partial<PageBlock>) => {
    setBlocks(
      blocks.map((b) =>
        b.id === blockId
          ? { ...b, ...updates, updated_at: new Date().toISOString() }
          : b
      )
    )
  }

  const onDragEnd = (result: any) => {
    const { source, destination } = result
    if (!destination) return

    const newBlocks = Array.from(blocks)
    const [movedBlock] = newBlocks.splice(source.index, 1)
    newBlocks.splice(destination.index, 0, movedBlock)

    // Update order numbers
    const reordered = newBlocks.map((b, i) => ({ ...b, order_number: i }))
    setBlocks(reordered)
  }

  const handleSave = async () => {
    // Prepare blocks with image URLs populated in content field for image blocks
    const blocksWithImageContent = blocks.map((block) => {
      if (block.block_type === 'image' && block.image_id) {
        const image = getSelectedImage(block.image_id)
        return {
          ...block,
          content: image?.url || block.content,
        }
      }
      return block
    })

    // Set flag to skip change detection on next render
    setJustSaved(true)
    
    await onSave({
      title,
      slug,
      description,
      header1,
      header1_position: header1Position,
      header2,
      header2_position: header2Position,
      header3,
      header3_position: header3Position,
      show_in_menu: showInMenu,
      blocks: blocksWithImageContent,
    })
  }

  const getSelectedImage = (imageId: string | null) => {
    if (!imageId) return null
    return availableImages.find((img) => img.id === imageId)
  }

  const copyPageUrl = async () => {
    if (!page.id || !slug) {
      alert('Page must be saved before copying URL')
      return
    }

    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://practicalwisdomproject.org'
    const fullUrl = `${baseUrl}/pages/${slug}`

    try {
      await navigator.clipboard.writeText(fullUrl)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    } catch (err) {
      // Fallback: show URL in prompt if clipboard fails
      prompt('Copy this URL:', fullUrl)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header Section */}
      <Card>
        <CardHeader>
          <CardTitle>Page Details</CardTitle>
          <CardDescription>Edit page metadata and content blocks</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Page title"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">URL Slug</label>
            <div className="flex gap-2">
              <span className="flex items-center px-3 bg-muted rounded-md text-sm text-muted-foreground">
                /pages/
              </span>
              <Input
                value={slug}
                onChange={(e) =>
                  setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))
                }
                placeholder="page-slug"
                className="flex-1"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description for this page"
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background shadow-xs transition-[color,box-shadow] focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </div>

          {/* Headers Section */}
          <div className="border-t pt-5">
            <h3 className="mb-1 text-sm font-semibold">Page Headers (optional)</h3>
            <p className="text-xs text-muted-foreground mb-3">Add up to 3 headers with different sizes. Choose where each appears.</p>
            
            <div>
              <label className="mb-2 block text-sm font-medium">Header 1 (Largest)</label>
              <Input
                value={header1}
                onChange={(e) => setHeader1(e.target.value)}
                placeholder="Main header - largest size"
              />
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Position:</span>
                <select
                  value={header1Position}
                  onChange={(e) => setHeader1Position(e.target.value)}
                  className="h-8 px-2 text-sm rounded-md border border-input bg-background shadow-xs transition-[color,box-shadow] focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <option value="before">Before blocks</option>
                  <option value="after">After blocks</option>
                  <option value="hidden">Hidden</option>
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium">Header 2 (Medium)</label>
              <Input
                value={header2}
                onChange={(e) => setHeader2(e.target.value)}
                placeholder="Secondary header - medium size"
              />
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Position:</span>
                <select
                  value={header2Position}
                  onChange={(e) => setHeader2Position(e.target.value)}
                  className="h-8 px-2 text-sm rounded-md border border-input bg-background shadow-xs transition-[color,box-shadow] focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <option value="before">Before blocks</option>
                  <option value="after">After blocks</option>
                  <option value="hidden">Hidden</option>
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium">Header 3 (Small)</label>
              <Input
                value={header3}
                onChange={(e) => setHeader3(e.target.value)}
                placeholder="Tertiary header - small size"
              />
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Position:</span>
                <select
                  value={header3Position}
                  onChange={(e) => setHeader3Position(e.target.value)}
                  className="h-8 px-2 text-sm rounded-md border border-input bg-background shadow-xs transition-[color,box-shadow] focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <option value="before">Before blocks</option>
                  <option value="after">After blocks</option>
                  <option value="hidden">Hidden</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-lg bg-muted/60 p-4">
            <input
              type="checkbox"
              id="show_in_menu"
              checked={showInMenu}
              onChange={(e) => setShowInMenu(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <label htmlFor="show_in_menu" className="flex-1 cursor-pointer">
              <div className="font-medium text-sm">Add to Navigation Menu</div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {showInMenu
                  ? 'This page will appear in the main navigation menu'
                  : 'This page will be hidden from the menu (still accessible via direct link)'}
              </p>
            </label>
          </div>

          {!page.id && (
            <Alert className="mt-4 bg-primary-soft border-primary/30">
              <AlertDescription className="text-primary">
                Save your page as a draft first before publishing
              </AlertDescription>
            </Alert>
          )}

          {hasUnsavedChanges && page.id && (
            <Alert className="mt-4 bg-warning-soft border-warning/30">
              <AlertCircle className="h-4 w-4 inline mr-2 text-warning" />
              <AlertDescription className="text-warning">
                You have unsaved changes. Save to enable publishing these updates.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleSave}
              disabled={isSaving || isUploading || !hasUnsavedChanges}
              variant={hasUnsavedChanges ? 'default' : 'outline'}
              className="flex-1"
            >
              {isSaving ? 'Saving...' : 'Save Draft'}
            </Button>
            <Button
              variant={isPublished ? 'secondary' : 'default'}
              onClick={() => onPublish(!isPublished)}
              disabled={!page.id || isSaving || isUploading || hasUnsavedChanges}
              className="gap-2"
            >
              {isPublished ? (
                <>
                  <EyeOff className="h-4 w-4" />
                  Unpublish
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4" />
                  Publish
                </>
              )}
            </Button>
            {page.id && (
              <Button
                onClick={copyPageUrl}
                variant="outline"
                size="icon"
                title="Copy page URL"
                className="gap-2"
              >
                {linkCopied ? (
                  <Copy className="h-4 w-4" />
                ) : (
                  <LinkIcon className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Content Blocks */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Content Blocks</CardTitle>
            <CardDescription>
              Add and arrange content blocks for your page
            </CardDescription>
          </div>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => addBlock('text')}
              className="gap-1"
            >
              <Plus className="h-4 w-4" />
              Text
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowImageDialog(true)}
              className="gap-1"
            >
              <Plus className="h-4 w-4" />
              Image
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {blocks.length === 0 ? (
            <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
              No content blocks yet. Add one to get started.
            </p>
          ) : (
            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="blocks">
                {(provided, snapshot) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className="space-y-3"
                  >
                    {blocks.map((block, index) => (
                      <Draggable key={block.id} draggableId={block.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`p-4 border rounded-lg transition ${
                              snapshot.isDragging ? 'bg-accent shadow-md' : 'bg-card'
                            }`}
                          >
                            {/* Block Header */}
                            <div className="flex items-center gap-2 mb-3">
                              <span
                                {...provided.dragHandleProps}
                                className="text-muted-foreground hover:text-foreground"
                              >
                                <GripVertical className="h-4 w-4" />
                              </span>
                              <Badge variant="outline">
                                {block.block_type.charAt(0).toUpperCase() +
                                  block.block_type.slice(1)}
                              </Badge>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => removeBlock(block.id)}
                                className="ml-auto text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>

                            {/* Block Content */}
                            <div className="space-y-3">
                              {block.block_type === 'text' && (
                                <>
                                  <div>
                                    <label className="mb-1.5 block text-xs font-medium">
                                      Content
                                    </label>
                                    <textarea
                                      value={block.content || ''}
                                      onChange={(e) =>
                                        updateBlock(block.id, { content: e.target.value })
                                      }
                                      placeholder="Enter text content (supports Markdown: # Heading, **bold**, - lists, etc.)"
                                      rows={3}
                                      className="w-full px-3 py-2 font-mono text-xs rounded-md border border-input bg-background shadow-xs transition-[color,box-shadow] focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                                    />
                                    {block.content && (
                                      <div className="mt-2 p-2 bg-muted rounded text-xs border border-border">
                                        <p className="font-semibold text-foreground mb-1">Preview:</p>
                                        <div className="prose prose-sm prose-neutral max-w-none text-xs">
                                          <Markdown
                                            components={{
                                              h3: ({ children }) => (
                                                <h3 className="text-center">{children}</h3>
                                              ),
                                            }}
                                          >
                                            {block.content}
                                          </Markdown>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </>
                              )}

                              {block.block_type === 'image' && (
                                <div>
                                  <label className="mb-1.5 block text-xs font-medium">
                                    Image
                                  </label>
                                  <Select
                                    value={block.image_id || ''}
                                    onValueChange={(imageId) =>
                                      updateBlock(block.id, { image_id: imageId })
                                    }
                                  >
                                    <SelectTrigger size="sm">
                                      <SelectValue placeholder="Select an image..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {availableImages.map((img) => (
                                        <SelectItem key={img.id} value={img.id}>
                                          {img.filename}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  {block.image_id && getSelectedImage(block.image_id) && (
                                    <div className="mt-2">
                                      <img
                                        src={getSelectedImage(block.image_id)!.url}
                                        alt="Block preview"
                                        className="max-h-40 rounded border"
                                      />
                                    </div>
                                  )}
                                </div>
                              )}
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
          )}
        </CardContent>
      </Card>

      {/* Image Selection Dialog */}
      <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select Image for Page Block</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Image Library */}
            <div>
              <h3 className="font-semibold text-sm mb-3">Image Library</h3>
              {availableImages.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No images uploaded yet. Upload an image first.
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
                  {availableImages.map((img) => (
                    <div
                      key={img.id}
                      onClick={() => setSelectedImageForAdd(img.id)}
                      className={`cursor-pointer border-2 rounded-lg overflow-hidden transition ${
                        selectedImageForAdd === img.id
                          ? 'border-primary bg-primary-soft'
                          : 'border-border hover:border-border-strong'
                      }`}
                    >
                      <img
                        src={img.url}
                        alt={img.filename}
                        className="w-full h-32 object-cover"
                      />
                      <div className="p-2">
                        <p className="text-xs font-medium truncate">{img.filename}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Upload New Image */}
            <div className="pt-4 border-t">
              <h3 className="font-semibold text-sm mb-3">Upload New Image</h3>
              <p className="text-xs text-muted-foreground mb-2">
                Use the Image Gallery tab to upload a new image, then return here to select it.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setShowImageDialog(false)
                  setSelectedImageForAdd(null)
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddImageBlock}
                disabled={!selectedImageForAdd}
              >
                Add Image Block
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
