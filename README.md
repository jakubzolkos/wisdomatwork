# Wisdom At Work — Fellows Portal

Invite-only learning portal for the Wisdom At Work (WaW) Fellowship run by the Abigail Adams Institute. School-leader **fellows** work through a cohort-gated curriculum (phases → modules → content items), write reflections, browse a resource library, and take part in a small community. **Admins** run everything from `/admin`.

> Database tables, RLS and migrations are documented in [SCHEMA.md](./SCHEMA.md). This file covers how the app behaves.

## Tech stack

- **Next.js 16** (App Router, Server Components, Server Actions), **React 19**, TypeScript 5.7
- **Supabase**: Postgres + RLS, Auth, Storage (`@supabase/ssr` for cookie sessions)
- **Resend** for all transactional email
- **Tailwind CSS v4** + shadcn/ui (Radix) in `components/ui`, `lucide-react` icons
- **Vercel** hosting, Vercel Cron, `@vercel/analytics` (production only), `@vercel/blob` (still used in two places, see Gotchas)
- Package manager: **Bun** (`bun.lock`, Bun ≥ 1.4). `trustedDependencies: []` in `package.json` stops dependency install scripts running, which is what pnpm did. Without it, `sharp` tries to compile against a system-wide libvips if one is installed.

## Local setup

```bash
bun install
bun dev          # http://localhost:3000
bun run build    # production build (there is no test suite)
bun run lint
```

Copy `.env.example` to `.env.local` and fill it in. `.env.local` is gitignored; `.env.example` is committed:

| Variable | Required | Used for |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | All Supabase clients |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Browser, server and proxy clients |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | `lib/supabase/admin.ts`: invites, login codes, notification dispatch, admin actions |
| `RESEND_API_KEY` | yes for email | `lib/email/client.ts`. Without it, sending throws and features that send email fail |
| `EMAIL_FROM` | recommended | Sender address. Defaults to `WaW Fellows Portal <onboarding@resend.dev>` |
| `NEXT_PUBLIC_SITE_URL` | yes in prod | Absolute links in invite, password and notification emails (`lib/site.ts`). Falls back to the request host, then `VERCEL_URL` |
| `NEXT_PUBLIC_APP_URL` | used by scheduling | Voting link in poll-invite emails (`lib/scheduling/notify.ts`). Falls back to `https://leadership.app`, so set it or change the code |
| `CRON_SECRET` | yes in prod | Bearer token checked by `/api/cron/notifications/dispatch` |
| `BLOB_READ_WRITE_TOKEN` | only for school logos | Read implicitly by `@vercel/blob` |

If the Supabase URL or anon key is missing, the proxy skips its auth check and `getCurrentUser()` returns `null`, so every page redirects to login.

**Database:** there is no migration runner. SQL files live in `scripts/` (plus `lib/sql/migrations/navigation_labels.sql`) and are applied by hand in the Supabase SQL editor. Several numbers are used twice, so see SCHEMA.md for the order that actually applies. Storage buckets: `avatars`, `resource-covers` and `custom-page-images` (created by `scripts/setup-storage.sql` or `POST /api/admin/custom-pages/setup`).

## Deployment

- Vercel project. Every page is dynamic because the root layout sets `export const dynamic = 'force-dynamic'`.
- `vercel.json` runs a cron every 5 minutes: `GET /api/cron/notifications/dispatch`. Vercel sends `Authorization: Bearer $CRON_SECRET`. The proxy skips `/api/cron/*`. A 5-minute schedule needs a Vercel plan that allows sub-daily crons.
- `next.config.js` only allowlists `**.supabase.co` for `next/image`.

## Project structure

