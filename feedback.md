# Portal review — to-do list

From the pathway review: Karen, Mark, Ashleigh, and Barbara.
Today is Nov 16. Dates already past are marked **OVERDUE**.

## Do first (dates)

- [ ] **OVERDUE (was 11/10):** Liaison pathway is ready, then send Liaison login access.
  - Code done (Nov 16): Liaisons are **Cohort C** (no database change; the checks already allow C). Cohort names now show everywhere staff assign people ("Cohort A (Wisdom Coaching)", "Cohort B (Deep Learning)", "Liaisons"), including invite emails. Liaisons do not see the other pathways, not even as locked titles.
  - **Update (Nov 16): Liaisons are already users with the Facilitator role** (professional consultants Karen consults, not fellows). So no Liaison phase is needed; the Cohort C work above is unused. Instead they get a **Staff Library**: a third Library tab visible only to Admins and Facilitators, never Fellows. Built in code (migration `scripts/067_library_staff_only.sql`, Staff Library tab, "Staff Library" option in the add/edit form, Admin → Library group). Facilitators can view and download but not add, edit or delete; only Admins curate.
  - **Progress (Nov 16):** 067 SQL run. Liaison slide deck PDF uploaded to the Staff Library (by you; `scripts/upload-staff-library.ts` does this for any PDF). Still open: deploy the code, the one-page handout, the WAW Toolkit parts (post in parts, timed to what Liaisons review each month), and sending Liaison access.
  - **Preview fix (Nov 16):** "Preview as Liaisons" used to build a fake Fellow in Cohort C, so it hid the Staff Library and still said "Cohort C" in the banner and welcome line. It now previews a Facilitator (what a real Liaison sees) and says "Liaisons"; the cohort names also show in the admin lists, notification audiences and curriculum forms. Not yet checked in the browser.
  - **To do to make it live:** (1) Run `scripts/067_library_staff_only.sql` in Supabase **before** deploying the code, or the Library page will error. (2) Deploy. (3) Admin → Library → Add resource → choose "Staff Library" for the Liaison meeting deck (`WAW Liaison Meeting Nov 10 2026.pptx.pdf`, in Downloads), the one-page handout, and the Toolkit parts. Files are linked by URL today; uploading a PDF into the private bucket is still a script (see scripts/upload-*.ts). (4) Preview as a Fellow to confirm the tab is not there.
  - Leak check (Nov 16, read through the code, not tested with a real Liaison account): library, files, dashboard session card, community and phases are gated correctly. Two things to know: (a) a notification sent to **Everyone** also reaches Liaisons, so pathway-specific posts must use the cohort audience; (b) any signed-in user, Liaisons included, can read the other pathways' Zoom/survey links directly through the database API, because the curriculum tables are only filtered in app code (already listed as accepted in todo.txt). Fixing (b) means writing cohort rules into the database. **Decision (Nov 16): accepted as low risk and not planned now.** The users are not software engineers, so reading the database directly is very unlikely. Revisit only if the portal opens to people outside the invited groups. Cheap cover instead: passcodes on the Zoom links, and cohort audiences (not "Everyone") for pathway-specific notifications.
  - Open: Liaisons can still see the people directory and profiles (every signed-in user can; see todo.txt). Decide if that is acceptable for the alumni panel. Barbara may invite them at the first meeting next week. The pathway includes these three files:
  - PDF of this week's slide deck (PDF, not PPT)
  - One-page Liaison handout
  - WAW Toolkit (a copy already exists in Wisdom Coaching), posted in parts and timed to what they are invited to review each month
- [ ] **OVERDUE (was before 11/12):** Post Ashleigh's first part of the Toolkit for Deep Learning (Cohort B). Cohort B gets the Toolkit in parts. AR sends the WAW Toolkit for Deep Learning.
- [ ] **Nov 18:** Deep Learning launch. Two emails go out. A third email, the last one before Deep Learning, goes out from the Portal. Last year this was three short emails with videos before the first Wisdom Lab.
- [ ] **Before the Dec 2 Wisdom Coaching session**, Ashleigh posts to the WC portal:
  - WC Rotation Schedule
  - Wisdom Coaching Tool: Observer Tool for each of the Three As
  - Coaches' PWF Protocol
  - Sharer's Problem Identification and Context Prep Worksheet
