// 2026-27 roster, schedule and survey links, from "WaW Fellows Portal -
// Materials for 9/30" and the two Orientation One Pagers (v1.2).
// Consumed by scripts/load-2026-27-cohorts.ts.
//
// Left out on purpose:
//   - St Mary's "TBD" (WAWBKLUO6V): not named yet.
//   - Kathleen Driscoll, St Mary's (WAWBLZJQE4): no longer participating.
// Nicknames given in the roster ("William (Will)") are used as the
// display name.

export type CohortLetter = 'A' | 'B'

export interface Fellow {
  cohort: CohortLetter
  school: string
  fullName: string
  title: string
  email: string
  researchId: string
}

const A = (school: string, fullName: string, title: string, email: string, researchId: string): Fellow =>
  ({ cohort: 'A', school, fullName, title, email, researchId })
const B = (school: string, fullName: string, title: string, email: string, researchId: string): Fellow =>
  ({ cohort: 'B', school, fullName, title, email, researchId })

export const FELLOWS: Fellow[] = [
  // Cohort A - Wisdom Coaching
  A('CICS Wrightwood', 'Valencia Bush', 'Assistant Principal', 'vbush@cicswrightwood.org', 'WAW25263VLK'),
  A('CICS Wrightwood', 'Daniel Goodwin', 'Interim Principal', 'dgoodwin@cicswrightwood.org', 'WAW25263STS'),
  A('CICS Wrightwood', 'Will Lee', 'Assistant Principal', 'wlee@cicswrightwood.org', 'WAW2526659O'),
  A('IVA Middle', 'Jacquie Bryant', 'Principal', 'jacquie.bryant@ivalongbeach.org', 'WAW2AOE824B'),
  A('IVA Middle', 'Rachel Gordon', 'Dean of Students', 'rachel.gordon@ivalongbeach.org', 'WAW2MVJD0L4'),
  A('IVA Middle', 'Farah Kolker-Ngangu', 'Social Worker', 'farah.kolkerngangu@ivalongbeach.org', 'WAW2DERK5L1Q'),
  A('IVA High', 'Maigon Buckner', 'Head of School', 'maigon.buckner@ivahigh.org', 'WAW2526KPI3'),
  A('IVA High', 'James McGrath', 'Founding Director', 'james.mcgrath@ivahigh.org', 'WAW2526ZRHQ'),
  A('IVA High', 'Dustin Schmidt', 'Associate Director of Instruction & Philosophy Teacher', 'dustin.schmidt@ivahigh.org', 'WAW2526SYV5'),
  A('IVA High', 'Darlin Ortiz', 'School Counselor', 'darlin.ortiz@ivahigh.org', 'WAW2526PHVT'),
  A('IVA High', 'Daniel Avery', 'Math Teacher', 'daniel.avery@ivahigh.org', 'WAW2526ZI89'),
  A('IVA High', 'Megan Gomes', 'Office Manager', 'megan.gomes@ivahigh.org', 'WAW2526DMI4'),
  A('BTA', 'Tim Belk', 'Headmaster', 'tbelk@bostontrinity.org', 'WAW2526WW0L'),
  A('BTA', 'Bisi Oloko', 'Assistant Head for Admission and Enrollment', 'boloko@bostontrinity.org', 'WAW2526JXYO'),
  A('BTA', 'Kris Loper', 'Academic Dean', 'kloper@bostontrinity.org', 'WAW2526M62H'),
  A('BTA', 'Juan Gonzalez', 'Dean of Students', 'jgonzalez@bostontrinity.org', 'WAW25263J1Y'),
  A('BTA', 'Ingrid Hill', 'Dean of Middle School', 'ihill@bostontrinity.org', 'WAW2526VQB8'),
  A('BTA', 'Tom Patrick', 'Dean of Faculty', 'tpatrick@bostontrinity.org', 'WAW2526WALS'),
  A('Washington Latin', 'James Kelly', 'Principal, 2nd Street campus', 'jkelly@latinpcs.org', 'WAW2526KASD'),
  A('Washington Latin', 'Tiffany Austin', 'Director of the Upper School, 2nd Street', 'taustin@latinpcs.org', 'WAW2526LL9U'),
  A('Washington Latin', 'Meg Kovach', 'Assistant Director of the Upper School, 2nd Street', 'mkovach@latinpcs.org', 'WAW2526W63K'),
  A('Washington Latin', 'Gabrielle Dreux', 'Assistant Director of the Upper School, 2nd Street', 'gdreux@latinpcs.org', 'WAW2526VOGU'),
  A('Washington Latin', 'Treshia Pettiford', 'Director of Student Life', 'tpettiford@latinpcs.org', 'WAW2526S9OQ'),

  // Cohort B - Deep Learning
  B('St James', 'Grover Green', 'Headmaster', 'greeng@stjmuk.org', 'WAWBLFM3L1'),
  B('St James', 'Daniel Schreiber', 'Director of Academic Services/Literature', 'schreiberd@stjmuk.org', 'WAWBQM05CK'),
  B('St James', 'Diane Grassman', 'Montessori Team Leader', 'grassmannd@stjmuk.org', 'WAWBMCOE92'),
  B('St James', 'Edward Paloucek', 'Middle School Team Leader', 'palouceke@stjmuk.org', 'WAWBLAS82N'),
  B('St James', 'Lisa Feyen', 'Montessori Team Leader', 'feyenl@stjmuk.org', 'WAWBZLQ04J'),
  B('St James', 'Brad Gross', 'Middle School Science', 'grossm@stjmuk.org', 'WAWBXKFT3I'),
  B('Willows Academy', 'Elizabeth Hughes', 'Director of High School', 'hughes@willowsacademy.org', 'WAWBAFKWV4'),
  B('Willows Academy', 'Beth Dolack', 'Executive Director', 'dolack@willowsacademy.org', 'WAWBCLSU5D'),
  // Shorter than the others, but confirmed correct (Barbara, Oct 3).
  B('Willows Academy', 'Mary Kurkowski', 'Director of Middle School', 'kurkowski@willowsacademy.org', 'WAWBVLDO2'),
  B('Willows Academy', 'Katie Stangel', 'Head of School', 'stangel@willowsacademy.org', 'WAWBBGM3PE'),
  B("St Mary's", 'Adrianna Giannelli', 'Head of School', 'agiannelli@sma.family', 'WAWBNBL15K'),
  B("St Mary's", 'Mary Beth Kelley', 'School Counselor', 'mkelley@sma.family', 'WAWBGP3NS8'),
  B('Mount de Sales', "Brendan O'Kane", 'President', 'brendan.okane@mountdesales.net', 'WAWBJHV73E'),
  B('Mount de Sales', 'Carsten Franklin', 'Dean of Students', 'carsten.franklin@mountdesales.net', 'WAWB4GB5DF'),
  B('Mount de Sales', 'Emily Brown', 'Upper School Division Head', 'ebrown@mountdesales.net', 'WAWB5FJZPT'),
  B('Mount de Sales', 'Kaylee Freeman', 'Middle School Division Head', 'kaylee.freeman@mountdesales.net', 'WAWBHBY6V9'),
  B('Mar Qardakh', 'Anna Cannon', 'Upper School History and Religion Curriculum Coordinator, History and Religion High School Teacher, Athletics Director', 'annacannon00@gmail.com', 'WAWB29FJZQ'),
  B('Mar Qardakh', 'Bianca De Leon', 'Head of School', 'bianca.g.deleon@marqardakh.com', 'WAWB71SANC'),
  B('Mar Qardakh', 'Fadi Obeed', 'HS English Curriculum Coordinator', 'fadigabaid@gmail.com', 'WAWB88ETLX'),
  B('Mar Qardakh', 'Jack Parker', 'MS English Curriculum Coordinator', 'jmparker1098@gmail.com', 'WAWBNEICMD'),
  B('Holy Rosary', 'John Rocha', 'Principal', 'rochaj@holyrosary.edu', 'WAWB5RGK7K'),
  B('Holy Rosary', 'Tammy Glass', 'Assistant Principal', 'glasst@holyrosary.edu', 'WAWB6QTP3E'),
  B('Holy Rosary', 'Kristina Baker', 'PreK Director and Admissions Director', 'bakerk@holyrosary.edu', 'WAWB83WLD2'),
  B('Holy Rosary', 'Keri Morgan', 'Middle School Director', 'morgank@holyrosary.edu', 'WAWB26KFT7'),
]

