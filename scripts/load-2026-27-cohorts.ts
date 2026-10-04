/**
 * Pre-launch load for 2026-27: cleans out test accounts, deactivates
 * departing fellows, loads Cohort A + B fellows (schools, teams,
 * research IDs) and fills in both curricula (dates, Zoom, surveys).
 *
 *   bun --env-file=.env.local scripts/load-2026-27-cohorts.ts           # dry run
 *   bun --env-file=.env.local scripts/load-2026-27-cohorts.ts --apply   # write
 *
 * Requires scripts/062_profile_research_ids.sql first. Idempotent:
 * everything is matched by email, fixed id, or (module, title).
 * No emails are sent; accounts are created confirmed and passwordless,
 * so fellows sign in with the 6-digit email code.
 */
import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import {
  STAFF,
  DEEP_LEARNING_LABS,
  DEEP_LEARNING_ZOOM,
  DEMO_TEAM_COHORT_ID,
  DEPARTING_EMAILS,
  DUMMY_SCHOOLS,
  FELLOWS,
  STALE_INVITE_EMAILS,
  SURVEYS,
  TEST_EMAILS,
  WISDOM_COACHING_SESSIONS,
  WISDOM_COACHING_ZOOM,
  LISTENING_LAUNCH_ZOOM,
  RELEASES,
  type CohortLetter,
} from './data/cohorts-2026-27'

const APPLY = process.argv.includes('--apply')
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
})

const PHASE_DEEP_LEARNING = '0ad17b17-2497-4e20-8b75-bfd03a30ec7a'
const PHASE_WISDOM_COACHING = 'fa06323f-ae79-4e9a-ad08-2d4c32966576'
const MOD_PRE_SURVEY = 'b2e8be92-4984-426f-a12b-973d6f94229d'
const MOD_SYLLABUS = '25dd43f1-68a8-4529-a739-5f72449d9748'
const MOD_LISTENING = '954c9a0a-355f-420c-9be4-046d77f14907'
const MOD_NORTH_STAR = '44555aa9-149c-4150-aad2-48fb9c345e85'
const MOD_WC_PRE_SURVEY = '57296daa-74fc-447f-932f-e0c91283cf03'
const MOD_DL_POST_SURVEY = '4b19b629-4f7d-463d-b80b-94062f4be85f'
const MOD_DL_CAPSTONE = 'a4c3cabb-0fb1-414d-b5df-f700b2709c4e'
const MOD_WC_POST_SURVEY = 'b27cc044-51ef-416b-9f6d-140d6311acf9'
const MOD_WC_CAPSTONE = '0a5645ca-bbfb-4859-883e-76932a670487'

// Placeholder copy for surveys the WaW team publishes later. A survey
// item without a URL can't be ticked and doesn't hold back the module
// sequence (lib/completion-gates.ts); adding the link activates it.
const ROL_AFTER_LAB = 'Complete at the close of the Wisdom Lab.'
const ROP_AFTER_FIELD_WORK =
  'Complete after your field work. The survey link will be shared here after the Wisdom Lab.'
const ROP_AFTER_SESSION =
  'Complete after you try your strategy in practice. The survey link will be shared here after the session.'

let failures = 0
function log(msg: string) {
  console.log(`${APPLY ? '' : '[dry] '}${msg}`)
}
function check<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) {
    failures++
    console.error(`  ! ${what}: ${res.error.message}`)
  }
  return res.data
}

// ------------------------------------------------------------ lookups

async function allAuthUsers() {
  const users: { id: string; email?: string }[] = []
  for (let page = 1; ; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    users.push(...data.users)
    if (data.users.length < 1000) break
  }
  return new Map(users.map((u) => [u.email!.toLowerCase(), u.id]))
}

const randomPassword = () => randomBytes(32).toString('base64url')

// ------------------------------------------------------------ 1. cleanup