- [ ] **Dec 4:** Wisdom Coaching launch.
- [ ] Report access as of today:
  - Only Wisdom Coaching Cohort A and Staff can log in right now.
  - How many members of each cohort have registered. (Query below; run it in the Supabase SQL editor.)
  - What Fellows need on hand to sign in each time. **Answer (from the code):** their program email address and access to that inbox. They choose "Email me a code", get a 6-digit code (valid 10 minutes, single use) and type it in. If they have set a password (via "Set or reset your password", link valid 24 hours), they can use email + password instead. Nothing else: no app or authenticator.
  - Counts query:
    ```sql
    select coalesce(p.cohort, 'none') as cohort, p.role,
      count(*) filter (where p.deactivated_at is null) as active_accounts,
      count(*) filter (where p.deactivated_at is null and u.last_sign_in_at is not null) as signed_in_at_least_once,
      count(*) filter (where p.deactivated_at is null and u.last_sign_in_at is null) as not_yet
    from public.profiles p
    left join auth.users u on u.id = p.id
    group by 1, 2 order by 1, 2;
    ```
    Note: accounts for both cohorts were pre-created (confirmed, passwordless), so "has an account" is not "has registered". Use `signed_in_at_least_once` as "registered".

## Three pathways

- [ ] Keep three separate pathways. Each group stays inside its own:
  - Cohort A — Wisdom Coaching (gets the full Toolkit)
  - Cohort B — Deep Learning (Toolkit in parts)
  - Liaisons — expert alumni panel, selected access to pilot tools and resources (Toolkit in parts, timed to the monthly review)
- [ ] Put the syllabus and the WaW Toolkit v1.2 inside each pathway. The Toolkit lives in the pathway syllabus, not in the shared library.
- [ ] Make it possible for the team to update each group's syllabi and materials without technical help.

## About page, times, and look

- [x] About, first sentence: delete "Learning Journals". (Done in code: `app/about/page.tsx` plus the default copy in `lib/custom-pages/setup.ts` and `scripts/setup-database.ts`. Old SQL migrations still say it; they are already applied. If the live About text was edited in the admin, check it there too.) It should read: "WAW Syllabus, Toolkit, Calendar, and Additional Resources."
- [x] Add a Calendar / Key Dates section. Karen cannot find where that lives. Decide where it lives and put it there.
  - Done in code (Nov 16, not yet seen in the browser): a "Key Dates" section on the About page (`components/about/key-dates.tsx`) listing the viewer's scheduled live sessions in date order, Eastern time, with length. It reads the curriculum, so a Fellow sees only their own pathway and any date changed in Admin → Curriculum updates it. Limit: only sessions with a set start time are listed; dates that appear only in text (Listening Launch Oct 14/21, North Star Feb 10/17, capstone dates) are not, until they get a start time.
- [ ] Fix the About graphic. It has wrong information (Ashleigh). Wisdom Coaching is 90 minutes, not 60. Edit the graphic itself. Decide the footnote: edit the day, or leave the day flexible in case a session lands on a Tuesday next year. The duration still has to change.
- [x] Across all pages, correct the session lengths (database updated to 90 by SQL on Nov 16; the About graphic is tracked separately below):
  - Deep Learning is 2.5 interactive hours (the loader already uses 150 minutes)
  - Wisdom Coaching is 90 interactive minutes (not 60, and not 1 hour)
  - Code done: the loader (`scripts/load-2026-27-cohorts.ts`) now sets Wisdom Coaching sessions to 90, and the seed text says 90. The live rows were changed from 60 to 90 with a targeted SQL update instead of re-running the full loader (which would overwrite admin edits). Rows with no duration still fall back to 60 minutes in the code; those would need a duration set.
