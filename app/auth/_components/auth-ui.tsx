import type { AriaRole, ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Presentation primitives shared by the auth screens. Kept private to
 * app/auth (the `_components` folder is not routed).
 */

/** Subtle inline text link / text button used across auth forms. */
export const authLinkClass =
  'font-medium text-primary underline-offset-4 hover:underline disabled:pointer-events-none disabled:opacity-50'

export function AuthCard({
  title,
  description,
  children,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        'w-full rounded-xl border bg-card p-6 shadow-sm sm:p-8',
        className,
      )}
    >
      <header className="space-y-2">
        <h1 className="text-2xl sm:text-[1.75rem]">{title}</h1>
        {description ? (
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </header>
      <div className="mt-6 flex flex-col gap-5">{children}</div>
    </section>
  )
}

type NoticeTone = 'error' | 'success' | 'info'

const toneClass: Record<NoticeTone, string> = {
  error: 'bg-destructive/10 text-destructive',
  success: 'bg-success-soft text-success',
  info: 'bg-muted/60 text-foreground',
}

const toneIcon: Record<NoticeTone, ReactNode> = {
  error: <AlertCircle className="size-4" aria-hidden="true" />,
  success: <CheckCircle2 className="size-4" aria-hidden="true" />,
  info: <Info className="size-4 text-muted-foreground" aria-hidden="true" />,
}

/** Tidy status / error message block. */
export function AuthNotice({
  tone = 'info',
  role,
  children,
  className,
}: {
  tone?: NoticeTone
  role?: AriaRole
  children: ReactNode
  className?: string
}) {
  return (
    <div
      role={role}
      className={cn(
        'flex gap-2.5 rounded-lg px-3.5 py-3 text-sm leading-relaxed',
        toneClass[tone],
        className,
      )}
    >
      <span className="mt-0.5 shrink-0">{toneIcon[tone]}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

/** Small muted help line at the bottom of an auth card. */
export function AuthFootnote({ children }: { children: ReactNode }) {
  return (
    <p className="border-t pt-5 text-center text-xs leading-relaxed text-muted-foreground">
      {children}
    </p>
  )
}

/** Selectable method card used on activation / invite screens. */
export function MethodCard({
  icon,
  label,
  description,
  selected,
  onSelect,
  disabled,
}: {
  icon: ReactNode
  label: string
  description: string
  selected: boolean
  onSelect: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        'flex items-start gap-3 rounded-lg border p-3 text-left transition',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected
          ? 'border-primary bg-primary-soft'
          : 'bg-card hover:border-border-strong hover:bg-accent/60',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      <span
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-md',
          selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
        )}
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-xs leading-snug text-muted-foreground">{description}</span>
      </span>
    </button>
  )
}

/** Compact segmented control option (login screen). */
export function SegmentTab({
  icon,
  label,
  selected,
  onSelect,
  disabled,
}: {
  icon: ReactNode
  label: string
  selected: boolean
  onSelect: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        'flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected
          ? 'bg-card text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      {icon}
      {label}
    </button>
  )
}