```
app/
  page.tsx                 Role-aware redirect: anonymous -> /auth/login, admin -> /admin, others -> /dashboard
  auth/                    login, activate, callback, confirm, error, set-password, sign-up (retired "invite-only" notice)
  (curriculum)/            Route group with a shared layout (TopBar + sticky CurriculumTree rail)
    dashboard/             Fellow home
    phases/[phaseId]/modules/[moduleId]/items/[itemId]/   Content viewer
    phases/actions.ts      Completion, link-click and reflection server actions
  resources/               Library
  community/               Community overview + sections
  notifications/           Full notification inbox
  profile/, settings/      Own profile editor; settings panel
  schedule/[id]/           Fellow poll-voting page (+ thank-you)
  about/                   About page
  pages/[slug]/            Published custom (CMS) pages
  admin/                   Admin console (guarded by requireAdmin in admin/layout.tsx)
  api/                     Route handlers: admin/*, cron, schedules, notifications, custom-pages, revalidate, seed, user
  programs/, schools/      Legacy pages from the original demo schema, not linked in navigation
lib/
  auth-server.ts, admin-preview.ts, roles.ts, cohorts.ts, curriculum.ts, curriculum-tree.ts
  supabase/{client,server,admin,proxy}.ts
  auth/email-login-code.ts, invitations/, email/ (client, send, logs, templates/), notifications/, scheduling/
  community/, library/, custom-pages/, maintenance/, reflections.ts, session-link-clicks.ts, ics.ts, site.ts
components/                Feature folders (admin, community, curriculum, custom-pages, dashboard, library, ...) + ui/ (shadcn)
proxy.ts                   Next 16 proxy (replaces middleware.ts)
scripts/                   SQL migrations/seeds + one-off Node setup scripts
```

## Roles and permissions

There are three roles, defined in `lib/roles.ts` and stored in `profiles.role`: `fellow`, `facilitator`, `admin`.

What each role can do in practice:

| | Fellow | Facilitator | Admin |
|---|---|---|---|
| Sees curriculum and library | Only what their cohort (A/B/C) is assigned | Everything, no cohort gating | Everything |
| Completes items, writes reflections, uses community | yes | yes | yes |
| Manages library resources from `/resources` | no | yes | yes |
| Posts to staff-only feeds, features or archives posts, moderates asks | no | yes | yes |
| `/admin` console | no | **no** (redirected to `/dashboard`) | yes |
| Preview as a fellow | no | no | yes |

`lib/roles.ts` also defines a `rolePermissions` matrix and `getPermissions()`, but nothing calls them. Real checks are inline role comparisons (`user.role === 'admin'`, and so on) plus RLS. Facilitator-only features listed in the matrix, such as grading reflections or analytics, don't exist yet.

## Authentication

The portal is invite-only. Nobody can sign up; `/auth/sign-up` only explains that.

1. **Invite.** An admin invites people from `/admin/users`, one at a time or in bulk from a pasted list or CSV (`lib/invitations/parse.ts` defines the CSV template). `lib/invitations/invite.ts` does the following:
   - calls `auth.admin.generateLink({type:'invite'})`, falling back to `magiclink` if the user already exists;
   - upserts an `invitations` row with status pending → sent / failed → accepted;
   - emails an activation link to `/auth/activate?token_hash=…&type=…&email=…`.
2. **Activate** (`/auth/activate`). The invitee chooses one of two ways in:
   - set a password (minimum 8 characters): `verifyOtp` then `updateUser({password})`;
   - get a 6-digit email code instead.
   
   Either way, the invitation is marked `accepted`.
3. **Log in** (`/auth/login`). Two options:
   - **Email and password.**
   - **Email login code.** A 6-digit code, 10-minute TTL, single use; requesting a new one invalidates older codes. Codes are stored scrypt-hashed in `email_login_codes` (`lib/auth/email-login-code.ts`). After a correct code, the server mints a real Supabase session with `generateLink({type:'magiclink'})` + `verifyOtp`. Codes are only issued for emails that already have a profile.
   
   "Set or reset password" emails a recovery link that opens `/auth/activate?mode=password-only`.
4. **Session refresh.** `proxy.ts` calls `lib/supabase/proxy.ts#updateSession` on every non-static request. It refreshes cookies, redirects anonymous users to `/auth/login?next=…` (public paths are only `/` and `/auth/*`), and bounces signed-in users away from the login and sign-up pages.
5. **Page guards.** Server code uses `lib/auth-server.ts`:
   - `getCurrentUser()` (wrapped in React `cache()`) returns a `CurrentUser` built from `profiles`, including school, team and cohort.
   - `requireUser()` redirects to login.
   - `requireAdmin()` always checks the *real* account and redirects non-admins to `/dashboard`.
   - Client components read the user with `useUser()` from `lib/user-context.tsx`.
