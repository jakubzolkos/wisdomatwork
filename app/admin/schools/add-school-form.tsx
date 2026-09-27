'use client'

import { useState, useTransition, useId } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Plus, X } from 'lucide-react'
import { createSchoolAction } from './actions'

export function AddSchoolForm() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [iconFile, setIconFile] = useState<File | null>(null)
  const [iconPreview, setIconPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const inputId = useId()
  const iconInputId = useId()

  const handle = (fd: FormData) => {
    setError(null)
    startTransition(async () => {
      if (iconFile) {
        fd.append('icon', iconFile)
      }
      const res = await createSchoolAction(fd)
      if (!res.ok) {
        setError(res.message)
        return
      }
      setName('')
      setIconFile(null)
      setIconPreview(null)
      setOpen(false)
    })
  }

  const handleIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0]
    if (file) {
      setIconFile(file)
      const reader = new FileReader()
      reader.onload = (e) => setIconPreview(e.target?.result as string)
      reader.readAsDataURL(file)
    }
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <Plus className="mr-1.5 h-4 w-4" />
        Add school
      </Button>
    )
  }

  return (
    <form
      action={handle}
      className="flex max-w-md flex-col gap-4 rounded-xl border bg-card p-5 shadow-xs"
    >
      <div className="space-y-1.5">
        <Label htmlFor={inputId} className="text-sm font-medium">
          School name
        </Label>
        <Input
          id={inputId}
          name="name"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Westside Prep, Lincoln High..."
          required
          className="text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Enter the name of your school or educational institution.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={iconInputId} className="text-sm font-medium">
          School icon (optional)
        </Label>
        <Input
          id={iconInputId}
          type="file"
          accept="image/*"
          onChange={handleIconChange}
          disabled={isPending}
          className="text-sm"
        />
        {iconPreview && (
          <div className="flex items-center gap-3 mt-2 p-2 rounded bg-muted">
            <img
              src={iconPreview}
              alt="Icon preview"
              className="h-12 w-12 rounded object-cover"
            />
            <div className="flex-1 text-xs text-muted-foreground truncate">
              {iconFile?.name}
            </div>
            <button
              type="button"
              onClick={() => {
                setIconFile(null)
                setIconPreview(null)
              }}
              className="text-xs text-muted-foreground hover:text-destructive transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          PNG, JPG, or WebP. Max 5 MB. (optional)
        </p>
      </div>

      {error ? (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          {error}
        </div>
      ) : null}

      <div className="flex gap-2">
        <Button 
          type="submit" 
          size="sm" 
          disabled={isPending || !name.trim()}
          className="flex-1 sm:flex-none"
        >
          {isPending ? <Spinner className="mr-1.5 h-3 w-3" /> : null}
          Create school
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setOpen(false)
            setError(null)
            setName('')
            setIconFile(null)
            setIconPreview(null)
          }}
          disabled={isPending}
        >
          <X className="mr-1.5 h-4 w-4" />
          Cancel
        </Button>
      </div>
    </form>
  )
}
