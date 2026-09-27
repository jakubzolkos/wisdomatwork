'use client'

import { useState } from 'react'
import { Users, BookOpen, Library, Megaphone, Bell, FileText, History } from 'lucide-react'
import { UsersCleanupSection } from './users-cleanup'
import { ContentCleanupSection } from './content-cleanup'
import { LibraryCleanupSection } from './library-cleanup'
import { CommunityCleanupSection } from './community-cleanup'
import { NotificationsCleanupSection } from './notifications-cleanup'
import { CustomPagesCleanupSection } from './custom-pages-cleanup'
import { MaintenanceAuditLog } from './audit-log'

type Section = 'users' | 'content' | 'library' | 'community' | 'notifications' | 'pages' | 'audit'

interface SectionConfig {
  id: Section
  label: string
  icon: React.ReactNode
  component: React.ComponentType
}

const sections: SectionConfig[] = [
  {
    id: 'users',
    label: 'Users',
    icon: <Users className="size-[18px]" />,
    component: UsersCleanupSection,
  },
  {
    id: 'content',
    label: 'Content',
    icon: <BookOpen className="size-[18px]" />,
    component: ContentCleanupSection,
  },
  {
    id: 'library',
    label: 'Library',
    icon: <Library className="size-[18px]" />,
    component: LibraryCleanupSection,
  },
  {
    id: 'community',
    label: 'Community',
    icon: <Megaphone className="size-[18px]" />,
    component: CommunityCleanupSection,
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: <Bell className="size-[18px]" />,
    component: NotificationsCleanupSection,
  },
  {
    id: 'pages',
    label: 'Pages',
    icon: <FileText className="size-[18px]" />,
    component: CustomPagesCleanupSection,
  },
  {
    id: 'audit',
    label: 'Audit Log',
    icon: <History className="size-[18px]" />,
    component: MaintenanceAuditLog,
  },
]

export function MaintenanceClient() {
  const [activeSection, setActiveSection] = useState<Section>('users')

  const currentSection = sections.find((s) => s.id === activeSection)
  const CurrentComponent = currentSection?.component

  return (
    <div className="flex flex-col gap-6">
      {/* Navigation Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {sections.map((section) => {
          const active = activeSection === section.id
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => setActiveSection(section.id)}
              aria-pressed={active}
              className={`flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border p-4 text-center text-sm font-medium shadow-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                active
                  ? 'border-primary/40 bg-primary-soft text-primary'
                  : 'bg-card text-muted-foreground hover:border-border-strong hover:text-foreground hover:shadow-md'
              }`}
            >
              {section.icon}
              <span>{section.label}</span>
            </button>
          )
        })}
      </div>

      {/* Content Area */}
      {CurrentComponent && (
        <div>
          <CurrentComponent />
        </div>
      )}
    </div>
  )
}
