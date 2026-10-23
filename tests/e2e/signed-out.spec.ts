import { expect, test } from '@playwright/test'

/**
 * Signed-out visitors: nothing but the sign-in pages is reachable, and
 * no file, export or admin data leaks. Read-only requests, safe to run
 * against the real database.
 */

// A real-looking id: the route must refuse before it ever looks it up.
const SOME_ID = '00000000-0000-4000-8000-000000000000'

const PROTECTED_PAGES = [
  '/dashboard',
  '/reflections',
  '/profile',
  '/resources',
  '/notifications',
  `/phases/${SOME_ID}/modules/${SOME_ID}/items/${SOME_ID}`,
  '/admin',
  '/admin/users',
  '/admin/progress',
  `/admin/progress/${SOME_ID}`,
  '/admin/notifications',
]

// Files, exports and admin APIs: data, not pages.
const PROTECTED_DATA = [
  `/files/labs/${SOME_ID}`,
  '/files/mine/orientation-guide',
  `/api/files/labs/${SOME_ID}`,
  `/api/files/library/${SOME_ID}`,
  '/api/files/mine/orientation-guide',
  '/admin/progress/export',
  '/admin/progress/export?format=items',
  '/api/admin/maintenance/users',
  '/api/admin/custom-pages',
]

for (const path of PROTECTED_PAGES) {
  test(`signed out: ${path} sends you to sign in`, async ({ page }) => {
    const response = await page.goto(path)
    await expect(page).toHaveURL(/\/auth\/login/)
    expect(new URL(page.url()).searchParams.get('next')).toBe(path)
    expect(response?.status()).toBeLessThan(500)
  })
}

for (const path of PROTECTED_DATA) {
  test(`signed out: ${path} gives no data`, async ({ request }) => {
    const response = await request.get(path, { maxRedirects: 0 })
    // Redirected to sign in (or refused outright), never served.
    expect([301, 302, 303, 307, 308, 401, 403, 404]).toContain(response.status())
    const type = response.headers()['content-type'] ?? ''
    expect(type).not.toMatch(/pdf|csv|octet-stream|application\/json/)
    if (response.status() >= 300 && response.status() < 400) {
      expect(response.headers()['location']).toMatch(/\/auth\/login/)
    }
  })
}

test('the sign-in page loads with the PWP logo', async ({ page }) => {
  const response = await page.goto('/auth/login')
  expect(response?.status()).toBe(200)
  await expect(page.getByRole('img', { name: /Practical Wisdom Project/ }).first()).toBeVisible()
  await expect(page.getByRole('textbox').first()).toBeVisible()
})

test('the sign-in page has no console errors', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  await page.goto('/auth/login')
  await page.waitForLoadState('networkidle')
  expect(errors).toEqual([])
})

test('the feedback bubble is not shown to signed-out visitors', async ({ page }) => {
  await page.goto('/auth/login')
  await expect(page.getByRole('button', { name: /send feedback/i })).toHaveCount(0)
})
