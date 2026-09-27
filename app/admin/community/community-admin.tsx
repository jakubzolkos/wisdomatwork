'use client'

import { useState, useTransition } from 'react'
import {
  CalendarDays,
  FileText,
  BookMarked,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Spinner } from '@/components/ui/spinner'
import {
  createEvent,
  createPost,
  createResource,
  deleteEvent,
  deletePost,
  deleteResource,
  togglePostPublished,
  type ActionResult,
} from './actions'
import { CohortAccessField, CohortBadge } from '@/components/admin/cohort-access-field'

type EventRow = {
  id: string
  title: string
  description: string | null
  starts_at: string
  ends_at: string | null
  location: string | null
  join_url: string | null
  created_at: string
}

type PostRow = {
  id: string
  kind: string
  title: string
  excerpt: string | null
  body: string | null
  media_url: string | null
  cover_url: string | null
  published_at: string | null
  created_at: string
}

type ResourceRow = {
  id: string
  title: string
  description: string | null
  url: string
  category: string | null
  cohorts: string[] | null
  created_at: string
}

/**
 * Top-level admin shell. Splits the three content types into their own
 * sections so each can own its own create dialog, list, and delete
 * confirmations without competing state.
 */
export function CommunityAdmin({
  events,
  posts,
  resources,
}: {
  events: EventRow[]
  posts: PostRow[]
  resources: ResourceRow[]
}) {
  return (
    <div className="flex flex-col gap-10">
      <EventsSection events={events} />
      <PostsSection posts={posts} />
      <ResourcesSection resources={resources} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// EVENTS
// ---------------------------------------------------------------------------
function EventsSection({ events }: { events: EventRow[] }) {
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader
        icon={<CalendarDays className="h-5 w-5 text-primary" />}
        title="Events"
        description="Live dates fellows can see and RSVP to."
        action={<AddEventDialog />}
      />

      {events.length === 0 ? (
        <Empty copy="No events yet." />
      ) : (
        <div className="grid gap-3">
          {events.map((ev) => (
            <EventCard key={ev.id} ev={ev} />
          ))}
        </div>
      )}
    </section>
  )
}

function EventCard({ ev }: { ev: EventRow }) {
  const start = new Date(ev.starts_at)
  const isPast = start.getTime() < Date.now()
  return (
    <Card className={isPast ? 'opacity-70' : undefined}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">{ev.title}</CardTitle>
            {isPast && (
              <Badge variant="secondary" className="text-[10px]">
                Past
              </Badge>
            )}
          </div>
          <CardDescription className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
            <span>{start.toLocaleString()}</span>
            {ev.location && <span>· {ev.location}</span>}
            {ev.join_url && (
              <a
                href={ev.join_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                Join link
              </a>
            )}
          </CardDescription>
          {ev.description && (
            <p className="pt-1 text-sm text-muted-foreground">{ev.description}</p>
          )}
        </div>
        <ConfirmDelete
          label="Delete event"
          title={ev.title}
          description="This removes the event from the community page. This cannot be undone."
          formId={ev.id}
          action={deleteEvent}
        />
      </CardHeader>
    </Card>
  )
}

function AddEventDialog() {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [err, setErr] = useState<string | null>(null)

  function onSubmit(fd: FormData) {
    setErr(null)
    startTransition(async () => {
      const r = await createEvent(fd)
      if (r.ok) setOpen(false)
      else setErr(r.message)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" />
          Add event
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form action={onSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>New event</DialogTitle>
            <DialogDescription>
              Shared with everyone in the program.
            </DialogDescription>
          </DialogHeader>

          <FormRow label="Title" htmlFor="ev-title">
            <Input id="ev-title" name="title" required />
          </FormRow>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormRow label="Starts" htmlFor="ev-starts">
              <Input id="ev-starts" name="starts_at" type="datetime-local" required />
            </FormRow>
            <FormRow label="Ends (optional)" htmlFor="ev-ends">
              <Input id="ev-ends" name="ends_at" type="datetime-local" />
            </FormRow>
          </div>

          <FormRow label="Location (optional)" htmlFor="ev-loc">
            <Input
              id="ev-loc"
              name="location"
              placeholder='"Zoom", "NYC office", etc.'
            />
          </FormRow>

          <FormRow label="Join / RSVP URL (optional)" htmlFor="ev-url">
            <Input id="ev-url" name="join_url" type="url" placeholder="https://" />
          </FormRow>

          <FormRow label="Description (optional)" htmlFor="ev-desc">
            <Textarea id="ev-desc" name="description" rows={3} />
          </FormRow>

          {err && (
            <p role="alert" className="text-sm text-destructive">
              {err}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Spinner className="h-4 w-4" />}
              Create event
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// POSTS
// ---------------------------------------------------------------------------
function PostsSection({ posts }: { posts: PostRow[] }) {
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader
        icon={<FileText className="h-5 w-5 text-primary" />}
        title="Posts & podcasts"
        description="Long-form reflections, stories, and episode notes."
        action={<AddPostDialog />}
      />

      {posts.length === 0 ? (
        <Empty copy="No posts yet." />
      ) : (
        <div className="grid gap-3">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      )}
    </section>
  )
}

/**
 * Display label for a post kind in the admin list. Falls back to the
 * raw kind for legacy values (`post`, `story`, `podcast`) so old rows
 * still read sensibly.
 */
function postKindLabel(kind: string): string {
  switch (kind) {
    case 'announcement':
      return "What's New?"
    case 'reflection':
      return 'Reflection'
    case 'win':
      return 'Win'
    case 'question':
      return 'Question'
    case 'podcast':
      return 'Podcast'
    case 'story':
      return 'Story'
    default:
      return 'Post'
  }
}

function PostCard({ post }: { post: PostRow }) {
  const [pending, startTransition] = useTransition()
  const kindLabel = postKindLabel(post.kind)
  const published = Boolean(post.published_at)

  function onToggle() {
    const fd = new FormData()
    fd.set('id', post.id)
    fd.set('publish', String(!published))
    startTransition(async () => {
      await togglePostPublished(fd)
    })
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <FileText className="h-3 w-3" />
              {kindLabel}
            </Badge>
            <Badge
              variant={published ? 'default' : 'outline'}
              className="text-[10px]"
            >
              {published ? 'Published' : 'Draft'}
            </Badge>
            <CardTitle className="text-base">{post.title}</CardTitle>
          </div>
          {post.excerpt && (
            <p className="text-sm text-muted-foreground">{post.excerpt}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onToggle}
            disabled={pending}
            aria-label={published ? 'Unpublish' : 'Publish'}
          >
            {pending ? (
              <Spinner className="h-4 w-4" />
            ) : published ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
            {published ? 'Unpublish' : 'Publish'}
          </Button>
          <ConfirmDelete
            label="Delete"
            title={post.title}
            description="This permanently removes the post. This cannot be undone."
            formId={post.id}
            action={deletePost}
          />
        </div>
      </CardHeader>
    </Card>
  )
}

type AdminPostKind = 'announcement' | 'reflection' | 'win' | 'question'

const ADMIN_KIND_OPTIONS: ReadonlyArray<{
  value: AdminPostKind
  label: string
  description: string
}> = [
  {
    value: 'announcement',
    label: "What's New?",
    description: 'Program updates and announcements.',
  },
  {
    value: 'reflection',
    label: 'Reflection',
    description: 'Stories and insights from practice.',
  },
  { value: 'win', label: 'Win', description: 'Celebrate progress.' },
  {
    value: 'question',
    label: 'Question',
    description: 'Open it up to the community.',
  },
]

function AddPostDialog() {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  const [kind, setKind] = useState<AdminPostKind>('announcement')

  function onSubmit(fd: FormData) {
    setErr(null)
    fd.set('kind', kind)
    startTransition(async () => {
      const r = await createPost(fd)
      if (r.ok) setOpen(false)
      else setErr(r.message)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" />
          Add post
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <form action={onSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>New post</DialogTitle>
            <DialogDescription>
              Pick which Community section this post belongs to. Save as a
              draft or publish immediately.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-2">
            {ADMIN_KIND_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                type="button"
                size="sm"
                variant={kind === opt.value ? 'default' : 'outline'}
                onClick={() => setKind(opt.value)}
              >
                <FileText className="h-4 w-4" />
                {opt.label}
              </Button>
            ))}
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">
            {ADMIN_KIND_OPTIONS.find((o) => o.value === kind)?.description}
          </p>

          <FormRow label="Title" htmlFor="post-title">
            <Input id="post-title" name="title" required />
          </FormRow>

          <FormRow label="Excerpt (optional)" htmlFor="post-excerpt">
            <Textarea id="post-excerpt" name="excerpt" rows={2} />
          </FormRow>

          <FormRow label="Body (markdown, optional)" htmlFor="post-body">
            <Textarea id="post-body" name="body" rows={6} />
          </FormRow>

          <FormRow label="Cover image URL (optional)" htmlFor="post-cover">
            <Input id="post-cover" name="cover_url" type="url" placeholder="https://" />
          </FormRow>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="publish"
              className="h-4 w-4 accent-primary"
              defaultChecked
            />
            Publish immediately
          </label>

          {err && (
            <p role="alert" className="text-sm text-destructive">
              {err}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Spinner className="h-4 w-4" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// RESOURCES
// ---------------------------------------------------------------------------
function ResourcesSection({ resources }: { resources: ResourceRow[] }) {
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader
        icon={<BookMarked className="h-5 w-5 text-primary" />}
        title="Shared library"
        description="Curated links the community has recommended."
        action={<AddResourceDialog />}
      />

      {resources.length === 0 ? (
        <Empty copy="No resources yet." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {resources.map((r) => (
            <ResourceCard key={r.id} resource={r} />
          ))}
        </div>
      )}
    </section>
  )
}

function ResourceCard({ resource }: { resource: ResourceRow }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            {resource.category && (
              <Badge variant="outline" className="text-[10px]">
                {resource.category}
              </Badge>
            )}
            <CardTitle className="text-base">{resource.title}</CardTitle>
            <CohortBadge cohorts={resource.cohorts} />
          </div>
          <a
            href={resource.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline break-all"
          >
            <ExternalLink className="h-3 w-3 shrink-0" />
            {resource.url}
          </a>
          {resource.description && (
            <p className="text-sm text-muted-foreground">{resource.description}</p>
          )}
        </div>
        <ConfirmDelete
          label="Delete"
          title={resource.title}
          description="Removes the link from the community library."
          formId={resource.id}
          action={deleteResource}
        />
      </CardHeader>
    </Card>
  )
}

function AddResourceDialog() {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [err, setErr] = useState<string | null>(null)

  function onSubmit(fd: FormData) {
    setErr(null)
    startTransition(async () => {
      const r = await createResource(fd)
      if (r.ok) setOpen(false)
      else setErr(r.message)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" />
          Add resource
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form action={onSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>New resource</DialogTitle>
            <DialogDescription>
              A link to a book, article, tool, or video.
            </DialogDescription>
          </DialogHeader>

          <FormRow label="Title" htmlFor="res-title">
            <Input id="res-title" name="title" required />
          </FormRow>

          <FormRow label="URL" htmlFor="res-url">
            <Input id="res-url" name="url" type="url" required placeholder="https://" />
          </FormRow>

          <FormRow label="Category (optional)" htmlFor="res-cat">
            <Input
              id="res-cat"
              name="category"
              placeholder="book, article, tool, video…"
            />
          </FormRow>

          <FormRow label="Description (optional)" htmlFor="res-desc">
            <Textarea id="res-desc" name="description" rows={3} />
          </FormRow>

          <CohortAccessField
            idPrefix="new-resource-cohort"
            description="Assign this resource to one or more cohorts. Only fellows in the assigned cohort(s) can see it."
          />

          {err && (
            <p role="alert" className="text-sm text-destructive">
              {err}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Spinner className="h-4 w-4" />}
              Add resource
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------
function SectionHeader({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode
  title: string
  description: string
  action: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary [&_svg]:size-[18px]">
          {icon}
        </span>
        <div>
          <h2 className="text-lg">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {action}
    </div>
  )
}

function FormRow({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}

function Empty({ copy }: { copy: string }) {
  return (
    <p className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
      {copy}
    </p>
  )
}

/**
 * Reusable destructive confirmation that wraps a server action. We do
 * the submit manually (instead of a <form action>) so the dialog can
 * stay mounted while the request is in flight and surface any error
 * inline.
 */
function ConfirmDelete({
  label,
  title,
  description,
  formId,
  action,
}: {
  label: string
  title: string
  description: string
  formId: string
  action: (fd: FormData) => Promise<ActionResult>
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [err, setErr] = useState<string | null>(null)

  function run() {
    setErr(null)
    const fd = new FormData()
    fd.set('id', formId)
    startTransition(async () => {
      const r = await action(fd)
      if (r.ok) setOpen(false)
      else setErr(r.message)
    })
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) setErr(null)
      }}
    >
      <AlertDialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="text-destructive hover:text-destructive"
          aria-label={label}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete &ldquo;{title}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {err && (
          <p role="alert" className="text-sm text-destructive">
            {err}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              run()
            }}
            disabled={pending}
            className="bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20"
          >
            {pending && <Spinner className="h-4 w-4" />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