/** Last year's fellows who are not continuing: deactivated, not deleted. */
export const DEPARTING_EMAILS = [
  'dlewis@cicswrightwood.org',
  'summer.sanders@ivahigh.org',
  'latisha.williams@usd409.net',
  'blaine.clardy@usd409.net',
  'stephanie.berkhalter@usd409.net',
  'gerre.martin@usd409.net',
]

/** Test accounts: deleted along with their invitations. */
export const TEST_EMAILS = [
  'demo@lincolnhigh.edu',
  'manee@mit.edu',
  'nnamanin@bc.edu',
  'mauracahill@ymail.com',
  'andrea.rolla@gmail.com',
  'pwal@abigailadamsinstitute.org', // "ADMIN ADMIN" test admin
]

/** Invitations that never became accounts. */
export const STALE_INVITE_EMAILS = ['ngozi.nnamani@gmail.com', 'manee.nnamani@gmail.com']

/** Seeded dummy schools (014 and the original demo); cascade to their teams. */
export const DUMMY_SCHOOLS = ['Lincoln High School', 'Bay Area Collegiate', 'Northside Academy']

/** "Demo School" team row hanging off Washington Latin. */
export const DEMO_TEAM_COHORT_ID = 'c997a909-8189-4d8e-a984-ebdc6bcabe31'

