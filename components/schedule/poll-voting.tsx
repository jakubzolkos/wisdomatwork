'use client'

import { format, formatDistanceToNow } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useState } from 'react'
import { Calendar, Clock, MapPin, Users, Check } from 'lucide-react'

interface TimeOption {
  id: string
  start_time: string
  end_time: string
  order_number: number
}

interface Vote {
  id: string
  user_id: string
  preferred_option_id: string
  users?: {
    full_name: string
    email: string
  }
}

interface PollVotingProps {
  schedule: {
    id: string
    title: string
    description: string | null
    location: string | null
    meeting_link: string | null
    status: string
    is_poll: boolean
    voting_closes_at: string | null
  }
  options: TimeOption[]
  userVote?: Vote
  allVotes?: Vote[]
  isAdmin: boolean
  onVote?: (optionId: string) => Promise<void>
  onFinalize?: (optionId: string) => Promise<void>
}

export function PollVoting({
  schedule,
  options,
  userVote,
  allVotes = [],
  isAdmin,
  onVote,
  onFinalize,
}: PollVotingProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(
    userVote?.preferred_option_id || null
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isOpen] = useState(schedule.status === 'polling')

  const voteCounts = options.map((opt) => ({
    optionId: opt.id,
    count: allVotes.filter((v) => v.preferred_option_id === opt.id).length,
  }))

  const handleVote = async () => {
    if (!selectedOption || !onVote) return

    setIsSubmitting(true)
    try {
      await onVote(selectedOption)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleFinalize = async () => {
    if (!selectedOption || !onFinalize) return

    setIsSubmitting(true)
    try {
      await onFinalize(selectedOption)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Poll Header */}
      <Card className="gap-5 shadow-xs">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 space-y-1.5">
              <CardTitle className="text-xl leading-snug">{schedule.title}</CardTitle>
              {schedule.description && (
                <p className="text-[15px] leading-relaxed text-muted-foreground">{schedule.description}</p>
              )}
            </div>
            <Badge
              variant="secondary"
              className={isOpen ? 'shrink-0 bg-success-soft text-success' : 'shrink-0'}
            >
              {isOpen ? 'Voting Open' : 'Closed'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-x-5 gap-y-2 text-muted-foreground">
          {schedule.location && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              {schedule.location}
            </div>
          )}
          {schedule.voting_closes_at && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Voting closes{' '}
              {formatDistanceToNow(new Date(schedule.voting_closes_at), {
                addSuffix: true,
              })}
            </div>
          )}
          {isAdmin && (
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              {allVotes.length} response{allVotes.length !== 1 ? 's' : ''}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Time Options */}
      <div className="space-y-3">
        <h3>
          {isAdmin ? 'Vote Results' : 'Select Your Availability'}
        </h3>

        {options.map((option, index) => {
          const voteCount = voteCounts.find(
            (vc) => vc.optionId === option.id
          )?.count || 0
          const isSelected = selectedOption === option.id
          const voted = userVote?.preferred_option_id === option.id

          return (
            <Card
              key={option.id}
              className={`cursor-pointer py-4 shadow-xs transition ${
                isSelected || voted
                  ? 'border-primary/40 bg-primary-soft'
                  : 'hover:border-border-strong hover:shadow-md'
              }`}
              onClick={() => !isAdmin && isOpen && setSelectedOption(option.id)}
            >
              <CardContent className="px-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">
                        {format(new Date(option.start_time), 'EEEE, MMMM d')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      {format(new Date(option.start_time), 'h:mm a')} -{' '}
                      {format(new Date(option.end_time), 'h:mm a')}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {isAdmin && (
                      <div className="text-right">
                        <div className="text-xl font-semibold tabular-nums text-foreground">{voteCount}</div>
                        <div className="text-xs text-muted-foreground">
                          vote{voteCount !== 1 ? 's' : ''}
                        </div>
                      </div>
                    )}

                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                        <Check className="h-4 w-4 text-primary-foreground" />
                      </div>
                    )}
                    {voted && !isAdmin && (
                      <Badge variant="secondary">Your Vote</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Action Buttons */}
      {isOpen && !isAdmin && (
        <Button
          onClick={handleVote}
          disabled={!selectedOption || isSubmitting || !!userVote}
          className="w-full"
        >
          {isSubmitting
            ? 'Submitting...'
            : userVote
              ? 'Vote Recorded'
              : 'Submit Vote'}
        </Button>
      )}

      {isAdmin && isOpen && (
        <Card className="border-primary/20 bg-primary-soft shadow-xs">

          <CardHeader>
            <CardTitle className="text-sm">Finalize Event</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Select the winning time and send calendar invitations to all
              voters.
            </p>
            <Button
              onClick={handleFinalize}
              disabled={!selectedOption || isSubmitting}
              className="w-full"
            >
              {isSubmitting ? 'Finalizing...' : 'Finalize & Send Invitations'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Admin View: Voter List */}
      {isAdmin && allVotes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Participant Responses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {allVotes.map((vote) => (
                <div
                  key={vote.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div>
                    <p className="font-medium">{vote.users?.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {vote.users?.email}
                    </p>
                  </div>
                  <p className="text-xs font-medium">
                    {options.find((o) => o.id === vote.preferred_option_id)
                      ? format(
                          new Date(
                            options.find(
                              (o) => o.id === vote.preferred_option_id
                            )?.start_time || ''
                          ),
                          'MMM d, h:mm a'
                        )
                      : 'Unknown'}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
