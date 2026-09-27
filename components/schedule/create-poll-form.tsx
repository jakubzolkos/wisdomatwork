'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Calendar, Users, Users2 } from 'lucide-react'

interface TimeOption {
  start_time: string
  end_time: string
}

interface Fellow {
  id: string
  full_name: string
}

interface Cohort {
  id: string
  name: string
  schoolName?: string | null
}

interface CreatePollFormProps {
  onSubmit: (data: {
    title: string
    description: string
    location: string
    meeting_link: string
    voting_closes_at: string
    options: TimeOption[]
    invited_fellows: string[]
    invited_cohorts: string[]
  }) => Promise<void>
  availableFellows?: Fellow[]
  availableCohorts?: Cohort[]
  isLoading?: boolean
}

export function CreatePollForm({
  onSubmit,
  availableFellows = [],
  availableCohorts = [],
  isLoading = false,
}: CreatePollFormProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [meetingLink, setMeetingLink] = useState('')
  const [votingClosesAt, setVotingClosesAt] = useState('')
  const [invitedFellows, setInvitedFellows] = useState<string[]>([])
  const [invitedCohorts, setInvitedCohorts] = useState<string[]>([])
  const [options, setOptions] = useState<TimeOption[]>([
    { start_time: '', end_time: '' },
  ])
  const [open, setOpen] = useState(false)
  const [selectedTab, setSelectedTab] = useState<'fellows' | 'cohorts'>('fellows')

  const handleAddOption = () => {
    setOptions([...options, { start_time: '', end_time: '' }])
  }

  const handleRemoveOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index))
  }

  const handleOptionChange = (
    index: number,
    field: 'start_time' | 'end_time',
    value: string
  ) => {
    const newOptions = [...options]
    newOptions[index][field] = value
    setOptions(newOptions)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (invitedFellows.length === 0 && invitedCohorts.length === 0) {
      toast.error('Please select at least one fellow or team to invite')
      return
    }

    if (options.some((opt) => !opt.start_time || !opt.end_time)) {
      toast.error('Please fill in all time option start and end times')
      return
    }

    try {
      await onSubmit({
        title,
        description,
        location,
        meeting_link: meetingLink,
        voting_closes_at: votingClosesAt,
        options,
        invited_fellows: invitedFellows,
        invited_cohorts: invitedCohorts,
      })

      toast.success('Poll created successfully! Redirecting to results...')

      // Reset form
      setTitle('')
      setDescription('')
      setLocation('')
      setMeetingLink('')
      setVotingClosesAt('')
      setOptions([{ start_time: '', end_time: '' }])
      setInvitedFellows([])
      setInvitedCohorts([])
      setOpen(false)
    } catch (error) {
      console.error('[v0] Error creating poll:', error)
      toast.error('Failed to create poll. Please try again.')
    }
  }

  const totalInvitees = invitedFellows.length + invitedCohorts.length

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create Poll
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Scheduling Poll</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Phase 1 Kickoff Meeting"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this meeting about?"
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-1">
                Location
              </label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g., Room 101 or Virtual"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Meeting Link
              </label>
              <Input
                value={meetingLink}
                onChange={(e) => setMeetingLink(e.target.value)}
                placeholder="https://zoom.us/..."
                type="url"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Voting Closes At
            </label>
            <Input
              value={votingClosesAt}
              onChange={(e) => setVotingClosesAt(e.target.value)}
              type="datetime-local"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-3">
              Time Options
            </label>
            <div className="space-y-3">
              {options.map((option, index) => (
                <div key={index} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="block text-xs text-muted-foreground mb-1">
                      Start
                    </label>
                    <Input
                      type="datetime-local"
                      value={option.start_time}
                      onChange={(e) =>
                        handleOptionChange(index, 'start_time', e.target.value)
                      }
                      required
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-muted-foreground mb-1">
                      End
                    </label>
                    <Input
                      type="datetime-local"
                      value={option.end_time}
                      onChange={(e) =>
                        handleOptionChange(index, 'end_time', e.target.value)
                      }
                      required
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveOption(index)}
                    disabled={options.length === 1}
                  >
                    ✕
                  </Button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddOption}
              className="mt-2"
            >
              <Plus className="mr-2 h-3 w-3" />
              Add Option
            </Button>
          </div>

          <div>
            <label className="block text-sm font-medium mb-3">
              Invite Participants
            </label>
            <Tabs value={selectedTab} onValueChange={(v: any) => setSelectedTab(v)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="fellows" className="gap-1.5">
                  <Users className="h-4 w-4" />
                  Individual Fellows
                </TabsTrigger>
                <TabsTrigger value="cohorts" className="gap-1.5">
                  <Users2 className="h-4 w-4" />
                  Teams by Cohort
                </TabsTrigger>
              </TabsList>

              <TabsContent value="fellows" className="mt-3">
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                  {availableFellows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No fellows available</p>
                  ) : (
                    availableFellows.map((fellow) => (
                      <label key={fellow.id} className="flex items-center gap-2 cursor-pointer rounded-md p-2 transition-colors hover:bg-accent">
                        <input
                          type="checkbox"
                          checked={invitedFellows.includes(fellow.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setInvitedFellows([...invitedFellows, fellow.id])
                            } else {
                              setInvitedFellows(invitedFellows.filter((id) => id !== fellow.id))
                            }
                          }}
                          className="rounded"
                        />
                        <span className="text-sm">{fellow.full_name}</span>
                      </label>
                    ))
                  )}
                </div>
                {invitedFellows.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {invitedFellows.length} fellow{invitedFellows.length !== 1 ? 's' : ''} selected
                  </p>
                )}
              </TabsContent>

              <TabsContent value="cohorts" className="mt-3">
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                  {availableCohorts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No cohorts available</p>
                  ) : (
                    availableCohorts.map((cohort) => (
                      <label key={cohort.id} className="flex items-center gap-2 cursor-pointer rounded-md p-2 transition-colors hover:bg-accent">
                        <input
                          type="checkbox"
                          checked={invitedCohorts.includes(cohort.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setInvitedCohorts([...invitedCohorts, cohort.id])
                            } else {
                              setInvitedCohorts(invitedCohorts.filter((id) => id !== cohort.id))
                            }
                          }}
                          className="rounded"
                        />
                        <span className="text-sm">
                          {cohort.name}
                          {cohort.schoolName && (
                            <span className="text-xs text-muted-foreground ml-1">
                              ({cohort.schoolName})
                            </span>
                          )}
                        </span>
                      </label>
                    ))
                  )}
                </div>
                {invitedCohorts.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {invitedCohorts.length} cohort{invitedCohorts.length !== 1 ? 's' : ''} selected
                  </p>
                )}
              </TabsContent>
            </Tabs>

            {totalInvitees > 0 && (
              <div className="mt-3 rounded-lg border border-primary/20 bg-primary-soft p-3 text-sm text-primary">
                <strong>{totalInvitees} participant{totalInvitees !== 1 ? 's' : ''} will be invited</strong> to set their availability
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create Poll'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
