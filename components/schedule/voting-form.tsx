'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Calendar, Clock } from 'lucide-react'

interface ScheduleOption {
  id: string
  start_time: string
  end_time: string
  order_number?: number | null
}

interface ScheduleVotingFormProps {
  scheduleId: string
  options: ScheduleOption[]
  existingVoteOptionId?: string | null
  onSubmit: (optionId: string) => Promise<void>
}

export function ScheduleVotingForm({
  scheduleId,
  options,
  existingVoteOptionId,
  onSubmit,
}: ScheduleVotingFormProps) {
  const [selectedOption, setSelectedOption] = useState<string | undefined>(
    existingVoteOptionId || undefined,
  )
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!selectedOption) return

    setIsSubmitting(true)
    try {
      await onSubmit(selectedOption)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Sort options by start time
  const sortedOptions = [...options].sort((a, b) => {
    const aTime = new Date(a.start_time).getTime()
    const bTime = new Date(b.start_time).getTime()
    return aTime - bTime
  })

  return (
    <div className="space-y-4">
      <RadioGroup value={selectedOption} onValueChange={setSelectedOption}>
        <div className="space-y-3">
          {sortedOptions.map((option) => {
            const startDate = new Date(option.start_time)
            const endDate = new Date(option.end_time)
            const dateStr = startDate.toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })
            const startTimeStr = startDate.toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            })
            const endTimeStr = endDate.toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            })

            return (
              <div key={option.id}>
                <div className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-card p-3.5 transition hover:border-border-strong hover:bg-accent/60 has-[[data-state=checked]]:border-primary/40 has-[[data-state=checked]]:bg-primary-soft">
                  <RadioGroupItem
                    value={option.id}
                    id={`option-${option.id}`}
                  />
                  <Label
                    htmlFor={`option-${option.id}`}
                    className="flex-1 cursor-pointer"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-foreground">{dateStr}</div>
                        <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          <span>
                            {startTimeStr} &ndash; {endTimeStr}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Label>
                </div>
              </div>
            )
          })}
        </div>
      </RadioGroup>

      <Button
        onClick={handleSubmit}
        disabled={!selectedOption || isSubmitting}
        className="w-full"
      >
        {isSubmitting ? 'Submitting...' : 'Submit Your Vote'}
      </Button>

      {existingVoteOptionId && (
        <p className="text-xs text-muted-foreground text-center">
          You can change your vote anytime before voting closes
        </p>
      )}
    </div>
  )
}
