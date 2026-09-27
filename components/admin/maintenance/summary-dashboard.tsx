'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Users,
  BookOpen,
  Library,
  MessageSquare,
  Bell,
  FileText,
  Clock,
  AlertCircle,
} from 'lucide-react'

interface PortalMaintenanceSummaryProps {
  stats: {
    pendingInvites: number
    testUsers: number
    draftContent: number
    unassignedResources: number
    scheduledNotifications: number
    communityPosts: number
    customPages: number
  }
}

export function PortalMaintenanceSummary({ stats }: PortalMaintenanceSummaryProps) {
  const summaryItems = [
    {
      title: 'Pending Invites',
      value: stats.pendingInvites,
      icon: <Clock className="h-4 w-4" />,
      color: 'text-primary',
      action: 'users',
    },
    {
      title: 'Test Users',
      value: stats.testUsers,
      icon: <AlertCircle className="h-4 w-4" />,
      color: 'text-warning',
      action: 'users',
    },
    {
      title: 'Draft Content',
      value: stats.draftContent,
      icon: <BookOpen className="h-4 w-4" />,
      color: 'text-warning',
      action: 'content',
    },
    {
      title: 'Unassigned Resources',
      value: stats.unassignedResources,
      icon: <Library className="h-4 w-4" />,
      color: 'text-purple-600',
      action: 'library',
    },
    {
      title: 'Scheduled Notifications',
      value: stats.scheduledNotifications,
      icon: <Bell className="h-4 w-4" />,
      color: 'text-pink-600',
      action: 'notifications',
    },
    {
      title: 'Community Posts',
      value: stats.communityPosts,
      icon: <MessageSquare className="h-4 w-4" />,
      color: 'text-success',
      action: 'community',
    },
    {
      title: 'Custom Pages',
      value: stats.customPages,
      icon: <FileText className="h-4 w-4" />,
      color: 'text-indigo-600',
      action: 'pages',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
      {summaryItems.map((item) => (
        <Card
          key={item.title}
          className="cursor-pointer hover:shadow-md transition-shadow"
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <span className={item.color}>{item.icon}</span>
              {item.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{item.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
