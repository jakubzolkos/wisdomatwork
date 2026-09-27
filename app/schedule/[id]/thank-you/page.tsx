'use server'

import { requireUser } from '@/lib/auth-server'
import { createClient } from '@/lib/supabase/server'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Check } from 'lucide-react'

export default async function ScheduleThankYouPage({
  params,
}: {
  params: { id: string }
}) {
  await requireUser()
  const supabase = await createClient()

  // Fetch the schedule title
  const { data: schedule } = await supabase
    .from('schedules')
    .select('id, title')
    .eq('id', params.id)
    .single()

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <Card className="w-full max-w-md shadow-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-success-soft">
            <Check className="h-6 w-6 text-success" />
          </div>
          <CardTitle className="text-xl">Your Vote Recorded</CardTitle>
          <CardDescription>
            Thank you for setting your availability
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {schedule && (
            <div className="rounded-lg bg-muted/60 px-4 py-3">
              <p className="text-xs text-muted-foreground">For</p>
              <p className="text-sm font-medium text-foreground">{schedule.title}</p>
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            You&apos;ll be notified once the final meeting time is confirmed. You can update
            your availability anytime before voting closes.
          </p>
          <Link href="/dashboard" className="block">
            <Button className="w-full">Back to Dashboard</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
