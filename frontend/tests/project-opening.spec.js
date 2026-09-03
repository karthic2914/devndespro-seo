import { test, expect } from '@playwright/test'

const adminState = 'playwright/.auth/admin.json'
const userState = 'playwright/.auth/user.json'

test.setTimeout(90000)

async function openProject(page, projectName) {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Loading...', { exact: true })).toBeHidden({ timeout: 30000 })
  await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible({ timeout: 60000 })

  const projectNameElement = page
    .getByText(projectName, { exact: true })
    .filter({ visible: true })
    .first()

  await expect(projectNameElement).toBeVisible()
  await projectNameElement.click()
  await expect(page).toHaveURL(/\/site\/\d+\/?$/)
  await expect(page.getByRole('heading', { name: new RegExp(`^Overview(?:.*${projectName})?$`, 'i') }).first()).toBeVisible({ timeout: 60000 })

  const match = page.url().match(/\/site\/(\d+)/)
  expect(match).not.toBeNull()
  return match[1]
}

async function openProjectSection(page, testInfo, label, expectedPath) {
  if (testInfo.project.name === 'android-responsive') {
    const projectNavigation = page.getByRole('navigation', { name: 'Project navigation' })
    await expect(projectNavigation).toBeVisible()
    await projectNavigation.getByText(label, { exact: true }).click()
  } else {
    const sidebar = page.locator('.sidebar').first()
    const desktopLabel =
      label === 'Audit' ? 'Site Audit' :
      label === 'Actions' ? 'Action Plan' :
      label

    await expect(sidebar).toBeVisible()
    await sidebar.getByText(desktopLabel, { exact: true }).click()
  }

  await expect(page).toHaveURL(new RegExp(`/site/\\d+/${expectedPath}/?$`))
  await expect(page.getByRole('heading', { name: new RegExp(label.replace(/s$/, ''), 'i') }).first()).toBeVisible({ timeout: 60000 })
}

test.describe('Project opening - administrator', () => {
  test.use({ storageState: adminState })

  test('administrator opens wizstar from the Projects dashboard', async ({ page }) => {
    await openProject(page, 'wizstar')
    await expect(page.getByText('wizstar', { exact: true }).filter({ visible: true }).first()).toBeVisible()
  })

  for (const section of [
    { label: 'Audit', path: 'audit' },
    { label: 'Keywords', path: 'keywords' },
    { label: 'Actions', path: 'actions' },
  ]) {
    test(`administrator opens project ${section.label}`, async ({ page }, testInfo) => {
      await openProject(page, 'wizstar')
      await openProjectSection(page, testInfo, section.label, section.path)
    })
  }
})

test.describe('Project opening - restricted user', () => {
  test.use({ storageState: userState })

  test('restricted user opens the assigned devndespro project', async ({ page }) => {
    await openProject(page, 'devndespro')
    await expect(page.getByText('devndespro', { exact: true }).filter({ visible: true }).first()).toBeVisible()
  })

  test('restricted project navigation does not expose Users', async ({ page }) => {
    await openProject(page, 'devndespro')
    await expect(page.getByText('Users', { exact: true })).toHaveCount(0)
  })
})






