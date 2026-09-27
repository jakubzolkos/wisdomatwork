import { UserCircle } from 'lucide-react'
import { requireUser } from '@/lib/auth-server'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/top-bar'
import { ProfileEditor } from '@/components/profile/profile-editor'

export const metadata = {
  title: 'Your profile | Leadership Fellowship',
  description:
    'Update your photo, name, title, and bio. Changes appear on your team and community profile.',
}

/**
 * /profile - "Your profile" editor.
 *
 * Pulls the latest values straight from public.profiles (rather
 * than the cached CurrentUser shape) so we always render exactly
 * what's persisted - useful right after a save, since requireUser
 * caches its result for the lifetime of the request.
 */
export default async function ProfilePage() {
  const user = await requireUser()
  const supabase = await createClient()

  const { data: row } = await supabase
    .from('profiles')
    .select(
      `id, full_name, email, title, avatar_url, bio,
       linkedin_url, twitter_url, website_url,
       looking_for, willing_to_help, years_in_education, community_role`,
    )
    .eq('id', user.id)
    .maybeSingle<{
      id: string
      full_name: string | null
      email: string | null
      title: string | null
      avatar_url: string | null
      bio: string | null
      linkedin_url: string | null
      twitter_url: string | null
      website_url: string | null
      looking_for: string | null
      willing_to_help: string | null
      years_in_education: number | null
      community_role: string | null
    }>()

  const initial = {
    id: user.id,
    email: row?.email ?? user.email,
    fullName: row?.full_name ?? user.fullName,
    title: row?.title ?? null,
    bio: row?.bio ?? null,
    avatarUrl: row?.avatar_url ?? user.profileImageUrl ?? null,
    linkedinUrl: row?.linkedin_url ?? null,
    twitterUrl: row?.twitter_url ?? null,
    websiteUrl: row?.website_url ?? null,
    lookingFor: row?.looking_for ?? null,
    willingToHelp: row?.willing_to_help ?? null,
    yearsInEducation: row?.years_in_education ?? null,
    communityRole: row?.community_role ?? null,
  }

  return (
    <div className="min-h-screen bg-canvas">
      <TopBar />
      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:py-10">
        <header className="flex flex-col gap-2 border-b border-border pb-6">
          <p className="inline-flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground">
            <UserCircle className="h-3.5 w-3.5" aria-hidden="true" />
            Your profile
          </p>
          <h1 className="font-serif text-3xl text-foreground text-balance sm:text-4xl">
            Profile
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            This is what your teammates and the wider Fellowship see in the
            Team and Community directories. Photos make the directory feel
            personal - upload one if you can.
          </p>
        </header>

        <section className="mt-8">
          <ProfileEditor initial={initial} />
        </section>
      </main>
    </div>
  )
}
