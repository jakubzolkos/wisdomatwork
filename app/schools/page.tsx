'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Building2 } from 'lucide-react'
import { PageHeader } from '@/components/page-header'

type School = {
  id: string
  name: string
  icon_url: string | null
}

export default function SchoolsPage() {
  const [schools, setSchools] = useState<School[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchSchools = async () => {
      try {
        const supabase = createClient()
        const { data, error: err } = await supabase
          .from('schools')
          .select('id, name, icon_url')
          .order('name', { ascending: true })

        if (err) throw err
        setSchools(data ?? [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load schools')
      } finally {
        setIsLoading(false)
      }
    }

    fetchSchools()
  }, [])

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      {/* Header */}
      <PageHeader
        className="mb-2"
        title="Partner Schools"
        description="Meet the schools and leadership teams in our program."
      />

      {/* Error State */}
      {error && (
        <Card className="border-destructive/20 bg-destructive/10 py-0 shadow-none">
          <CardContent className="p-4">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse py-0 shadow-xs">
              <CardContent className="flex gap-4 p-5">
                <div className="h-16 w-16 rounded-md bg-muted flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && schools.length === 0 && (
        <Card className="border-dashed border-border-strong bg-transparent py-0 shadow-none">
          <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary-soft">
              <Building2 className="size-[18px] text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">
              No schools added yet.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Schools Grid */}
      {!isLoading && schools.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {schools.map((school) => (
            <Card
              key={school.id}
              className="py-0 shadow-xs transition hover:border-border-strong hover:shadow-md"
            >
              <CardContent className="flex items-center gap-4 p-5">
                {school.icon_url ? (
                  <img
                    src={school.icon_url}
                    alt={school.name}
                    className="h-14 w-14 flex-shrink-0 rounded-lg border border-border object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg bg-primary-soft">
                    <Building2 className="h-6 w-6 text-primary" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm">{school.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    School Profile
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
