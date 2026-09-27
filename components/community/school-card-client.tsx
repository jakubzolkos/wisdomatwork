'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

interface SchoolCardClientProps {
  id: string
  name?: string | null
  logo_url?: string | null
  description?: string | null
  location?: string | null
  contact_email?: string | null
  website_url?: string | null
}

export function SchoolCardClient({
  id,
  name,
  logo_url,
  description,
  location,
  contact_email,
  website_url,
}: SchoolCardClientProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-xs transition hover:border-border-strong">
      {/* Header - Click to expand */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center gap-4 p-5 transition-colors hover:bg-accent/60"
      >
        {/* Logo/Crest */}
        {logo_url ? (
          <img
            src={logo_url}
            alt={name || 'School logo'}
            className="size-14 shrink-0 rounded-lg border object-cover sm:size-16"
          />
        ) : (
          <div className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-primary-soft sm:size-16">
            <span className="text-xl font-semibold text-primary">
              {name?.charAt(0) || '?'}
            </span>
          </div>
        )}

        {/* School Name */}
        <div className="min-w-0 flex-1 text-left">
          <h3 className="truncate">{name || 'Unnamed School'}</h3>
          {location && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {location}
            </p>
          )}
        </div>

        {/* Chevron Icon */}
        <ChevronDown
          className={`size-5 shrink-0 text-muted-foreground transition-transform ${
            isExpanded ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Expanded Content - School Information */}
      {isExpanded && (
        <div className="border-t">
          <div className="grid gap-5 px-5 py-5 sm:grid-cols-2">
            {description && (
              <div className="sm:col-span-2">
                <h4 className="eyebrow mb-1.5">
                  About
                </h4>
                <p className="text-[15px] leading-relaxed text-foreground">
                  {description}
                </p>
              </div>
            )}

            {location && (
              <div>
                <h4 className="eyebrow mb-1.5">
                  Location
                </h4>
                <p className="text-sm text-foreground">{location}</p>
              </div>
            )}

            {contact_email && (
              <div>
                <h4 className="eyebrow mb-1.5">
                  Contact
                </h4>
                <a
                  href={`mailto:${contact_email}`}
                  className="break-all text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  {contact_email}
                </a>
              </div>
            )}

            {website_url && (
              <div>
                <h4 className="eyebrow mb-1.5">
                  Website
                </h4>
                <a
                  href={website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  Visit school website
                </a>
              </div>
            )}

            {!description && !location && !contact_email && !website_url && (
              <p className="text-sm text-muted-foreground sm:col-span-2">
                No additional information available
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
