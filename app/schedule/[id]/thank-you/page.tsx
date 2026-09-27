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
    <div className="min-h-screen bg-canvas flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <Check className="h-6 w-6 text-green-600" />
          </div>
          <CardTitle className="text-2xl">Your Vote Recorded</CardTitle>
          <CardDescription>
            Thank you for setting your availability
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {schedule && (
            <div>
              <p className="text-sm text-muted-foreground">For</p>
              <p className="font-medium">{schedule.title}</p>
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
