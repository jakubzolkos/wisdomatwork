'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { TopBar } from '@/components/top-bar'
import { PageHeader } from '@/components/page-header'
import { ArrowLeft, BookOpen, Loader2 } from 'lucide-react'

interface Program {
  id: string
  title: string
  description: string
  year: string
  start_date: string
  end_date: string
}

export default function ProgramsPage() {
  const [programs, setPrograms] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadPrograms = async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('programs')
        .select('*')
        .order('year', { ascending: true })

      if (!error && data) {
        setPrograms(data)
      }
      setLoading(false)
    }

    loadPrograms()
  }, [])

  const yearLabels: Record<string, string> = {
    year_one: 'Deep Learning',
    year_two: 'Wisdom Coaching',
    year_three: 'Community of Practice',
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas">
        <TopBar />
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Loading" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-canvas">
      <TopBar />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-10">
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-4 text-muted-foreground">
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
        <PageHeader
          title="Professional Development Programs"
          description="Choose a program to view modules and enroll"
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {programs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border-strong p-10 text-center md:col-span-2 lg:col-span-3">
              <span className="mx-auto flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <BookOpen className="size-[18px]" aria-hidden="true" />
              </span>
              <p className="mt-4 text-sm text-muted-foreground">No programs available yet. Check back soon!</p>
            </div>
          ) : (
            programs.map((program) => (
              <Link key={program.id} href={`/programs/${program.id}`} className="group block">
                <Card className="h-full gap-4 shadow-xs transition hover:border-border-strong hover:shadow-md">
                  <CardHeader className="gap-1.5">
                    <CardTitle className="text-base transition-colors group-hover:text-primary">
                      {yearLabels[program.year] || program.title}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {program.start_date && program.end_date
                        ? `${new Date(program.start_date).toLocaleDateString()} - ${new Date(program.end_date).toLocaleDateString()}`
                        : 'Dates TBD'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col">
                    <p className="flex-1 text-sm leading-relaxed text-muted-foreground">{program.description}</p>
                    <div className="mt-5">
                      <Button variant="outline" className="w-full">View Program</Button>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))
          )}
        </div>
      </main>
    </div>
  )
}
