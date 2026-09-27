import { Building2 } from 'lucide-react'
import { requireUser } from '@/lib/auth-server'
import { createClient } from '@/lib/supabase/server'
import { SectionHeader } from '@/components/community/section-header'
import { getSectionBySlug } from '@/lib/community/sections'
import { SchoolCardClient } from '@/components/community/school-card-client'

export const metadata = {
  title: 'School Profile | Community | Leadership Fellowship',
}

interface School {
  id: string
  name: string | null
  description?: string | null
  location?: string | null
  contact_email?: string | null
  website_url?: string | null
  logo_url?: string | null
}

export default async function CommunitySchoolsPage() {
  await requireUser()
  const section = getSectionBySlug('schools')!
  const supabase = await createClient()

  // Fetch all schools with their information
  const { data: schools } = await supabase
    .from('schools')
    .select('id, name, description, location, contact_email, website_url, logo_url')
    .order('name', { ascending: true })
    .returns<School[]>()

  return (
    <>
      <div className="flex flex-col">
        <SectionHeader
          section={section}
          canPost={false}
        />

        {!schools || schools.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card p-10 text-center">
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary-soft text-primary">
              <Building2 className="size-[18px]" aria-hidden="true" />
            </span>
            <p className="text-sm text-muted-foreground">
              No schools are listed yet.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {schools.map((school) => (
              <SchoolCardClient
                key={school.id}
                id={school.id}
                name={school.name}
                logo_url={school.logo_url}
                description={school.description}
                location={school.location}
                contact_email={school.contact_email}
                website_url={school.website_url}
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
