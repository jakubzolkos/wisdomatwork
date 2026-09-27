'use client'

import { useRef, useState, useTransition } from 'react'
import { Camera, Loader2, Trash2, Upload } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { initialsFor } from '@/lib/types/profile'
import { updateProfile } from '@/app/profile/actions'

interface Props {
  /** Server-rendered initial values; the form re-syncs on save. */
  initial: {
    id: string
    email: string | null
    fullName: string
    title: string | null
    bio: string | null
    avatarUrl: string | null
    // Community of Practice phase 1 (migration 049) extras. Each is
    // independently optional so an empty value clears the field.
    linkedinUrl: string | null
    twitterUrl: string | null
    websiteUrl: string | null
    lookingFor: string | null
    willingToHelp: string | null
    yearsInEducation: number | null
    communityRole: string | null
  }
}

/**
 * Suggested values for the "Community role" picker. Free text is
 * still allowed via the input, but offering well-known options
 * keeps the directory's role facet clean.
 */
const COMMUNITY_ROLE_SUGGESTIONS = [
  'Educator',
  'Coach',
  'School Leader',
  'Program Staff',
  'Other',
] as const

/** Lightweight URL sanity check used before submit. */
function looksLikeUrl(value: string): boolean {
  if (!value) return true
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

const MAX_AVATAR_BYTES = 5 * 1024 * 1024
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
])

/**
 * Single-page profile editor. Layout:
 *  - Left: large avatar + Upload / Remove controls.
 *  - Right: name, title, bio inputs, Save button.
 *
 * The avatar is kept in local state as a preview the moment the
 * user picks a file - we only POST when they hit Save, and the form
 * round-trips through {@link updateProfile} which also persists the
 * text fields. Side effect: every successful save revalidates the
 * Team and Community pages so the new photo shows up everywhere.
 */
