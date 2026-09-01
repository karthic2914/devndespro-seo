import { test, expect } from '@playwright/test'

const adminState = 'playwright/.auth/admin.json'
const userState = 'playwright/.auth/user.json'

async function openProjects(page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible()
}

test.describe('Administrator projects', () => {
  test.use({ storageState: adminState })

  test('admin can open the projects dashboard', async ({ page }) => {
    await openProjects(page)
    await expect(page.getByText('117', { exact: true })).not.toHaveCount(0)
    await expect(page.getByText('Users', { exact: true }).first()).toBeVisible()
  })

  test('project search filters and clears results', async ({ page }) => {
    await openProjects(page)
    const search = page.locator('input[placeholder="Search projects..."]:visible').first()

    await search.fill('wizstar')
    await expect(page.getByText('wizstar', { exact: true })).not.toHaveCount(0)
    await expect(page.getByText('amilthu', { exact: true })).toHaveCount(0)

    await search.fill('')
    await expect(page.getByText('amilthu', { exact: true })).not.toHaveCount(0)
  })

  test('mobile project filter opens and applies', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'android-responsive', 'Android responsive test only')
    await openProjects(page)

    await page.getByRole('button', { name: 'Open project filters' }).first().click()
    await expect(page.getByRole('dialog', { name: 'Filter & sort' })).toBeVisible()
    await page.getByRole('button', { name: /Needs attention/ }).click()
    await page.getByRole('button', { name: /Show \d+ projects?/ }).click()
    await expect(page.getByRole('dialog', { name: 'Filter & sort' })).toBeHidden()
  })
})

test.describe('Restricted user isolation', () => {
  test.use({ storageState: userState })

  test('restricted user sees only the assigned project', async ({ page }) => {
    await openProjects(page)
    await expect(page.getByText('devndespro', { exact: true })).not.toHaveCount(0)
    await expect(page.getByText('117', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Users', { exact: true })).toHaveCount(0)
  })

  test('restricted user cannot open user administration', async ({ page }) => {
    await page.goto('/users')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/users\/?$/)
  })
})




