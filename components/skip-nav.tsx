/**
 * Skip to main content link for keyboard accessibility.
 * Appears on focus, allows keyboard users to bypass navigation
 * and jump directly to the main content area.
 */
export function SkipNav() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-0 focus:left-0 focus:z-50 focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:m-2 focus:rounded-md focus:text-sm focus:font-medium focus:shadow-md"
    >
      Skip to main content
    </a>
  )
}