export function ProfileEditor({ initial }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  // Text state - controlled inputs make validation predictable.
  const [fullName, setFullName] = useState(initial.fullName)
  const [title, setTitle] = useState(initial.title ?? '')
  const [bio, setBio] = useState(initial.bio ?? '')

  // "Beyond the basics" - Community of Practice fields. Stored as
  // strings on the form (incl. years) so empty values consistently
  // mean "clear the field" when posted.
  const [linkedinUrl, setLinkedinUrl] = useState(initial.linkedinUrl ?? '')
  const [twitterUrl, setTwitterUrl] = useState(initial.twitterUrl ?? '')
  const [websiteUrl, setWebsiteUrl] = useState(initial.websiteUrl ?? '')
  const [lookingFor, setLookingFor] = useState(initial.lookingFor ?? '')
  const [willingToHelp, setWillingToHelp] = useState(
    initial.willingToHelp ?? '',
  )
  const [yearsInEducation, setYearsInEducation] = useState(
    initial.yearsInEducation == null ? '' : String(initial.yearsInEducation),
  )
  const [communityRole, setCommunityRole] = useState(initial.communityRole ?? '')

  // Avatar state. `previewUrl` is what's shown in the <Avatar>; it
  // updates as soon as the user picks a file (object URL) or hits
  // Remove. We keep the original URL separate so Remove has
  // something to revert to if they cancel the change.
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    initial.avatarUrl,
  )
  const [pickedFile, setPickedFile] = useState<File | null>(null)
  const [shouldRemove, setShouldRemove] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handlePickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!ALLOWED_MIME.has(file.type)) {
      setError('Photo must be a JPEG, PNG, WEBP, or GIF.')
      // Clear the input so the user can re-pick the same file later.
      e.target.value = ''
      return
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setError('Photo must be 5 MB or smaller.')
      e.target.value = ''
      return
    }
    setError(null)
    setSuccess(null)
    setShouldRemove(false)
    setPickedFile(file)
    // Object URL gives instant feedback without uploading.
    setPreviewUrl(URL.createObjectURL(file))
  }

  function handleRemoveAvatar() {
    setError(null)
    setSuccess(null)
    setPickedFile(null)
    setShouldRemove(true)
    setPreviewUrl(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    const trimmedName = fullName.trim()
    if (trimmedName.length === 0) {
      setError('Please enter your name.')
      return
    }

    // Quick client-side URL sanity check so the user gets immediate
    // feedback for typos without a round-trip. Server re-validates.
    const urlPairs: Array<[string, string]> = [
      ['LinkedIn URL', linkedinUrl.trim()],
      ['Twitter / X URL', twitterUrl.trim()],
      ['Website URL', websiteUrl.trim()],
    ]
    for (const [label, value] of urlPairs) {
      if (value && !looksLikeUrl(value)) {
        setError(`${label} must start with http:// or https://`)
        return
      }
    }

    // Years must be a non-negative integer when present.
    const yearsRaw = yearsInEducation.trim()
    if (yearsRaw.length > 0) {
      const years = Number(yearsRaw)
      if (!Number.isInteger(years) || years < 0 || years > 80) {
        setError('Years in education must be a whole number between 0 and 80.')
        return
      }
    }

    const fd = new FormData()
    fd.append('fullName', trimmedName)
    fd.append('title', title.trim())
    fd.append('bio', bio.trim())
    fd.append('linkedinUrl', linkedinUrl.trim())
    fd.append('twitterUrl', twitterUrl.trim())
    fd.append('websiteUrl', websiteUrl.trim())
    fd.append('lookingFor', lookingFor.trim())
    fd.append('willingToHelp', willingToHelp.trim())
    fd.append('yearsInEducation', yearsRaw)
    fd.append('communityRole', communityRole.trim())
    if (pickedFile) fd.append('avatar', pickedFile)
    if (shouldRemove) fd.append('removeAvatar', '1')

    startTransition(async () => {
      const res = await updateProfile(fd)
      if (!res.ok) {
        setError(res.message)
        return
      }
      // Reset transient state - the next render reflects whatever
      // the server persisted (mainly the rehosted avatar URL).
      setPickedFile(null)
      setShouldRemove(false)
      if (typeof res.avatarUrl !== 'undefined') {
        setPreviewUrl(res.avatarUrl)
      }
      setSuccess('Profile saved.')
      router.refresh()
    })
  }

  const initials = initialsFor(fullName, initial.email)

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-6"
    >
      {/* Photo + basic details card */}
      <section className="rounded-xl border border-border bg-card shadow-xs">
      <div className="border-b border-border px-5 py-4 sm:px-6">
        <h2 className="text-base">Basic details</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Your photo, name and a short introduction.
        </p>
      </div>
      <div className="flex flex-col gap-8 p-5 sm:p-6 lg:flex-row lg:gap-10">
      {/* Avatar column */}
      <div className="flex flex-col items-center gap-4 lg:w-56">
        <div className="relative">
          <Avatar className="h-28 w-28 ring-1 ring-border">
            {previewUrl ? (
              <AvatarImage src={previewUrl} alt="" />
            ) : null}
            <AvatarFallback className="bg-primary-soft text-3xl font-medium text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card shadow-sm transition-colors hover:border-border-strong hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="Upload new photo"
          >
            <Camera className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="sr-only"
          onChange={handlePickFile}
        />

        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="gap-1.5"
          >
            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
            {previewUrl ? 'Change photo' : 'Upload photo'}
          </Button>
          {previewUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemoveAvatar}
              className="gap-1.5 text-muted-foreground"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Remove
            </Button>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          JPEG, PNG, WEBP, or GIF. Up to 5 MB.
        </p>
      </div>

      {/* Fields column */}
      <div className="flex min-w-0 flex-1 flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="profile-email">Email</Label>
          <Input
            id="profile-email"
            value={initial.email ?? ''}
            disabled
            className="bg-muted text-muted-foreground"
          />
          <p className="text-xs text-muted-foreground">
            Contact an admin to change your sign-in email.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="profile-name">Full name</Label>
          <Input
            id="profile-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. Jordan Patel"
            required
            maxLength={200}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="profile-title">Title</Label>
          <Input
            id="profile-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Principal at Washington Latin"
            maxLength={200}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="profile-bio">Bio</Label>
          <Textarea
            id="profile-bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Share a little about yourself - your school, what you're working on, what brought you to the Fellowship."
            rows={6}
            maxLength={4000}
          />
          <p className="text-right text-xs text-muted-foreground">
            {bio.length} / 4000
          </p>
        </div>
      </div>
      </div>
      </section>

        {/*
          Beyond the basics — Community of Practice fields. Grouped
          inside a labelled fieldset so the visual hierarchy makes
          it clear these are richer, optional details that power
          the Community directory.
        */}
        <fieldset className="min-w-0 rounded-xl border border-border bg-card shadow-xs">
          <legend className="float-left w-full px-5 pt-4 text-base font-semibold text-foreground sm:px-6">
            Community profile
          </legend>
          <div className="clear-left border-b border-border px-5 pb-4 pt-0.5 sm:px-6">
          <p className="text-sm text-muted-foreground">
            These optional fields power the Community directory. They
            help fellows find peers to learn from and collaborators
            who can help.
          </p>
          </div>

          <div className="flex flex-col gap-5 p-5 sm:p-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="profile-community-role">Role in community</Label>
              <Input
                id="profile-community-role"
                value={communityRole}
                onChange={(e) => setCommunityRole(e.target.value)}
                placeholder="e.g. Educator, Coach, School Leader"
                list="profile-community-role-options"
                maxLength={80}
              />
              <datalist id="profile-community-role-options">
                {COMMUNITY_ROLE_SUGGESTIONS.map((opt) => (
                  <option key={opt} value={opt} />
                ))}
              </datalist>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="profile-years-in-education">
                Years in education
              </Label>
              <Input
                id="profile-years-in-education"
                type="number"
                inputMode="numeric"
                min={0}
                max={80}
                step={1}
                value={yearsInEducation}
                onChange={(e) => setYearsInEducation(e.target.value)}
                placeholder="e.g. 8"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="profile-looking-for">
              What are you looking for from the community?
            </Label>
            <Textarea
              id="profile-looking-for"
              value={lookingFor}
              onChange={(e) => setLookingFor(e.target.value)}
              placeholder="e.g. Coaching on instructional walkthroughs, peers facing the same challenge..."
              rows={3}
              maxLength={500}
            />
            <p className="text-right text-xs text-muted-foreground">
              {lookingFor.length} / 500
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="profile-willing-to-help">
              What are you willing to help others with?
            </Label>
            <Textarea
              id="profile-willing-to-help"
              value={willingToHelp}
              onChange={(e) => setWillingToHelp(e.target.value)}
              placeholder="e.g. Designing PD agendas, building data dashboards, master schedules..."
              rows={3}
              maxLength={500}
            />
            <p className="text-right text-xs text-muted-foreground">
              {willingToHelp.length} / 500
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="profile-linkedin">LinkedIn</Label>
              <Input
                id="profile-linkedin"
                type="url"
                inputMode="url"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                placeholder="https://www.linkedin.com/in/..."
                maxLength={500}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="profile-twitter">Twitter / X</Label>
              <Input
                id="profile-twitter"
                type="url"
                inputMode="url"
                value={twitterUrl}
                onChange={(e) => setTwitterUrl(e.target.value)}
                placeholder="https://x.com/..."
                maxLength={500}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="profile-website">Website</Label>
              <Input
                id="profile-website"
                type="url"
                inputMode="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://..."
                maxLength={500}
              />
            </div>
          </div>
          </div>
        </fieldset>

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        {success && (
          <p
            role="status"
            className="rounded-lg border border-success/20 bg-success-soft px-4 py-3 text-sm text-success"
          >
            {success}
          </p>
        )}

        <div className="flex items-center justify-end gap-3">
          <Button type="submit" disabled={pending}>
            {pending && (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            {pending ? 'Saving...' : 'Save changes'}
          </Button>
        </div>
    </form>

  )
}