async function cleanup(users: Map<string, string>) {
  console.log('\n== Cleanup')
  for (const email of TEST_EMAILS) {
    const id = users.get(email)
    if (!id) continue
    log(`delete test account ${email}`)
    if (APPLY) {
      const { error } = await sb.auth.admin.deleteUser(id)
      if (error) check({ data: null, error }, `delete ${email}`)
      else users.delete(email)
    }
  }

  const inviteEmails = [...TEST_EMAILS, ...STALE_INVITE_EMAILS]
  log(`delete invitations for ${inviteEmails.length} test/stale emails`)
  if (APPLY) check(await sb.from('invitations').delete().in('email', inviteEmails), 'delete invitations')

  log('delete "Demo School" team')
  if (APPLY) check(await sb.from('cohorts').delete().eq('id', DEMO_TEAM_COHORT_ID), 'delete demo team')

  log(`delete dummy schools: ${DUMMY_SCHOOLS.join(', ')}`)
  if (APPLY) check(await sb.from('schools').delete().in('name', DUMMY_SCHOOLS), 'delete dummy schools')

  for (const email of DEPARTING_EMAILS) {
    const id = users.get(email)
    if (!id) continue
    // Same as the admin "Deactivate" action, plus dropping the shared
    // seed password (scripts/014) that is committed to the repo.
    log(`deactivate ${email}`)
    if (APPLY) {
      check(
        await sb.from('profiles').update({ deactivated_at: new Date().toISOString() }).eq('id', id),
        `deactivate ${email}`,
      )
      const { error } = await sb.auth.admin.updateUserById(id, {
        ban_duration: '876000h',
        password: randomPassword(),
      })
      if (error) check({ data: null, error }, `ban ${email}`)
    }
  }
}

// ------------------------------------------------------------ 2. schools + teams

/** Team row per (school, cohort letter). 057 maps current_year 1/2/3 to A/B/C. */
async function ensureTeams() {
  console.log('\n== Schools and teams')
  const yearFor: Record<CohortLetter, number> = { A: 1, B: 2 }
  const teams = new Map<string, { schoolId: string; cohortRowId: string; schoolTeamId: string }>()
  const wanted = [...new Map(FELLOWS.map((f) => [`${f.school}|${f.cohort}`, f])).values()]

  for (const { school, cohort } of wanted) {
    const key = `${school}|${cohort}`
    const teamName = `${school} - Cohort ${cohort}`

    let { data: s } = await sb.from('schools').select('id').eq('name', school).maybeSingle()
    if (!s) {
      log(`create school ${school}`)
      if (!APPLY) continue
      s = check(await sb.from('schools').insert({ name: school }).select('id').single(), `school ${school}`)
      if (!s) continue
    }

    // One leadership-team row per school. Fix the letter on existing
    // rows (CICS Wrightwood's team is labelled Cohort B today).
    let { data: c } = await sb
      .from('cohorts')
      .select('id, current_year')
      .eq('school_id', s.id)
      .neq('id', DEMO_TEAM_COHORT_ID)
      .limit(1)
      .maybeSingle()
    if (!c) {
      log(`create team ${teamName}`)
      if (!APPLY) continue
      c = check(
        await sb
          .from('cohorts')
          .insert({ school_id: s.id, name: `${school} Leadership Team`, current_year: yearFor[cohort] })
          .select('id, current_year')
          .single(),
        `team ${teamName}`,
      )
      if (!c) continue
    } else if (c.current_year !== yearFor[cohort]) {
      log(`set ${school} team year ${c.current_year} -> ${yearFor[cohort]} (Cohort ${cohort})`)
      if (APPLY) check(await sb.from('cohorts').update({ current_year: yearFor[cohort] }).eq('id', c.id), 'team year')
    }

    let { data: st } = await sb
      .from('school_teams')
      .select('id, name')
      .eq('school_id', s.id)
      .eq('cohort_id', c.id)
      .maybeSingle()
    if (!st) {
      log(`create school_team ${teamName}`)
      if (!APPLY) continue
      st = check(
        await sb.from('school_teams').insert({ school_id: s.id, cohort_id: c.id, name: teamName }).select('id, name').single(),
        `school_team ${teamName}`,
      )
      if (!st) continue
    } else if (st.name !== teamName) {
      log(`rename school_team "${st.name}" -> "${teamName}"`)
      if (APPLY) check(await sb.from('school_teams').update({ name: teamName }).eq('id', st.id), 'rename team')
    }
    teams.set(key, { schoolId: s.id, cohortRowId: c.id, schoolTeamId: st.id })
  }
  return teams
}

// ------------------------------------------------------------ 3. fellows