6. **Admin preview mode** (`lib/admin-preview.ts`). An admin starts a preview from the **Preview** menu in the top bar (pick Cohort A/B/C) or from the full launcher on `/admin/curriculum`. There are two modes:
   - *as a specific fellow*;
   - *as a blank fellow in cohort A/B/C*.
   
   How it works: the preview is stored in an HttpOnly cookie `wfp_preview` that lasts 8 hours. The cookie isn't signed; `getCurrentUser()` only honours it when the real user is an admin. While it's set, `getCurrentUser()` returns the synthesized fellow, a banner is shown, and `proxy.ts` redirects every `/admin*` request to `/dashboard`. You exit through the banner, which returns you to the page you started the preview from.

## Curriculum and cohort gating

- **Model** (the DB table names are legacy):
  - phase = `years`
  - module = `modules`
  - content item = `labs`

  Each item has:
  - a category: Before / During / After the Lab, General Resources, Wisdom Coaching, or Community of Practice;
  - a resource type: reading, video, slide_deck, pdf, worksheet, reflection_prompt, survey, external_link, protocol, companion_guide, assignment, live_session, or other;
  - an optional `url`, `body`, `duration_minutes` and `scheduled_at`;
  - `reflection_enabled` and `reflection_prompt`.
- **Cohort (A/B/C)** is a program-wide label on `profiles.cohort`. It is *not* the `cohorts` table, which holds school teams (see Gotchas).
- **Gating cascades** Phase → Module → Item (`lib/curriculum.ts`):
  - On a phase, `cohorts[]` is the source of truth; an empty array hides the phase from every fellow.
  - On a module or item, `NULL` inherits from the parent, `[]` locks it, and a non-empty list overrides the parent.
  - A fellow with no cohort sees nothing. Admins and facilitators bypass gating entirely.
  - Phases a fellow can't see still appear in the tree, shown as locked.
- **Library gating** (`app/resources/page.tsx`):
  - Resources with `is_universal = true` are "Recommended Resources" and everyone sees them.
  - Other resources use the same strict exact-cohort match (`fellowCanAccess`).
  - `cohortReleasedFor` in `lib/cohorts.ts` is a cumulative rule (A → B → C), but it's unused.

### Completion rules (`app/(curriculum)/phases/actions.ts`)

Marking an item complete writes to `user_content_completions`. An item can't be marked complete until both of these gates are met:

1. **Link gate.** If the item has a `url` and isn't a `live_session`, the fellow must open the link *during the current login session*.
   - The check reads the HttpOnly `lc_clicks` cookie (`lib/session-link-clicks.ts`). It is tagged with `last_sign_in_at`, so clicks from a previous login don't count.
   - Clicks are also written to `user_content_link_clicks`, but only for audit.
   - When a video is embedded on the item page, reaching the embed counts as opening it.
2. **Reflection gate.** If `reflection_enabled` is true, the fellow must have a saved reflection of at least **50 words** (`MIN_REFLECTION_WORDS` in `lib/reflections.ts`; maximum 5000 characters).
   - "Submit reflection" can save the reflection and complete the item in one step, as long as the link gate is already cleared.
   - Deleting the reflection also removes the completion.

Unchecking an item always works.

**Live sessions** have two different sources:

- **Content items** of type `live_session` with a `scheduled_at`.
  - The item page shows a countdown and a Join button.
  - Once start time + duration has passed, the item auto-completes, but only if no reflection is required.
- **The dashboard "upcoming session" card**, which reads a different table, `sessions`. It shows sessions within the next 7 days for the user's school teams. There is no admin UI for creating these.

### Reflections

- Stored in `user_content_reflections`, one per user per item. `visibility` is `public`, `cohort` or `private`, and defaults to `public`. The author changes it with the toggle on `/community/reflections`.
- The feed shows everything that isn't private. The app doesn't scope `cohort` to the viewer's cohort. The RLS policies in `050` and `052` disagree about this; see SCHEMA.md.
- Reactions ("cheer" / thumbs-up) go to `community_reflection_reactions`. Threaded comments go to `community_comments` with `subject_type='reflection'`. Both are written by `app/community/actions.ts` and `app/community/reflections/actions.ts`.

## Fellow workflow

1. Accept the invite on `/auth/activate`: set a password or choose email codes.
2. Land on `/dashboard`, which shows:
   - the notifications feed (pinned first);
   - the upcoming live session;
   - per-phase progress for you and your school-team teammates (`lib/team-progress.ts`);
   - the curriculum tree in the left rail.
