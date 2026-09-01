import { test, expect } from '@playwright/test'

const adminState = 'playwright/.auth/admin.json'
const userState = 'playwright/.auth/user.json'

test.describe('Users module - administrator', () => {
  test.use({ storageState: adminState })

  test('users page shows its primary sections', async ({ page }) => {
    await page.goto('/users')
    await expect(page.getByRole('heading', { name: 'Team & Users' })).toBeVisible()
    await expect(page.getByText('Plans & feature access', { exact: true })).toBeVisible()
    await expect(page.getByText('Invite a new user', { exact: true })).not.toHaveCount(0)
    await expect(page.getByText(/Invited users/i)).not.toHaveCount(0)
  })

  test('administrator has plan-management controls', async ({ page }) => {
    await page.goto('/users')
    await expect(page.getByRole('heading', { name: 'Team & Users' })).toBeVisible()
    await expect(page.locator('select')).not.toHaveCount(0)
  })

  test('mobile users page fits the viewport', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'android-responsive', 'Android responsive test only')
    await page.goto('/users')
    await expect(page.getByRole('heading', { name: 'Team & Users' })).toBeVisible()

    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > window.innerWidth + 1
    )
    expect(overflow).toBe(false)
  })
})

test.describe('Users module - restricted user', () => {
  test.use({ storageState: userState })

  test('restricted user is denied the users route', async ({ page }) => {
    await page.goto('/users')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/users\/?$/)
    await expect(page.getByRole('heading', { name: 'Team & Users' })).toHaveCount(0)
  })
})