async function loadFellows(users: Map<string, string>, teams: Awaited<ReturnType<typeof ensureTeams>>) {
  console.log('\n== Fellows')
  for (const f of FELLOWS) {
    const email = f.email.toLowerCase()
    let id = users.get(email)
    const isNew = !id
    log(`${isNew ? 'create' : 'update'} ${f.cohort} ${f.school}: ${f.fullName} <${email}> ${f.researchId}`)
    if (!APPLY) continue

    if (isNew) {
      const { data, error } = await sb.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { full_name: f.fullName },
      })
      if (error || !data.user) {
        check({ data: null, error: error ?? { message: 'no user returned' } }, `create ${email}`)
        continue
      }
      id = data.user.id
      users.set(email, id)
    } else {
      // Drop the shared seed password from scripts/014; fellows sign
      // in with email codes.
      const { error } = await sb.auth.admin.updateUserById(id!, { password: randomPassword(), ban_duration: 'none' })
      if (error) check({ data: null, error }, `reset password ${email}`)
    }

    const team = teams.get(`${f.school}|${f.cohort}`)
    if (!team) {
      check({ data: null, error: { message: `no team for ${f.school} ${f.cohort}` } }, email)
      continue
    }

    check(
      await sb.from('profiles').upsert(
        {
          id,
          email,
          full_name: f.fullName,
          title: f.title,
          role: 'fellow',
          cohort: f.cohort,
          school_id: team.schoolId,
          school_team_id: team.schoolTeamId,
          deactivated_at: null,
        },
        { onConflict: 'id' },
      ),
      `profile ${email}`,
    )
    // Exactly one team membership.
    check(await sb.from('cohort_members').delete().eq('profile_id', id!).neq('cohort_id', team.cohortRowId), `memberships ${email}`)
    check(
      await sb
        .from('cohort_members')
        .upsert({ cohort_id: team.cohortRowId, profile_id: id }, { onConflict: 'cohort_id,profile_id', ignoreDuplicates: true }),
      `membership ${email}`,
    )
    check(
      await sb.from('profile_research_ids').upsert({ profile_id: id, research_id: f.researchId }, { onConflict: 'profile_id' }),
      `research id ${email}`,
    )
  }
}

// ------------------------------------------------------------ 4. curriculum

type Item = {
  title: string
  resource_type: string
  category: string
  order_index: number
  url?: string | null
  body?: string | null
  description?: string | null
  scheduled_at?: string | null
  duration_minutes?: number | null
  cohorts?: string[] | null
}

/**
 * Update the item matching (module, any of `matchTitles`) or insert it.
 * Existing rows keep their position unless `reorder` is set.
 */
async function upsertItem(
  phaseId: string,
  moduleId: string,
  item: Item,
  matchTitles: string[] = [item.title],
  { reorder = false }: { reorder?: boolean } = {},
) {
  const { data: existing } = await sb
    .from('labs')
    .select('id, title')
    .eq('module_id', moduleId)
    .in('title', matchTitles)
    .order('created_at')
    .limit(1)
    .maybeSingle()
  log(`  ${existing ? 'update' : 'insert'} item "${item.title}"${item.scheduled_at ? ` @ ${item.scheduled_at}` : ''}${item.url ? ' (link)' : ''}`)
  if (!APPLY) return
  if (existing) {
    const { order_index: _keep, ...changes } = item
    check(await sb.from('labs').update(reorder ? item : changes).eq('id', existing.id), `item ${item.title}`)
  }
  else check(await sb.from('labs').insert({ ...item, year_id: phaseId, module_id: moduleId }), `item ${item.title}`)
}

async function upsertModule(
  id: string,
  phaseId: string,
  fields: {
    title: string
    description: string | null
    order_index: number
    cohorts?: string[] | null
    /** Release date (065); null = open now. */
    opens_at: string | null
  },
) {
  log(`module ${fields.order_index}. ${fields.title}${fields.cohorts ? ` [${fields.cohorts}]` : ''}${fields.opens_at ? ` opens ${fields.opens_at}` : ''}`)
  // Modules open by date; the completion sequence is off (065).
  if (APPLY) {
    check(
      await sb.from('modules').upsert({ id, phase_id: phaseId, ...fields, is_sequential: false }, { onConflict: 'id' }),
      `module ${fields.title}`,
    )
  }
}

