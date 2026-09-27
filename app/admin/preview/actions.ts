'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  clearPreviewCookie,
  readPreviewCookie,
  setPreviewCookie,
} from '@/lib/admin-preview'
import { isCohort } from '@/lib/cohorts'

/**
 * Verify the *real* authenticated user (ignoring any active preview)
 * is an admin before mutating preview state. We bypass `requireAdmin()`
 * here on purpose: that helper reads the synthesized preview user, and
 * we explicitly need to check the underlying real account.
 */
async function assertRealAdmin(): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle<{ role: string }>()

  if (profile?.role !== 'admin') redirect('/dashboard')
}

/** Begin previewing the platform as a specific fellow profile. */
export async function startPreviewAsFellow(formData: FormData): Promise<void> {
  await assertRealAdmin()
  const fellowId = String(formData.get('fellowId') ?? '').trim()
  const referrer = String(formData.get('referrer') ?? '/admin').trim()
  if (!fellowId) return

  // Confirm the target is actually a fellow before impersonating - we
  // don't want to "preview as" another admin or facilitator.
  const supabase = await createClient()
  const { data: target } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', fellowId)
    .maybeSingle<{ id: string; role: string }>()

  if (!target || target.role !== 'fellow') return

  await setPreviewCookie({ type: 'by_fellow', fellowId: target.id, referrer })
  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

/** Begin previewing the platform as a generic fellow in a given cohort. */
export async function startPreviewAsCohort(formData: FormData): Promise<void> {
  await assertRealAdmin()
  const raw = String(formData.get('cohort') ?? '').trim()
  const referrer = String(formData.get('referrer') ?? '/admin').trim()
  if (!isCohort(raw)) return

  await setPreviewCookie({ type: 'by_cohort', cohort: raw, referrer })
  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

/** Exit preview mode and return to the admin's own session. */
export async function endPreview(formData: FormData): Promise<void> {
  // Get the stored referrer from the preview cookie before clearing it
  const preview = await readPreviewCookie()
  const referrer = preview?.referrer || '/admin'

  // Clearing the cookie is safe even for non-admins (it's a no-op for
  // them since they wouldn't have one), so we don't gate this. We do
  // still need to be authenticated, which middleware handles.
  await clearPreviewCookie()
  revalidatePath('/', 'layout')
  
  redirect(referrer)
}
