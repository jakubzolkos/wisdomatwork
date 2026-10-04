'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { COMMUNITY_ENABLED } from '@/lib/features'

interface ReflectionDisplayProps {
  reflection: string | null
  contentTitle: string
  nextHref: string | null
  onClear?: () => void
}

/**
 * Inline confirmation message displayed after reflection submission.
 * Shows a simple text confirmation with a link to view the reflection
 * in the Fellow Reflections community space.
 */
export function ReflectionDisplay({
  reflection,
  contentTitle,
  nextHref,
  onClear,
}: ReflectionDisplayProps) {
  const [isVisible, setIsVisible] = useState(!!reflection)

  useEffect(() => {
    setIsVisible(!!reflection)
  }, [reflection])

  if (!isVisible || !reflection) {
    return null
  }

  // The Fellow Reflections feed lives in Community, hidden at launch.
  if (!COMMUNITY_ENABLED) {
    return <p className="text-sm text-muted-foreground">Your reflection has been saved.</p>
  }

  return (
    <p className="text-sm text-muted-foreground">
      Your reflection has been saved. You can now view it in{' '}
      <Link
        href="/community/reflections"
        className="font-medium text-primary hover:underline"
      >
        Fellow Reflections
      </Link>
      .
    </p>
  )
}
