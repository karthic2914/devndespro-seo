import { test, expect } from '@playwright/test'

const userState = 'playwright/.auth/user.json'

test.setTimeout(90000)

async function openDevndespro(page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible({ timeout: 60000 })

  const project = page
    .getByText('devndespro', { exact: true })
    .filter({ visible: true })
    .first()

  await expect(project).toBeVisible({ timeout: 60000 })
  await project.click()
  await expect(page).toHaveURL(/\/site\/\d+\/?$/)
  await expect(page.getByRole('heading', { name: /^Overview(?:.*devndespro)?$/i }).first()).toBeVisible({ timeout: 60000 })
}

async function openSiteAudit(page, testInfo) {
  await openDevndespro(page)

  if (testInfo.project.name === 'android-responsive') {
    const navigation = page.getByRole('navigation', { name: 'Project navigation' })
    await expect(navigation).toBeVisible()
    await navigation.getByText('Audit', { exact: true }).click()
  } else {
    const sidebar = page.locator('.sidebar').first()
    await expect(sidebar).toBeVisible()
    await sidebar.getByText('Site Audit', { exact: true }).click()
  }

  await expect(page).toHaveURL(/\/site\/\d+\/audit\/?$/)
  await expect(page.getByRole('heading', { name: 'Site Audit', exact: true }).filter({ visible: true }).first()).toBeVisible({ timeout: 60000 })
}

function visibleText(page, text) {
  return page.getByText(text, { exact: true }).filter({ visible: true }).first()
}

test.describe('Site Audit - devndespro restricted user', () => {
  test.use({ storageState: userState })

  test('saved Site Audit results load', async ({ page }, testInfo) => {
    await openSiteAudit(page, testInfo)
    await expect(page.getByText(/Site health/i).filter({ visible: true }).first()).toBeVisible()
  })

  test('issue status filters are available and selectable', async ({ page }, testInfo) => {
    await openSiteAudit(page, testInfo)

    for (const label of ['Critical', 'Warnings', 'Passed']) {
      const filter = page
        .getByRole('button', { name: new RegExp('^' + label, 'i') })
        .filter({ visible: true })
        .first()

      await expect(filter).toBeVisible()
      await filter.click()
      await expect(page).toHaveURL(/\/site\/\d+\/audit\/?$/)
    }
  })

  test('On-Page SEO category can be selected', async ({ page }, testInfo) => {
    await openSiteAudit(page, testInfo)
    const category = visibleText(page, 'On-Page SEO')
    await expect(category).toBeVisible()
    await category.click()
    await expect(page.getByRole('heading', { name: 'Site Audit', exact: true }).filter({ visible: true }).first()).toBeVisible()
  })

  test('Action Plan opens from Site Audit', async ({ page }, testInfo) => {
    await openSiteAudit(page, testInfo)

    const actionButton = testInfo.project.name === 'android-responsive'
      ? page.getByRole('button', { name: 'Actions', exact: true }).filter({ visible: true }).first()
      : page.getByRole('button', { name: /Fix in Actions/i }).filter({ visible: true }).first()

    await expect(actionButton).toBeVisible()
    await actionButton.click()
    await expect(page).toHaveURL(/\/site\/\d+\/actions\/?$/)
    await expect(page.getByRole('heading', { name: /Action/i }).filter({ visible: true }).first()).toBeVisible({ timeout: 60000 })
  })
})

