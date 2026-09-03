import { test, expect } from '@playwright/test'

const adminState = 'playwright/.auth/admin.json'
const userState = 'playwright/.auth/user.json'

test.setTimeout(90000)

async function findProjectId(page, projectName) {
  await page.goto('/', { waitUntil: 'domcontentloaded' })

  await expect(
    page.getByRole('heading', {
      name: 'Projects',
      exact: true,
    })
  ).toBeVisible({ timeout: 60000 })

  const project = page
    .getByText(projectName, { exact: true })
    .filter({ visible: true })
    .first()

  await expect(project).toBeVisible({ timeout: 60000 })
  await project.click()

  await expect(page).toHaveURL(/\/site\/\d+\/?$/, {
    timeout: 60000,
  })

  const match = page.url().match(/\/site\/(\d+)/)
  expect(match).not.toBeNull()

  return match[1]
}

async function openSection(page, projectName, path) {
  const siteId = await findProjectId(page, projectName)

  await page.goto(`/site/${siteId}/${path}`, {
    waitUntil: 'domcontentloaded',
  })

  await expect(page).toHaveURL(
    new RegExp(`/site/${siteId}/${path}/?$`),
    { timeout: 60000 }
  )

  await expect(
    page.locator('h1').filter({ visible: true }).first()
  ).toBeVisible({ timeout: 60000 })

  return siteId
}

async function expectNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => {
    const documentWidth = document.documentElement.scrollWidth
    return documentWidth > window.innerWidth + 2
  })

  expect(overflow).toBe(false)
}

/*
 * ALERTS
 * Read-only: filters are changed only in browser state.
 */
test.describe('Alerts - devndespro restricted user', () => {
  test.use({ storageState: userState })

  test('Alerts page opens and exposes status filters', async ({ page }) => {
    await openSection(page, 'devndespro', 'alerts')

    await expect(
      page.getByRole('heading', {
        name: 'Alerts',
        exact: true,
      }).filter({ visible: true }).first()
    ).toBeVisible()

    for (const name of [/^All \(/i, /^Unread \(/i, /^Errors$/i, /^Warnings$/i]) {
      await expect(
        page.getByRole('button', { name })
          .filter({ visible: true })
          .first()
      ).toBeVisible()
    }

    await expect(
      page.getByText(
        'Notifications from audits, ranking changes, and system events',
        { exact: true }
      ).filter({ visible: true }).first()
    ).toBeVisible()
  })

  test('Alerts filters can be selected without changing data', async ({ page }) => {
    await openSection(page, 'devndespro', 'alerts')

    for (const name of [/^Unread \(/i, /^Errors$/i, /^Warnings$/i, /^All \(/i]) {
      const filter = page
        .getByRole('button', { name })
        .filter({ visible: true })
        .first()

      await expect(filter).toBeVisible()
      await filter.click()

      await expect(page).toHaveURL(/\/site\/\d+\/alerts\/?$/)
    }

    await expectNoHorizontalOverflow(page)
  })
})

/*
 * COLD EMAIL
 * Administrator is used because Cold Email is owner/plan restricted.
 * These tests do not save drafts, send emails, edit history, or delete records.
 */
test.describe('Cold Email - administrator', () => {
  test.use({ storageState: adminState })

  test('Cold Email workspace opens with summary and tabs', async ({ page }) => {
    await openSection(page, 'wizstar', 'cold-emails')

    await expect(
      page.getByRole('heading', {
        name: 'Cold Email',
        exact: true,
      }).filter({ visible: true }).first()
    ).toBeVisible()

    await expect(
      page.getByRole('region', {
        name: 'Cold email summary',
      })
    ).toBeVisible()

    const sections = page.getByRole('navigation', {
      name: 'Cold email sections',
    })

    await expect(sections).toBeVisible()

    for (const name of ['Drafts', 'Compose', 'History']) {
      await expect(
        sections.getByRole('button', {
          name,
          exact: true,
        })
      ).toBeVisible()
    }
  })

  test('Cold Email tabs open without saving or sending', async ({ page }) => {
    await openSection(page, 'wizstar', 'cold-emails')

    const sections = page.getByRole('navigation', {
      name: 'Cold email sections',
    })

    await sections.getByRole('button', {
      name: 'Compose',
      exact: true,
    }).click()

    await expect(
      page.getByRole('heading', {
        name: /Compose email|Compose follow-up/i,
      }).filter({ visible: true }).first()
    ).toBeVisible()

    await expect(
      page.getByPlaceholder('name@company.com')
        .filter({ visible: true })
        .first()
    ).toBeVisible()

    await expect(
      page.getByRole('button', {
        name: 'Review & send',
        exact: true,
      }).filter({ visible: true }).first()
    ).toBeVisible()

    await sections.getByRole('button', {
      name: 'History',
      exact: true,
    }).click()

    await expect(
      page.getByRole('heading', {
        name: 'History',
        exact: true,
      }).filter({ visible: true }).first()
    ).toBeVisible()

    await expectNoHorizontalOverflow(page)
  })
})

/*
 * BACKLINK CSV EXPORT
 * This validates the real browser download without modifying application data.
 */
test.describe('Backlinks CSV export - devndespro restricted user', () => {
  test.use({ storageState: userState })

  test('Backlinks exposes the CSV export control', async ({ page }) => {
    await openSection(page, 'devndespro', 'backlinks')

    const exportButton = page
      .getByRole('button', {
        name: /Export CSV/i,
      })
      .filter({ visible: true })
      .first()

    await expect(exportButton).toBeVisible({
      timeout: 60000,
    })

    await expect(exportButton).toBeEnabled()
    await expectNoHorizontalOverflow(page)
  })

  test('Backlinks downloads a non-empty CSV file', async ({ page }) => {
    await openSection(page, 'devndespro', 'backlinks')

    const exportButton = page
      .getByRole('button', {
        name: /Export CSV/i,
      })
      .filter({ visible: true })
      .first()

    await expect(exportButton).toBeVisible({
      timeout: 60000,
    })

    const downloadPromise = page.waitForEvent('download')
    await exportButton.click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toMatch(/backlinks.*\.csv$/i)

    const failure = await download.failure()
    expect(failure).toBeNull()

    const stream = await download.createReadStream()
    const chunks = []

    for await (const chunk of stream) {
      chunks.push(chunk)
    }

    const csv = Buffer.concat(chunks).toString('utf8')

    expect(csv.length).toBeGreaterThan(10)
    expect(csv).toContain(',')
  })
})