async function deepLearning() {
  console.log('\n== Phase 1: Deep Learning (Cohort B schedule; A keeps the readings)')
  // Sessions and surveys carry Cohort B's dates and forms, so those
  // items (and the B-only modules) are gated to B. Prep readings and
  // field work stay open to A and B via the phase.
  const onlyB = ['B']

  await upsertModule(MOD_PRE_SURVEY, PHASE_DEEP_LEARNING, {
    title: 'Pre-Program Survey', description: 'Complete before the Listening Launch.', order_index: 1, cohorts: onlyB, opens_at: null,
  })
  await upsertItem(PHASE_DEEP_LEARNING, MOD_PRE_SURVEY, {
    title: 'Pre-Program Survey', resource_type: 'survey', category: 'before_lab', order_index: 1, url: SURVEYS.dlPreProgram,
  })

  await upsertModule(MOD_SYLLABUS, PHASE_DEEP_LEARNING, {
    title: 'Syllabus',
    description:
      'Walk through your roadmap of five Modules over seven months—each one with three parts (Wisdom Lab Prep, Wisdom Lab, and Wisdom Lab Field Work) described below.',
    order_index: 2,
    opens_at: null,
  })

  await upsertModule(MOD_LISTENING, PHASE_DEEP_LEARNING, {
    title: 'Listening Launch',
    description: 'School team listening session on Wednesday, October 14 or October 21, 2026. Your team signs up for one date.',
    order_index: 3,
    cohorts: onlyB,
    opens_at: null,
  })
  await upsertItem(PHASE_DEEP_LEARNING, MOD_LISTENING, {
    title: 'School Team Listening Session', resource_type: 'live_session', category: 'during_lab', order_index: 1,
    url: LISTENING_LAUNCH_ZOOM,
    description: LISTENING_LAUNCH_ZOOM
      ? null
      : 'October 14 or October 21, 2026. The Zoom link will be shared here before the session.',
  })

  const order = [4, 5, 7, 8, 9]
  for (const [i, lab] of DEEP_LEARNING_LABS.entries()) {
    await upsertModule(lab.moduleId, PHASE_DEEP_LEARNING, {
      title: lab.title,
      description: `${lab.tagline} Essential question: ${lab.question}`,
      order_index: order[i],
      opens_at: lab.opensAt,
    })
    // Lab Two's session is titled "Wisdom Lab Two"; Lab Three's is an
    // external_link without a URL.
    await upsertItem(
      PHASE_DEEP_LEARNING,
      lab.moduleId,
      {
        title: 'Wisdom Lab',
        resource_type: 'live_session',
        category: 'during_lab',
        order_index: 2,
        url: DEEP_LEARNING_ZOOM,
        description: null,
        scheduled_at: lab.startsAt,
        duration_minutes: 150,
        cohorts: onlyB,
      },
      ['Wisdom Lab', 'Wisdom Lab Two'],
    )
    // After the Lab, in order: Reflection on Learning (at the close
    // of the lab), Field Work, Reflection on Practice (after field
    // work). RoP forms aren't published yet: placeholders. The old
    // Lab Two RoP link was last year's form, so it's cleared.
    await upsertItem(
      PHASE_DEEP_LEARNING,
      lab.moduleId,
      {
        title: 'Reflection on Learning', resource_type: 'survey', category: 'after_lab', order_index: 1,
        description: ROL_AFTER_LAB, url: SURVEYS.dlRoL[i], cohorts: onlyB,
      },
      undefined,
      { reorder: true },
    )
    log('  field work -> after the lab, position 2')
    if (APPLY) {
      check(
        await sb.from('labs').update({ category: 'after_lab', order_index: 2 })
          .eq('module_id', lab.moduleId).like('title', 'Wisdom Lab Field Work%'),
        'field work order',
      )
    }
    await upsertItem(
      PHASE_DEEP_LEARNING,
      lab.moduleId,
      {
        title: 'Reflection on Practice', resource_type: 'survey', category: 'after_lab', order_index: 3,
        description: ROP_AFTER_FIELD_WORK, url: SURVEYS.dlRoP[i], cohorts: onlyB,
      },
      undefined,
      { reorder: true },
    )
  }

  await upsertModule(MOD_NORTH_STAR, PHASE_DEEP_LEARNING, {
    title: 'North Star School Team Discussion',
    description: 'School team discussion on February 10 or February 17, 2027. Your team signs up for one date.',
    order_index: 6,
    cohorts: onlyB,
    opens_at: RELEASES.northStar,
  })
  await upsertItem(PHASE_DEEP_LEARNING, MOD_NORTH_STAR, {
    title: 'North Star School Team Discussion', resource_type: 'live_session', category: 'during_lab', order_index: 1,
    description: 'February 10 or February 17, 2027. The WaW team will share the time and link for your school team.',
  })

  await closingModules(PHASE_DEEP_LEARNING, {
    postSurveyModuleId: MOD_DL_POST_SURVEY,
    capstoneModuleId: MOD_DL_CAPSTONE,
    order: 10,
    cohorts: onlyB,
    opensAt: RELEASES.deepLearningClosing,
    postSurveyDue: 'May 5, 2027',
    postSurveyUrl: SURVEYS.dlPostProgram,
    capstoneDates: 'May 12 or May 19, 2027',
    capstoneUrl: SURVEYS.dlCapstoneSignup,
  })
}

