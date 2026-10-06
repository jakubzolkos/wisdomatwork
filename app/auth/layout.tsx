import Image from 'next/image'

// Skip prerendering for auth routes since they may need dynamic data
export const dynamic = 'force-dynamic'

/**
 * Shared shell for every auth screen (login, activate, set-password,
 * sign-up, error). On wide screens the form column and a navy brand
 * panel split the screen evenly, form on the left; on narrow screens
 * the panel collapses into a small mark above the card.
 */
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh w-full lg:flex-row-reverse">
      <aside className="hidden flex-1 flex-col justify-center gap-12 bg-primary p-10 text-primary-foreground lg:flex xl:p-16">
        <div className="max-w-xl space-y-5">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary-foreground/70">
            Fellows Portal
          </p>
          <p className="font-display text-4xl font-semibold leading-[1.1] tracking-tight xl:text-5xl 2xl:text-6xl">
            Wisdom at Work Fellowship
          </p>
          <div className="h-px w-16 bg-primary-foreground/30" />
        </div>

        {/* Official PWP logo, in white on the blue panel. */}
        <Image
          src="/pwp-logo.png"
          alt="Practical Wisdom Project, Abigail Adams Institute"
          width={837}
          height={508}
          priority
          className="h-28 w-auto self-start brightness-0 invert"
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col items-center justify-center px-4 py-10 sm:px-6 md:p-10 xl:px-16">
        <div className="mb-8 flex flex-col items-center gap-3 text-center lg:hidden">
          <Image
            src="/pwp-logo.png"
            alt="Practical Wisdom Project, Abigail Adams Institute"
            width={837}
            height={508}
            priority
            className="h-24 w-auto"
          />
          <span className="eyebrow">Wisdom at Work Fellowship</span>
        </div>
        {children}
      </div>
    </div>
  )
}