- [ ] Restore the JTF logo at the bottom. It is smooshed and needs its correct proportions.
- [ ] Walk the portal and edit anything that does not match current naming (Field Guides vs WAW Toolkit, Learning Journals, session lengths, module names).
  - Done in code: the library type label "Field Guides" is now "WAW Toolkit" (library page, add-resource dialog, admin library). Remaining "Learning Journals" copy in the About seed route is fixed.
  - Still to check, needs the team's call: existing library rows titled "WaW Lab One/Two Field Guide" (database data, not code; handled by the Library clean-up item below); the "Fellows Portal" name in the top bar, login page and emails, which will also be used by Liaisons; module names such as "Wisdom Coaching Module One" (see the Wisdom Coaching pages section).

## Library and resources

- [ ] Delete all contents of the Current Library. Field Guides are now the WAW Toolkit. They belong in the Deep Learning syllabus, the Wisdom Coaching syllabus, or in the resources tied to that user's syllabus. They do not belong in the shared library.
  - **Clarify scope first.** Karen also says Recommended Reading is "beautiful" and stays, so "all contents" cannot mean the whole library. In the database, Recommended Reading is `community_resources` with `is_universal = true`. "My Resources" is the cohort-gated rows (`is_universal = false`). Confirm with Karen that she means the Field Guides and other cohort-gated items, and move the Toolkit into the syllabi **before** deleting, so nothing the cohorts rely on disappears.
- [ ] Fix the Library. Some links do not work. Others open a slide instead of a protocol. Ashleigh could not tell what the Library is for.
- [ ] Keep one shared Resource Library: Recommended Reading and Listening. This is the only section all three pathways should see. The team needs to add, update, and resequence items without technical help. Karen: the current Recommended Reading can stay; she will update it.
- [ ] Connect each person's resources to their cohort and their syllabus. Answer these before building it, and get the mapping from the team:
  - A Deep Learning user sees resources by Wisdom Lab.
  - A Wisdom Coaching user or a Liaison sees resources by date.
  - The list lines up with that pathway's syllabus.
  - What does the team need to give us to make it line up?

## Deep Learning pages (Mark, viewing as Cohort B)

- [ ] Clicking a Lab in the left menu opens a full-page landing for that module, not a long block of text in the sidebar. The button reads "Module 1" (and so on). Clicking it:
  - opens the dropdown of that module's items, and
  - lands on a page with all of the Module 1 contents plus a short video or text introduction to the focus of the lab.