3. Open an item. Read the body, open the link or watch the embed, write a reflection if one is required, then mark it complete. "Next" moves to the next item in the tree.
4. Use the **Library** (`/resources`): Recommended Resources (universal), My Resources (assigned to your cohort), search, tags and covers.
5. Use **Community** (`/community`): Fellows Bios directory, School Profiles, Fellow Reflections, plus a community dashboard.
6. Vote in **scheduling polls** from the in-app notification or email link at `/schedule/[id]`.
7. Edit your **profile** (`/profile`): name, title, bio, avatar, LinkedIn/X/website links, "looking for", "willing to help", years in education, community role.

## Admin console (`/admin`)

| Section | What it does |
|---|---|
| Users & cohorts | Invite (single or bulk CSV), change role, set cohort letter and school team, resend invite, deactivate, delete |
| Schools & teams | Create, rename or delete schools (logo upload goes to Vercel Blob), create teams per school, add and remove team members |
| Curriculum | CRUD and drag-reorder phases, modules and items; set cohort assignments, reflection prompt and live-session time. The fellow-preview launcher lives here |
| Library | CRUD for `community_resources`: type (document/video/link/reading), author, tags, cohorts, universal flag, cover image |
| Community | Events, posts and resources; `/admin/community/moderation` handles comment deletion and "member of the week" |
| Notifications | Unified announcements, reminders and alerts: draft, schedule, send now, pin, cancel, optional email. `/admin/announcements` redirects here |
| Scheduling | Create availability polls, invite fellows or whole teams, view vote tallies, delete polls |
| Email Logs | The last 7 days of invitation and notification emails, built from `invitations` + `notification_recipients`, with resend |
| Custom Pages | CMS pages with blocks and an image library (see below) |
| Portal Maintenance | Cleanup tools for users, content, library, community, notifications and pages, plus the `maintenance_audit_log` viewer |
| About (`/admin/about`) | Editable body blocks for `/about`. Not linked from the index page |

Admins can also rename top-nav labels inline. These are stored in `navigation_labels` via `/api/admin/navigation-labels`.

## Feature notes

**Notifications** (`lib/notifications/`, `public.notifications` + `notification_recipients`)

- Kinds are `announcement`, `reminder` and `alert`. Statuses: draft → scheduled → sending → sent / failed / cancelled.
- Audience options: `global`, `cohort` (A/B/C letters), `school_team` (resolved through `cohort_members`), or specific `users`. `year` is legacy and read-only.
- `dispatchNotification()` claims the row atomically, resolves recipients (active profiles only), upserts recipient rows, and sends email through Resend when `email_enabled` is set. It is safe to re-run.
- Scheduled rows are sent by the cron job.
- Users see the feed on `/dashboard`, `/notifications` and the bell (`/api/notifications/unread-count`). They can mark items read and dismiss them per user.
- Notifications can link to a curriculum item or carry a CTA button.

**Scheduling polls** (`/api/schedules*`, `schedules` / `schedule_options` / `schedule_votes`)

