/**
 * Launch switches for whole sections of the portal.
 *
 * Community (bios, posts, Q&A, the reflections feed) is planned for a
 * later phase and hidden from fellows at launch to keep the portal
 * focused. Staff still see it so it can be reviewed. Flip to true to
 * open it to everyone.
 */
export const COMMUNITY_ENABLED = false

export function canSeeCommunity(role: string | null | undefined): boolean {
  return COMMUNITY_ENABLED || role === 'admin' || role === 'facilitator'
}
