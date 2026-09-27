import Image from 'next/image'

// Skip prerendering for auth routes since they may need dynamic data
export const dynamic = 'force-dynamic'

/**
 * Shared shell for every auth screen (login, activate, set-password,
 * sign-up, error). On wide screens a calm navy brand panel sits to the
 * left of the form column; on narrow screens the panel collapses into a
 * small mark above the card.
 */
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh w-full">
      <aside className="hidden flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex lg:w-2/5 xl:p-14">
        <div className="flex items-center gap-3">
          <Image
            src="/aai-mark.png"
            alt=""
            width={240}
            height={144}
            priority
            className="h-10 w-auto brightness-0 invert"
          />
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-primary-foreground/80">
            Abigail Adams Institute
          </span>
        </div>

        <div className="max-w-md space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary-foreground/70">
            Fellows Portal
          </p>
          <p className="font-display text-4xl font-semibold leading-tight tracking-tight xl:text-[2.75rem]">
            Wisdom at Work Fellowship
          </p>
          <p className="text-[15px] leading-relaxed text-primary-foreground/75">
            A program of the Abigail Adams Institute.
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col items-center justify-center px-4 py-10 sm:px-6 md:p-10">
        <div className="mb-8 flex flex-col items-center gap-3 text-center lg:hidden">
          <Image
            src="/aai-mark.png"
            alt="Abigail Adams Institute"
            width={240}
            height={144}
            priority
            className="h-12 w-auto"
          />
          <span className="eyebrow">Wisdom at Work Fellowship</span>
        </div>
        {children}
      </div>
    </div>
  )
}