- Only admins create polls. Creating a poll emails every invited fellow a voting link and tries to create an in-app notification.
- Fellows vote while the poll's status is `polling`.
- `POST /api/schedules/[id]/finalize` sets the status to `scheduled`, but no UI calls it and it sends nothing (it's a TODO).
- ICS generation (`lib/ics.ts`) exists only for a community-events "Add to calendar" component, which isn't currently rendered anywhere.

**Custom pages / CMS** (`custom_pages`, `page_blocks`, `page_images`)

- Admins build pages at `/admin/custom-pages/[pageId]`:
  - title, slug, description, cover image;
  - up to 3 headers, each with a position of `before` / `after` / `hidden` relative to the blocks;
  - ordered blocks: `text` (with `format: header_section | prose_section` and Markdown), `image` (styling via `metadata.className / section / containerClass`) and `cta`.
- Published pages appear at `/pages/[slug]`. If `show_in_menu` is set they're also added to the top nav (`lib/custom-pages/menu.ts`).
- Admins see `InlinePageEditor` on the live page. It saves through `/api/admin/custom-pages` and then calls `/api/revalidate`.
- Images upload to Supabase Storage bucket `custom-page-images`: 5 MB max, JPEG/PNG/WebP/GIF. An image that is in use can't be deleted.

**About page** (`/about`)

- Not a custom page. The hero, images and Templeton attribution are hard-coded in `app/about/page.tsx`, and the images still point at `*.blob.vercel-storage.com`.
- The middle body comes from `admin_page_content` (`page_id='about'`, `slot_name='body'`), edited at `/admin/about`.
- `POST /api/admin/seed-about-page` seeds a *custom page* with slug `about`, which is reachable only at `/pages/about`.
- The canonical About copy (the three "Wisdom at Work initiative" paragraphs) lives in `scripts/setup-database.ts`. Use it to re-seed if the DB content is lost.

**Writing custom page blocks** (`components/custom-pages/page-renderer.tsx`)

Each block is a `page_blocks` row with `block_type`, `order_number`, `content` and a JSON `metadata`. Sections alternate `bg-card` and `bg-background` and are separated by `border-border` rules.

| `block_type` | `content` | `metadata` keys |
|---|---|---|
| `text` | Text, split on blank lines | `format: "header_section"`: H1 + subtitle + muted line (first 3 paragraphs). `format: "prose_section"`: muted prose paragraphs. Legacy `size: large \| medium \| small` makes one centered heading or line. With neither key, the content renders as Markdown |
| `image` | Image URL | `alt`, `className` (default `w-full rounded-lg shadow-md`), `section` (default `bg-background`), `containerClass` (default `py-8 sm:py-12`), `style` |
| `cta` | Button label | `href`, `section`, `containerClass` |

Common image presets: full width `w-full rounded-lg shadow-md`, two-thirds centered `w-2/3 rounded-lg shadow-md mx-auto`, logo `h-32 w-auto inline-block` (with `section: "border-t border-border bg-card"`). Use `py-8 sm:py-12` padding normally and `py-12 sm:py-16` for large sections. Always give images a real `alt`.

**Library covers and avatars** use the `resource-covers` and `avatars` Supabase Storage buckets.

**Settings** (`/settings`) shows the account email and email-preference toggles. The toggles are local state only and aren't saved.

**Email** (`lib/email/`)

- `sendEmail()` wraps Resend.
- Templates in `lib/email/templates/`: base, invitation, sign-in-code, password-setup, notification, scheduling.
- There is no separate send log. The "logs" are derived from `invitations` and `notification_recipients`.

**Maintenance audit:** `logMaintenanceAction()` writes `maintenance_audit_log` rows for cleanup actions and never throws.

## Design system (rules to follow)

Tokens live in `app/globals.css` (`styles/globals.css` is an unused shadcn default). The look is light-only, classical, "university press".

- **Colors.** Use the semantic Tailwind classes, not hex values: `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `text-primary`, `border-border`, `bg-accent`.

  | Token | Value | Use |
  |---|---|---|
  | navy (`--color-navy`) | `#274d80` | primary: headings, buttons, key UI |
  | ink | `#1a2f4f` | body text |
  | navy-muted | `#6b86ad` | secondary text |
  | navy-tint | `#e8eef5` | hover and subtle fills |
  | paper | `#fefefe` | page canvas |
  | parchment | `#faf7f2` | cards and content surfaces |
  | crimson (`--accent`) | `#bb4658` | reserved for progress, current state, live indicators and a single accent CTA per view; soft variant `#f4e2e4` |
  | success / warning / error | `#4a7c59` / `#c68b3c` / `#a13d3d` | status states |

- **Borders** use navy at an opacity (`--border-subtle`, `--border-default`, `--border-strong`, `--border`). Never use gray.
- **Type.**
  - `font-serif` = Vollkorn, used for all headings. h1–h6 are bold `text-primary` with `leading-snug`, sized 4xl, 3xl, 2xl, xl, then lg for h5/h6.
  - `font-sans` = Lora, used for the body with `leading-relaxed`.
  - `app/layout.tsx` also loads Cardo and Inter.
  - Never use text smaller than 12px; body text is 14px or larger.
  - Older docs mention Alegreya SC. It isn't loaded.
- **Links** are `text-accent` with hover `text-primary-light` and a visible `focus-visible` outline. Links don't get underlines globally, so add `underline` where color alone would be the only cue.
- **Accessibility.**
  - Keep `<SkipNav />` and `<main id="main-content">` from the root layout.
  - Keep a real heading hierarchy.
  - Give icon-only buttons an `aria-label` and set `aria-hidden` on the icons.
  - Associate every input with its label via `htmlFor`.
  - Announce async form errors with `aria-live="polite"`.
  - Alt text: the person's name for avatars; `alt=""` for decorative images.
  - Keep contrast at WCAG AA or better; navy and ink on paper pass.

## Known gotchas and tech debt

**Naming and schema**

- **Legacy names.** In the database, `years` = phases, `labs` = content items, and `cohorts` = **school teams** (with members in `cohort_members`). The A/B/C "cohort" is `profiles.cohort`. Read `lib/cohorts.ts` before you touch any of this.
- **school_teams migration in progress** (Phase 1 SQL is `scripts/057_…`; Phase 2 code is on master).
  - `getCurrentUser` and `/admin/schools` read `school_teams` and `profiles.school_team_id`.
  - "Add team" still inserts into `cohorts` only.
  - "Add member" requires an existing `school_teams` row and writes both `cohort_members` and `profiles.school_team_id`.
  - Dashboard sessions, team progress and notification audiences still use `cohort_members`.
  - See the school_teams migration section in SCHEMA.md.
- **Migrations.** `scripts/` has duplicate numbers (002, 025, 026, 030–036, 040, 046, 048, 051–053), and some columns exist only in ad-hoc SQL:
  - custom page `header1..3` exist only in `migrate-about.sql`;
  - `header*_position` has no migration at all, and the renderer only draws a header when its position is exactly `'before'` or `'after'`, so headers disappear when that column is missing.
- `lib/db-init.ts` and `/api/seed`, `/programs` and `/schools` belong to the original demo schema (`programs`, `enrollments`, the `participant`/`team_lead` enum). They're unused or legacy. `/api/seed` has no admin check.

**Security**

- **Server actions without auth.** `app/admin/custom-pages/actions.ts`, `app/admin/email-logs/actions.ts` and `lib/email/logs.ts` use the service-role client and don't check the caller's role. Server actions can be called from outside the admin UI, so the `/admin` layout guard doesn't protect them. Add `requireAdmin()` to each.
- `requireAdmin()`'s comment says admin pages stay reachable during preview, but `proxy.ts` blocks all of `/admin` while the preview cookie is set.

**Broken or unfinished features**

- `/about` body blocks only render for admins: `getAdminPageContent` returns "Unauthorized" for everyone else.
- `/pages/[slug]` checks admin status against a `user_profiles` table (the real table is `profiles`), so the inline editor probably never shows.
- Every non-`/auth` route requires login, including `/about` and `/pages/*`. "Public" custom pages are only visible to signed-in users.
- Email Logs "resend invitation" sends the bare site URL instead of a fresh activation token; its fallback is `https://waw-portal.com`. Use "Resend invite" on `/admin/users` instead.
- Poll invites insert a notification with `kind='schedule_poll_invite'`, which `notifications.kind`'s CHECK constraint (`046`) rejects. Emails still go out.
- `/community/ask` and `/community/whats-new` call `getSectionBySlug(...)!` for sections that were removed from `lib/community/sections.ts`, so they throw on render. `/community/wins` isn't linked from anywhere. `/community/stories/[id]` is linked only from `post-feed` and admin moderation.
- The `/settings` logout button POSTs to a nonexistent `/auth/logout`. The top bar's sign-out, which uses `supabase.auth.signOut()`, works.
- `requestPasswordSetupAction` looks up "is this a reset?" through `listUsers({perPage:1})`. This only affects the email wording.
- `components/sidebar.tsx`, `app-shell.tsx`, `layout-wrapper.tsx`, `components/team/*`, `community/events-list.tsx`, `lib/team-extras.ts`, `/api/admin/upload-image` and `/api/user` are unused or near-unused.

**Dead code and leftovers**

- **Duplicate reflection code.** `app/(curriculum)/phases/reflection-actions.ts`, `components/curriculum/reflection-{reactions,comments}.tsx` and `lib/community/load-reflection-feed.ts` are dead. They target an old `reflection_reactions` table and old column names. The live code is `app/community/*` + `lib/community/load-reflections.ts`.
- Vercel Blob is still used for school logos (`app/admin/schools/actions.ts`) and the unused `/api/admin/upload-image`, even though custom-page images moved to Supabase Storage.
- The codebase was generated with v0 and is full of `console.log('[v0] …')` debug logging, including in auth callbacks and poll creation.
