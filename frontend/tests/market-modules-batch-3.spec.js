import { test, expect } from '@playwright/test'

const userState = 'playwright/.auth/user.json'
const emptyState = {
  cookies: [],
  origins: [],
}

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

async function openAudit(page) {
  const siteId = await findProjectId(page, 'devndespro')

  await page.goto(`/site/${siteId}/audit`, {
    waitUntil: 'domcontentloaded',
  })

  await expect(page).toHaveURL(
    new RegExp(`/site/${siteId}/audit/?$`),
    { timeout: 60000 }
  )

  await expect(
    page.getByRole('heading', {
      name: 'Site Audit',
      exact: true,
    }).filter({ visible: true }).first()
  ).toBeVisible({ timeout: 60000 })

  return siteId
}

async function getCrawledPagesControls(page) {
  const viewButton = page
    .getByRole('button', {
      name: /View crawled pages/i,
    })
    .filter({ visible: true })
    .first()

  await expect(viewButton).toBeVisible({ timeout: 60000 })
  await viewButton.click()

  const heading = page
    .getByText('Crawled Pages', { exact: true })
    .filter({ visible: true })
    .first()

  await expect(heading).toBeVisible({ timeout: 60000 })

  return heading.locator('..')
}

async function readDownload(download) {
  const failure = await download.failure()
  expect(failure).toBeNull()

  const stream = await download.createReadStream()
  const chunks = []

  for await (const chunk of stream) {
    chunks.push(chunk)
  }

  return Buffer.concat(chunks)
}

/*
 * AUTHENTICATION AND SESSION PROTECTION
 */
test.describe('Authentication and session protection', () => {
  test.describe('Anonymous user', () => {
    test.use({ storageState: emptyState })

    test('anonymous user is redirected from a protected route', async ({ page }) => {
      await page.goto('/reports', {
        waitUntil: 'domcontentloaded',
      })

      await expect(page).toHaveURL(/\/login\/?$/, {
        timeout: 60000,
      })

      await expect(
        page.getByRole('heading', {
          name: 'Sign in to DevnDespro SEO',
          exact: true,
        })
      ).toBeVisible()
    })
  })

  test.describe('Authenticated restricted user', () => {
    test.use({ storageState: userState })

    test('saved session grants access to the assigned project', async ({ page }) => {
      await openAudit(page)

      await expect(page).toHaveURL(/\/site\/\d+\/audit\/?$/)

      await expect(
        page.getByRole('button', {
          name: /Sign out/i,
        }).filter({ visible: true }).first()
      ).toBeVisible()
    })
  })
})

/*
 * LOCAL LOGIN VALIDATION
 * These tests do not make a login request.
 */
test.describe('Login input validation', () => {
  test.use({ storageState: emptyState })

  test('empty email is rejected locally', async ({ page }) => {
    await page.goto('/login', {
      waitUntil: 'domcontentloaded',
    })

    const email = page.getByPlaceholder(
      'Enter your work or personal email'
    )

    await expect(email).toBeVisible()
    await email.press('Enter')

    await expect(
      page.getByText(
        'Enter a valid email address to continue.',
        { exact: true }
      )
    ).toBeVisible()

    await expect(page).toHaveURL(/\/login\/?$/)
  })

  test('malformed email is rejected locally', async ({ page }) => {
    await page.goto('/login', {
      waitUntil: 'domcontentloaded',
    })

    const email = page.getByPlaceholder(
      'Enter your work or personal email'
    )

    await email.fill('not-an-email')
    await email.press('Enter')

    await expect(
      page.getByText(
        'Enter a valid email address to continue.',
        { exact: true }
      )
    ).toBeVisible()

    await expect(page).toHaveURL(/\/login\/?$/)
  })
})

/*
 * SITE AUDIT EXPORTS
 * Downloads files locally without changing application data.
 */
test.describe('Site Audit exports - devndespro restricted user', () => {
  test.use({ storageState: userState })

  test('Crawled Pages downloads a valid CSV file', async ({ page }) => {
    await openAudit(page)

    const controls = await getCrawledPagesControls(page)
    const csvButton = controls
      .getByRole('button', {
        name: 'CSV',
        exact: true,
      })
      .filter({ visible: true })
      .first()

    await expect(csvButton).toBeVisible()

    const downloadPromise = page.waitForEvent('download')
    await csvButton.click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toMatch(
      /crawled-pages-\d{4}-\d{2}-\d{2}\.csv$/i
    )

    const file = await readDownload(download)
    const csv = file.toString('utf8')

    expect(file.length).toBeGreaterThan(20)
    expect(csv).toContain(',')
    expect(csv).toMatch(/URL|Status|Title/i)
  })

  test('Crawled Pages downloads a valid PDF file', async ({ page }) => {
    await openAudit(page)

    const controls = await getCrawledPagesControls(page)
    const pdfButton = controls
      .getByRole('button', {
        name: 'PDF',
        exact: true,
      })
      .filter({ visible: true })
      .first()

    await expect(pdfButton).toBeVisible()

    const downloadPromise = page.waitForEvent('download')
    await pdfButton.click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toMatch(
      /crawled-pages-\d{4}-\d{2}-\d{2}\.pdf$/i
    )

    const file = await readDownload(download)

    expect(file.length).toBeGreaterThan(100)
    expect(file.subarray(0, 4).toString()).toBe('%PDF')
  })
})

