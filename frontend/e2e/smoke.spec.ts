import { expect, test } from '@playwright/test'

/**
 * Smoke test: the app boots and routes an unauthenticated visitor somewhere
 * sensible (the login screen, or the default authenticated landing page when
 * auth is disabled via VITE feature flags).
 *
 * NOTE: When Keycloak auth is enabled, deeper flows require a bypass or mocked
 * tokens. See docs/AUTH_FEATURE_FLAG.md.
 */
test('app loads and renders the shell', async ({ page }) => {
  await page.goto('/')

  // The document should have a title and a mounted React root.
  await expect(page).toHaveTitle(/.+/)
  await expect(page.locator('#root')).toBeAttached()

  // Should not be stuck on a blank/error page.
  const body = page.locator('body')
  await expect(body).not.toHaveText(/Cannot GET \//i)
})