// ---------------------------------------------------------------- schedule
// Times carry explicit ET offsets: EDT (-04:00) until Nov 1 2026 and
// from Mar 14 2027, EST (-05:00) in between.

export const DEEP_LEARNING_ZOOM = 'https://us02web.zoom.us/j/86470693301'
export const WISDOM_COACHING_ZOOM = 'https://us02web.zoom.us/j/83386350113'
/** Barbara is making a new one (Oct 5); the old link on the item was last year's. */
export const LISTENING_LAUNCH_ZOOM: string | null = null

export const SURVEYS = {
  dlPreProgram:
    'https://docs.google.com/forms/d/e/1FAIpQLScXRzSiB9TyJznJVcl03QBFBZD5XjbiDvowiE8hAWAb80F08w/viewform?usp=header',
  wcPreProgram: 'https://forms.gle/K6B3m717KMJn2FLJA',
  // null = not published yet. The WaW team releases each form after
  // its session; the portal shows a placeholder until the link is
  // added here (then re-run the loader).
  wcRoL: [
    // Session 1: the form stays unpublished until after Oct 7 (Barbara:
    // links go out once the lab is over). Put this back once it's live:
    // https://docs.google.com/forms/d/e/1FAIpQLScxOFXoAqryAnbNIGidNuvG-qgsDIQnASgnYjzLXzu6wv7njg/viewform?usp=header
    null,
    null,
    null,
    null,
    null,
  ] as (string | null)[],
  wcRoP: [null, null, null, null, null] as (string | null)[],
  dlRoP: [null, null, null, null, null] as (string | null)[],
  dlPostProgram: null as string | null,
  wcPostProgram: null as string | null,
  dlCapstoneSignup: null as string | null,
  wcCapstoneSignup: null as string | null,
  feedbackSignup: null as string | null,
  dlRoL: [
    'https://docs.google.com/forms/d/e/1FAIpQLScH9fc90BJcpYZNH4uYotmwFViXhnIoVn-J3iqQZx5oZZc6VQ/viewform?usp=header',
    'https://docs.google.com/forms/d/e/1FAIpQLScTahuhaMZ-5KVPSonJLH0PomYBij9k7avxW7k7KLILboJu8Q/viewform?usp=header',
    'https://docs.google.com/forms/d/e/1FAIpQLScnT4jpQmDmPwb5x_FYWmfgXx8XtjAp-bfIYyxWpiaA8gMAoA/viewform?usp=header',
    'https://docs.google.com/forms/d/e/1FAIpQLSeV5DYbIWM7GXGA3eBczHpSp_mrXZ3Cysmdq-_WWDeGWw82Xg/viewform?usp=header',
    // WL 5: the source doc repeats the WL 4 link; left empty until confirmed.
    null,
  ] as (string | null)[],
}

/**
 * Phase 1 (Deep Learning) labs, in order: Cohort B syllabus + schedule.
 * `opensAt`: each module opens when the previous session ends (065);
 * null = open now.
 */
