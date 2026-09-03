import { test, expect } from '@playwright/test'

const adminState = 'playwright/.auth/admin.json'
const userState = 'playwright/.auth/user.json'

async function openReports(page) {
  await page.goto('/reports', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/reports\/?$/)
  await expect(page.getByRole('heading', { name: /Reports/i }).first()).toBeVisible()
}

test.describe('Reports module - administrator', () => {
  test.use({ storageState: adminState })

  test('administrator can open Reports directly', async ({ page }) => {
    await openReports(page)
  })

  test('Reports navigation works from the application', async ({ page }, testInfo) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    if (testInfo.project.name === 'android-responsive') {
      await page.getByRole('button', { name: 'Menu' }).click()

      const openSidebar = page.locator('.sidebar--open')
      await expect(openSidebar).toBeVisible()
      await openSidebar.getByText('Reports', { exact: true }).click()
    } else {
      await page
        .locator('.sidebar')
        .getByText('Reports', { exact: true })
        .click()
    }
    await expect(page).toHaveURL(/\/reports\/?$/)
    await expect(page.getByRole('heading', { name: /Reports/i }).first()).toBeVisible()
  })

  test('mobile Reports page fits the viewport', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'android-responsive', 'Android responsive test only')
    await openReports(page)

    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > window.innerWidth + 1
    )
    expect(overflow).toBe(false)
  })
})

test.describe('Reports module - restricted user', () => {
  test.use({ storageState: userState })

  test('restricted user can open Reports without gaining admin navigation', async ({ page }) => {
    await openReports(page)
    await expect(page.getByText('Users', { exact: true })).toHaveCount(0)
  })
})




