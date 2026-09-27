'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { ArrowLeft, BookOpen, Clock, Loader2, Users } from 'lucide-react'
import { TopBar } from '@/components/top-bar'
import { PageHeader } from '@/components/page-header'

interface Module {
  id: string
  title: string
  description: string
  start_date: string
  end_date: string
  duration_hours: number
  module_type: string
  order_number: number
}

interface Program {
  id: string
  title: string
  description: string
  year: string
  start_date: string
  end_date: string
}

export default function ProgramDetailPage() {
  const params = useParams()
  const programId = params.id as string

  const [program, setProgram] = useState<Program | null>(null)
  const [modules, setModules] = useState<Module[]>([])
  const [loading, setLoading] = useState(true)
  const [enrolled, setEnrolled] = useState(false)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const loadProgram = async () => {
      const supabase = createClient()

      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUser(user)

      // Get program details
      const { data: programData } = await supabase
        .from('programs')
        .select('*')
        .eq('id', programId)
        .single()

      if (programData) {
        setProgram(programData)
      }

      // Get modules
      const { data: modulesData } = await supabase
        .from('modules')
        .select('*')
        .eq('program_id', programId)
        .order('order_number', { ascending: true })

      if (modulesData) {
        setModules(modulesData)
      }

      // Check if user is enrolled
      if (user) {
        const { data: enrollmentData } = await supabase
          .from('enrollments')
          .select('id')
          .eq('user_id', user.id)
          .eq('program_id', programId)
          .single()

        setEnrolled(!!enrollmentData)
      }

      setLoading(false)
    }

    loadProgram()
  }, [programId])

  const handleEnroll = async () => {
    if (!user) {
      window.location.href = '/auth/login'
      return
    }

    const supabase = createClient()
    const { error } = await supabase.from('enrollments').insert({
      user_id: user.id,
      program_id: programId,
      status: 'enrolled',
    })

    if (!error) {
      setEnrolled(true)
    }
  }

  const yearLabels: Record<string, string> = {
    year_one: 'Deep Learning',
    year_two: 'Wisdom Coaching',
    year_three: 'Community of Practice',
  }

  const moduleTypeLabels: Record<string, string> = {
    listening_session: 'Listening Session',
    interactive_module: 'Interactive Module',
    field_work: 'Field Work',
    coaching: 'Team Coaching',
    implementation: 'Implementation',
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

  if (!program) {
    return (
      <div className="min-h-screen bg-canvas">
        <TopBar />
        <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:py-10">
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-4 text-muted-foreground">
            <Link href="/programs">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
          <div className="rounded-xl border border-dashed border-border-strong p-10 text-center">
            <p className="text-sm text-muted-foreground">Program not found.</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-canvas">
      <TopBar />
      <main className="mx-auto w-full max-w-4xl space-y-10 px-4 py-8 sm:py-10">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-4 text-muted-foreground">
            <Link href="/programs">
              <ArrowLeft className="h-4 w-4" />
              Back to Programs
            </Link>
          </Button>

          {/* Program Header */}
          <PageHeader
            className="mb-0"
            eyebrow="Program"
            title={yearLabels[program.year] || program.title}
            description={program.description}
            actions={
              enrolled ? (
                <Badge variant="secondary" className="bg-success-soft px-2.5 py-1 text-success">
                  Enrolled
                </Badge>
              ) : (
                <Button onClick={handleEnroll} size="lg">
                  Enroll in Program
                </Button>
              )
            }
          />

          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              <span>{modules.length} Modules</span>
            </div>
            {program.start_date && program.end_date && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>
                  {new Date(program.start_date).toLocaleDateString()} -{' '}
                  {new Date(program.end_date).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Modules */}
        <section className="space-y-4">
          <h2>Program Modules</h2>

          {modules.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border-strong p-10 text-center">
              <span className="mx-auto flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <BookOpen className="size-[18px]" aria-hidden="true" />
              </span>
              <p className="mt-4 text-sm text-muted-foreground">No modules available yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {modules.map((module) => (
                <Card key={module.id} className="gap-4 shadow-xs transition hover:border-border-strong hover:shadow-md">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <Badge variant="secondary" className="bg-primary-soft text-primary">
                            Module {module.order_number}
                          </Badge>
                          <Badge variant="outline" className="text-muted-foreground">
                            {moduleTypeLabels[module.module_type] || module.module_type}
                          </Badge>
                        </div>
                        <CardTitle className="text-base">{module.title}</CardTitle>
                        <CardDescription className="mt-1.5 leading-relaxed">{module.description}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {(module.duration_hours || module.start_date) && (
                      <dl className="grid grid-cols-2 gap-4 rounded-lg bg-muted/60 px-4 py-3">
                        {module.duration_hours && (
                          <div>
                            <dt className="text-xs text-muted-foreground">Duration</dt>
                            <dd className="text-sm font-medium text-foreground">{module.duration_hours} hours</dd>
                          </div>
                        )}
                        {module.start_date && (
                          <div>
                            <dt className="text-xs text-muted-foreground">Dates</dt>
                            <dd className="text-sm font-medium text-foreground">
                              {module.end_date
                                ? `${new Date(module.start_date).toLocaleDateString()} - ${new Date(module.end_date).toLocaleDateString()}`
                                : new Date(module.start_date).toLocaleDateString()}
                            </dd>
                          </div>
                        )}
                      </dl>
                    )}
                    {enrolled && (
                      <Button className="mt-4 w-full" variant="outline">
                        View Module
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