- [x] Remove the "Reflection on Learning" link. It is completed in the Wisdom Lab. Fellows should not be able to open it before the lab, or complete it if they did not attend.
  - Loader updated to hide it from fellows (`cohorts = []`, the portal's existing hide mechanism; staff still see it). Live database updated by SQL (Nov 16). Cohort A may still see it greyed in their finished Deep Learning year.
- [x] Make "Wisdom Lab Fieldwork" the one major header. Reflection on Practice and the tool sit under that header. Fieldwork includes Reflection on Practice.
  - Code done: the old "After the Lab" group is now labelled "Wisdom Lab Fieldwork" everywhere, and the loader files Reflection on Practice under it, after the Field Work item. Live database updated by SQL (Nov 16). Side effect: Reflection on Practice now counts as after-the-lab in the dashboard's "where am I" timing.
- [ ] Clicking Reflection on Practice opens a landing page that:
  - describes the practice in plain language
  - links to the tool they will use
  - links to the Reflection on Practice Survey
- [ ] Deep Learning Orientation Guide: the screen says PDF, but there is no PDF to download. Attach the file. Barbara is providing the personalized orientation guide.

## Wisdom Coaching pages (Mark and Ashleigh, viewing as Cohort A)

- [ ] Same pattern as Deep Learning. Clicking "Wisdom Coaching Module One" (rename it to that) opens a landing page that states the big goals of the module. Stop putting that text in the sidebar.
- [x] Remove the Check-in and Retrospective links from the portal, for the same reason as Reflection on Learning. Keep clear links to the pre-program survey and the post-program survey.
  - Loader updated to hide both from fellows (same method as above). Live database updated by SQL (Nov 16). Pre- and post-program surveys are untouched.
- [x] Cut the repeated descriptions of prep, fieldwork, and lab from every Wisdom Coaching sidebar item. Ashleigh: too much information.
  - Done (Nov 16): the loader no longer sets that blurb, and the five Wisdom Coaching modules are renamed "Wisdom Coaching Module One" to "Module Five" (loader, data file, release-dates script); live database updated by SQL. The rename part of the "Same pattern as Deep Learning" item above is done; its landing page for the goals text is still to build.

## Emails and reminders

- [ ] Day-of email to each Fellow's inbox, with the Zoom link, on the day of each meeting. This is the feature they want first. A calendar reminder with the Zoom link, the same day.
  - Code done (Nov 16, not yet deployed or seen): the program reminders (Admin → Notifications) now go out at **7:00 AM ET on the day of each session**, with a **Join on Zoom** button linking straight to the Zoom, and a "view in portal" link. Before, they went out the day before and only linked to the session page. Tested for winter and summer clock times. **Calendar invite (Nov 16, code done, not yet seen in a real email):** session reminder emails now carry a `session.ics` attachment (title, start/end, Zoom link as location, a 30-minute alert) that opens as "Add to calendar" in Gmail, Apple and Outlook. Same session = same entry, so no duplicates. Tested as a file (`tests/unit/ics.test.ts`) but the first real send to an inbox is still to check. **If reminders were already scheduled** (Admin → Notifications → Scheduled), they still have the old day-before wording and timing; cancel those and create them again so the new ones apply.
- [ ] Reminder emails can go out in Karen's voice or Mark's voice.
- [ ] Schedule emails and short videos to send on set dates (the three emails before a Deep Learning Wisdom Lab).
- [x] Personalize those emails with the Fellow's name. (Done in code Nov 16: scheduled notification emails now say "Hi Jane," using the first name, skipping titles like Dr.; before they used the full name. Applies to the reminder and announcement emails, not yet to the invite and sign-in emails.)

## Launch and how people learn the portal (Barbara)

- [ ] Make a short video tutorial: what to do when you log in.
- [ ] Plan a live walkthrough so each group can be shown the platform before they are expected to use it.
  - Deep Learning: emails Nov 18
  - Wisdom Coaching launch: Dec 4
  - Liaisons: first meeting next week
- [ ] Barbara: personalized orientation guide for each Fellow.

## Surveys — decide before building (Mark and Jakub)

- [ ] Mark and Jakub meet on what the portal should do for surveys. Write down the opportunities and the risks before any build.
- [ ] Mark's current view, so the decision is on the table:
  - He wants data collection to stay in Google for now. The portal would be one more place to learn and keep track of.
  - Putting surveys inside the portal later means rebuilding every survey and reflection in the portal software.
  - He does want the pre-program and post-program survey links.
  - He does not want in-session reflections (Reflection on Learning, Check-in, Retrospective) available in the portal.

## Still open

- [ ] Fellow Reflections: is this an open bulletin board, and is it limited to the signed-in user's group? Confirm with the team before it is shown.
  - Answer from the code (Nov 16): **today it is hidden from fellows** (`COMMUNITY_ENABLED = false` in `lib/features.ts`), so fellows do not see the Community section or the reflections feed. **If switched on, it would be an open board across all groups, not limited to a pathway.** Reflections are saved as `public` by default, and the database only hides ones marked `private`; the `cohort` option exists but is not enforced.
  - **Heads-up for Liaisons:** Admins and Facilitators can see Community (the flag allows staff), so Liaisons, being Facilitators, can currently see the Community section and any public fellow reflections. **Decision (Nov 16): leave as is.** Facilitators, Liaisons included, keep Community access (Karen needs to review it). Revisit if the Liaisons should not see fellows' reflections.
- [ ] Look, feel, and ease of use: collect first reactions from the review and turn any remaining suggestions into fixes. Known ones are already listed above (times, logo, sidebar length, broken library links, module landing pages).
- [ ] Wildcard: anything else that helps a Fellow get the right material at the right time, and that lets the team reach them on the day of a meeting.