/** Post-Program Survey + Capstone/Feedback sign-ups at the end of a phase; links come later. */
async function closingModules(
  phaseId: string,
  o: {
    postSurveyModuleId: string
    capstoneModuleId: string
    order: number
    cohorts?: string[]
    /** Both closing modules open once the last session has ended. */
    opensAt: string
    postSurveyDue: string
    postSurveyUrl: string | null
    capstoneDates: string
    capstoneUrl: string | null
  },
) {
  await upsertModule(o.postSurveyModuleId, phaseId, {
    title: 'Post-Program Survey', description: `Due ${o.postSurveyDue}.`, order_index: o.order, cohorts: o.cohorts,
    opens_at: o.opensAt,
  })
  await upsertItem(phaseId, o.postSurveyModuleId, {
    title: 'Post-Program Survey', resource_type: 'survey', category: 'general_resources', order_index: 1,
    description: `Due ${o.postSurveyDue}. The survey link will be shared here closer to the date.`,
    url: o.postSurveyUrl,
  })

  await upsertModule(o.capstoneModuleId, phaseId, {
    title: 'Capstone Interview & Feedback Session',
    description: `Capstone Interview with Dr. Mark Pacheco (${o.capstoneDates}) and a Feedback Session on the Toolkit, Portal, or Leadership Assessment Inventory (before May 19, 2027).`,
    order_index: o.order + 1,
    cohorts: o.cohorts,
    opens_at: o.opensAt,
  })
  await upsertItem(phaseId, o.capstoneModuleId, {
    title: 'Sign up for your Capstone Interview', resource_type: 'survey', category: 'general_resources', order_index: 1,
    description: `A live session with your team and WaW team leadership on ${o.capstoneDates}. The sign-up form will be shared here.`,
    url: o.capstoneUrl,
  })
  await upsertItem(phaseId, o.capstoneModuleId, {
    title: 'Sign up for a Feedback Session', resource_type: 'survey', category: 'general_resources', order_index: 2,
    description:
      'One meeting before May 19, 2027 to give input on the Toolkit, Portal, or Leadership Assessment Inventory. The sign-up form will be shared here.',
    url: SURVEYS.feedbackSignup,
  })
}

