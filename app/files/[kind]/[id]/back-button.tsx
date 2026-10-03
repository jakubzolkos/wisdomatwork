'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Returns to wherever the fellow came from. The viewer usually opens
 * in a new tab (no history), so fall back to the dashboard then.
 */
export function BackButton({ withLabel = false }: { withLabel?: boolean }) {
  const router = useRouter()

  function goBack() {
    if (window.history.length > 1) router.back()
    else router.push('/dashboard')
  }

  return (
    <Button
      type="button"
      variant="outline"
      size={withLabel ? 'default' : 'icon'}
      onClick={goBack}
      aria-label="Go back"
    >
      <ArrowLeft aria-hidden="true" />
      {withLabel && 'Back'}
    </Button>
  )
}
