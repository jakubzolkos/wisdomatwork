'use client'

import { useState, type ReactNode } from 'react'
import { Bell, Lock, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

interface Props {
  userId: string
  userEmail: string
}

/** One settings group: icon chip + heading row, then a divided body. */
function SettingsSection({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <Card className="gap-0 py-0 shadow-xs">
      <div className="flex items-start gap-3 border-b border-border px-5 py-4 sm:px-6">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
          {icon}
        </span>
        <div className="min-w-0">
          <h2 className="text-base">{title}</h2>
          {description && (
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      <div className="px-5 py-5 sm:px-6">{children}</div>
    </Card>
  )
}

export function SettingsPanel({ userId, userEmail }: Props) {
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [communityUpdates, setCommunityUpdates] = useState(true)
  const [weeklyDigest, setWeeklyDigest] = useState(false)

  const handleLogout = async () => {
    await fetch('/auth/logout', { method: 'POST' })
    window.location.href = '/auth/login'
  }

  return (
    <div className="space-y-6">
      {/* Account Section */}
      <SettingsSection icon={<Lock className="size-4" />} title="Account">
        <dl className="space-y-5">
          <div className="space-y-1">
            <dt>
              <Label className="text-sm font-medium text-muted-foreground">
                Email Address
              </Label>
            </dt>
            <dd className="text-sm font-medium text-foreground">{userEmail}</dd>
            <dd className="text-xs text-muted-foreground">
              Contact support to change your email address
            </dd>
          </div>

          <div className="space-y-1">
            <dt>
              <Label className="text-sm font-medium text-muted-foreground">
                User ID
              </Label>
            </dt>
            <dd className="break-all rounded-md bg-muted/60 px-2.5 py-1.5 font-mono text-xs text-muted-foreground">
              {userId}
            </dd>
          </div>
        </dl>
      </SettingsSection>

      {/* Notification Preferences */}
      <SettingsSection icon={<Bell className="size-4" />} title="Notifications">
        <div className="-my-4 divide-y divide-border">
          <div className="flex items-center justify-between gap-6 py-4">
            <div>
              <Label htmlFor="settings-email-notifications" className="text-sm font-medium">
                Email Notifications
              </Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Receive email when someone interacts with your content
              </p>
            </div>
            <Switch
              id="settings-email-notifications"
              checked={emailNotifications}
              onCheckedChange={setEmailNotifications}
            />
          </div>

          <div className="flex items-center justify-between gap-6 py-4">
            <div>
              <Label htmlFor="settings-community-updates" className="text-sm font-medium">
                Community Updates
              </Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Get notified about new wins, asks, and reflections
              </p>
            </div>
            <Switch
              id="settings-community-updates"
              checked={communityUpdates}
              onCheckedChange={setCommunityUpdates}
              disabled={!emailNotifications}
            />
          </div>

          <div className="flex items-center justify-between gap-6 py-4">
            <div>
              <Label htmlFor="settings-weekly-digest" className="text-sm font-medium">
                Weekly Digest
              </Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Summary email every Monday morning
              </p>
            </div>
            <Switch
              id="settings-weekly-digest"
              checked={weeklyDigest}
              onCheckedChange={setWeeklyDigest}
              disabled={!emailNotifications}
            />
          </div>
        </div>
      </SettingsSection>

      {/* Session */}
      <SettingsSection icon={<LogOut className="size-4" />} title="Session">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            You will be signed out of this account on all devices.
          </p>
          <Button
            onClick={handleLogout}
            variant="outline"
            className="w-full sm:w-auto"
          >
            Sign out
          </Button>
        </div>
      </SettingsSection>
    </div>
  )
}