async function wisdomCoaching() {
  console.log('\n== Phase 2: Wisdom Coaching (Cohort A)')
  await upsertModule(MOD_WC_PRE_SURVEY, PHASE_WISDOM_COACHING, {
    title: 'Pre-Program Survey', description: 'Complete before your first Wisdom Coaching session.', order_index: 1,
    opens_at: null,
  })
  await upsertItem(PHASE_WISDOM_COACHING, MOD_WC_PRE_SURVEY, {
    title: 'Pre-Program Survey', resource_type: 'survey', category: 'before_lab', order_index: 1, url: SURVEYS.wcPreProgram,
  })

  for (const [i, s] of WISDOM_COACHING_SESSIONS.entries()) {
    await upsertModule(s.moduleId, PHASE_WISDOM_COACHING, {
      title: s.title,
      description:
        'Prep: frame a current problem of practice. Live: share wins and challenges and test strategies with WaW tools. Field Work: implement, iterate and capture what you notice.',
      order_index: i + 2,
      opens_at: s.opensAt,
    })
    await upsertItem(PHASE_WISDOM_COACHING, s.moduleId, {
      title: 'Wisdom Coaching Prep', resource_type: 'assignment', category: 'before_lab', order_index: 1,
      body: 'Identify and frame a current problem of practice from your school to bring to the group for reflection.',
    })
    await upsertItem(PHASE_WISDOM_COACHING, s.moduleId, {
      title: 'Live Wisdom Coaching', resource_type: 'live_session', category: 'during_lab', order_index: 2,
      url: WISDOM_COACHING_ZOOM, scheduled_at: s.startsAt, duration_minutes: 60,
    })
    // Forms are published one at a time after each session; until
    // then these are placeholders.
    await upsertItem(PHASE_WISDOM_COACHING, s.moduleId, {
      title: 'Reflection on Learning', resource_type: 'survey', category: 'after_lab', order_index: 3,
      description: 'Complete at the close of the session.', url: SURVEYS.wcRoL[i],
    })
    await upsertItem(PHASE_WISDOM_COACHING, s.moduleId, {
      title: 'Reflection on Practice', resource_type: 'survey', category: 'after_lab', order_index: 4,
      description: ROP_AFTER_SESSION, url: SURVEYS.wcRoP[i],
    })
  }

  await closingModules(PHASE_WISDOM_COACHING, {
    postSurveyModuleId: MOD_WC_POST_SURVEY,
    capstoneModuleId: MOD_WC_CAPSTONE,
    order: WISDOM_COACHING_SESSIONS.length + 2,
    opensAt: RELEASES.wisdomCoachingClosing,
    postSurveyDue: 'March 10, 2027',
    postSurveyUrl: SURVEYS.wcPostProgram,
    capstoneDates: 'April 7 or May 5, 2027',
    capstoneUrl: SURVEYS.wcCapstoneSignup,
  })
}

// ------------------------------------------------------------ 5. staff

/** Make sure each listed staff member has an account with the right role (no email is sent). */
async function staff(users: Map<string, string>) {
  console.log('\n== Staff')
  for (const a of STAFF) {
    const email = a.email.toLowerCase()
    let id = users.get(email)
    log(`${id ? 'ensure' : 'create'} ${a.role} ${a.fullName} <${email}>`)
    if (!APPLY) continue
    if (!id) {
      const { data, error } = await sb.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { full_name: a.fullName },
      })
      if (error || !data.user) {
        check({ data: null, error: error ?? { message: 'no user returned' } }, `create ${email}`)
        continue
      }
      id = data.user.id
      users.set(email, id)
    }
    check(
      await sb.from('profiles').upsert(
        { id, email, full_name: a.fullName, title: a.title, role: a.role, cohort: null, deactivated_at: null },
        { onConflict: 'id' },
      ),
      `staff profile ${email}`,
    )
  }
}

// ------------------------------------------------------------ 6. library

async function library() {
  console.log('\n== Library')
  // Lab field guides follow Phase 1, which both cohorts can see.
  // (Lab Four's guide still points at an example.com placeholder.)
  for (const title of ['WaW Lab One Field Guide', 'WaW Lab Two Field Guide']) {
    log(`"${title}" cohorts -> [A,B]`)
    if (APPLY) check(await sb.from('community_resources').update({ cohorts: ['A', 'B'] }).eq('title', title), title)
  }
}

// ------------------------------------------------------------ main

async function main() {
  const { error: tableErr } = await sb.from('profile_research_ids').select('profile_id').limit(1)
  if (tableErr) {
    console.error('Run scripts/062_profile_research_ids.sql first:', tableErr.message)
    if (APPLY) process.exit(1)
  }

  console.log(APPLY ? 'APPLYING changes' : 'DRY RUN (pass --apply to write)')
  const users = await allAuthUsers()
  await cleanup(users)
  const teams = await ensureTeams()
  await loadFellows(users, teams)
  await staff(users)
  await deepLearning()
  await wisdomCoaching()
  await library()
  console.log(failures ? `\nDone with ${failures} error(s).` : '\nDone.')
  process.exit(failures ? 1 : 0)
}

main()