export const DEEP_LEARNING_LABS: { moduleId: string; opensAt: string | null; title: string; tagline: string; question: string; startsAt: string }[] = [
  {
    moduleId: '4ab85b80-e289-48a6-8b31-bcf28cfb29a0',
    opensAt: null,
    title: 'Wisdom Lab One: Formative Leadership',
    tagline: 'Leadership is not a solo act.',
    question: 'What does it mean to be a formative leader?',
    startsAt: '2026-11-18T11:00:00-05:00',
  },
  {
    moduleId: '4f0a9c4f-92dd-44ad-985b-11d8b9c6fd5c',
    opensAt: '2026-11-18T13:30:00-05:00',
    title: 'Wisdom Lab Two: Institutional North Star',
    tagline: 'Grounding our compass.',
    question: 'What are you aiming at?',
    startsAt: '2027-01-27T11:00:00-05:00',
  },
  {
    moduleId: 'ec33ed34-a488-42ac-88ef-15712f2da5d8',
    opensAt: '2027-01-27T13:30:00-05:00',
    title: 'Wisdom Lab Three: Teaching and Learning',
    tagline: 'Educating for freedom.',
    question: 'How do we inspire students to take ownership of their learning and growth?',
    startsAt: '2027-02-24T11:00:00-05:00',
  },
  {
    moduleId: '411e4679-516c-47ea-bb30-0710a629afb3',
    opensAt: '2027-02-24T13:30:00-05:00',
    title: 'Wisdom Lab Four: Formative Discipline',
    tagline: 'Navigating challenges to promote character.',
    question: 'How do we leverage problems as opportunities for growth?',
    startsAt: '2027-03-24T11:00:00-04:00',
  },
  {
    moduleId: '1c9da894-8cd1-4f59-bc7f-517bfe5857dd',
    opensAt: '2027-03-24T13:30:00-04:00',
    title: 'Wisdom Lab Five: Courageous Dialogue (Capstone)',
    tagline: 'Taking people seriously as persons.',
    question:
      'How do we navigate change and respond to crises in ways that build trust and shape a culture of character, flourishing and excellence?',
    startsAt: '2027-04-28T11:00:00-04:00',
  },
]

/** Phase 2 (Wisdom Coaching) sessions, Cohort A. Module ids are fixed so re-runs update in place. */
export const WISDOM_COACHING_SESSIONS = [
  { moduleId: '25784f6b-0efb-40ee-9918-417a871e64be', opensAt: null as string | null, title: 'Wisdom Coaching One', startsAt: '2026-10-07T14:00:00-04:00' },
  { moduleId: '0883e217-6200-4716-971e-e5eeddee65dc', opensAt: '2026-10-07T15:00:00-04:00' as string | null, title: 'Wisdom Coaching Two', startsAt: '2026-11-04T14:00:00-05:00' },
  { moduleId: '181b2c81-dfda-4872-a1f9-55759fa9cdbc', opensAt: '2026-11-04T15:00:00-05:00' as string | null, title: 'Wisdom Coaching Three', startsAt: '2026-12-02T14:00:00-05:00' },
  { moduleId: '4fd0074c-231c-4bea-ba0c-c6ec93ef19a2', opensAt: '2026-12-02T15:00:00-05:00' as string | null, title: 'Wisdom Coaching Four', startsAt: '2027-02-03T14:00:00-05:00' },
  { moduleId: 'fd550623-dcb8-4f33-a970-f0b7fbe65de0', opensAt: '2027-02-03T15:00:00-05:00' as string | null, title: 'Wisdom Coaching Five', startsAt: '2027-03-03T14:00:00-05:00' },
]

/**
 * Staff accounts (Barbara, Oct 3). There's no admin role split yet, so
 * "admin" sees and edits everything. Karen asked for a view-only
 * version for now: "facilitator" sees all curriculum but can't open
 * /admin.
 */
export const STAFF: { email: string; fullName: string; title: string; role: 'admin' | 'facilitator' }[] = [
  { email: 'barbara@abigailadamsinstitute.org', fullName: 'Barbara Chrobak', title: 'Director of Operations', role: 'admin' },
  { email: 'ashleigh@abigailadamsinstitute.org', fullName: 'Ashleigh Reen', title: 'Research Assistant', role: 'admin' },
  { email: 'caitlin@abigailadamsinstitute.org', fullName: 'Caitlin Sze', title: 'Special Projects Manager', role: 'admin' },
  { email: 'mpacheco@coe.ufl.edu', fullName: 'Mark Pacheco', title: 'Co-Principal Investigator', role: 'admin' },
  { email: 'kbohlin@abigailadamsinstitute.org', fullName: 'Karen Bohlin', title: 'Project Lead, Co-Principal Investigator', role: 'facilitator' },
]

/** Module release dates outside the lab/session lists (each = the previous session's end). */
export const RELEASES = {
  northStar: '2027-01-27T13:30:00-05:00', // after Wisdom Lab Two
  deepLearningClosing: '2027-04-28T13:30:00-04:00', // after Wisdom Lab Five
  wisdomCoachingClosing: '2027-03-03T15:00:00-05:00', // after Wisdom Coaching Five
}
