import { test, expect } from '@playwright/test'

const adminState = 'playwright/.auth/admin.json'
const userState = 'playwright/.auth/user.json'

async function openModule(page, path, title) {
  await page.goto(path, { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(new RegExp(`${path.replace('/', '\\/')}\\/?$`))
  await expect(page.getByRole('heading', { name: new RegExp(title, 'i') }).first()).toBeVisible()
}

async function navigateFromApp(page, testInfo, label, path) {
  await page.goto('/', { waitUntil: 'domcontentloaded' })

  if (testInfo.project.name === 'android-responsive') {
    await page.getByRole('button', { name: 'Menu' }).click()
    const openSidebar = page.locator('.sidebar--open')
    await expect(openSidebar).toBeVisible()
    await openSidebar.getByText(label, { exact: true }).click()
  } else {
    await page.locator('.sidebar').getByText(label, { exact: true }).click()
  }

  await expect(page).toHaveURL(new RegExp(`${path.replace('/', '\\/')}\\/?$`))
}

async function expectNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth > window.innerWidth + 1
  )
  expect(overflow).toBe(false)
}

for (const moduleInfo of [
  { label: 'Tools', path: '/tools', heading: 'AI Citation Optimizer' },
  { label: 'Settings', path: '/settings', heading: 'Settings' },
]) {
  test.describe(`${moduleInfo.label} module - administrator`, () => {
    test.use({ storageState: adminState })

    test(`administrator can open ${moduleInfo.label} directly`, async ({ page }) => {
      await openModule(page, moduleInfo.path, moduleInfo.heading)
    })

    test(`${moduleInfo.label} navigation works from the application`, async ({ page }, testInfo) => {
      await navigateFromApp(page, testInfo, moduleInfo.label, moduleInfo.path)
      await expect(page.getByRole('heading', { name: new RegExp(moduleInfo.heading, 'i') }).first()).toBeVisible()
    })

    test(`mobile ${moduleInfo.label} page fits the viewport`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'android-responsive', 'Android responsive test only')
      await openModule(page, moduleInfo.path, moduleInfo.heading)
      await expectNoHorizontalOverflow(page)
    })
  })

  test.describe(`${moduleInfo.label} module - restricted user`, () => {
    test.use({ storageState: userState })

    test(`restricted user can open ${moduleInfo.label}`, async ({ page }) => {
      await openModule(page, moduleInfo.path, moduleInfo.heading)
      await expect(page.getByText('Users', { exact: true })).toHaveCount(0)
    })
  })
}

