/**
 * Survey links can carry the fellow's Unique ID as a Google Forms
 * prefill: put this token where the ID goes, e.g.
 *   https://docs.google.com/forms/d/e/<form>/viewform?usp=pp_url&entry.2117511694=UNIQUE_ID
 * The survey page swaps in the signed-in fellow's own ID, so their
 * response matches them without retyping it.
 */
export const UNIQUE_ID_TOKEN = 'UNIQUE_ID'

/** The link with the fellow's ID filled in, or the prefill dropped when there's none. */
export function fillUniqueId(url: string, researchId: string | null): string {
  if (!url.includes(UNIQUE_ID_TOKEN)) return url
  if (researchId) return url.replaceAll(UNIQUE_ID_TOKEN, encodeURIComponent(researchId))
  // No ID on file (staff, cohort preview): open the blank form.
  return url.replace(/[?&]entry\.\d+=UNIQUE_ID/g, '')
}
