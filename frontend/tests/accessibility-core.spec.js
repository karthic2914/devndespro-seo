import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const adminState = 'playwright/.auth/admin.json'
const userState = 'playwright/.auth/user.json'
const emptyState = { cookies: [], origins: [] }

test.setTimeout(90000)

async function checkAccessibility(page, testInfo) {
  const results = await new AxeBuilder({ page })
    .withTags([
      'wcag2a',
      'wcag2aa',
      'wcag21a',
      'wcag21aa',
      'wcag22aa',
    ])
    .analyze()

  await testInfo.attach('axe-accessibility-results', {
    body: JSON.stringify(results, null, 2),
    contentType: 'application/json',
  })

  const seriousViolations = results.violations.filter(
    violation =>
      violation.impact === 'critical' ||
      violation.impact === 'serious'
  )

  const summary = seriousViolations
    .map(violation => {
      const elements = violation.nodes
        .map(node =>
          `  Target: ${node.target.join(' > ')}` +
          `\n  HTML: ${node.html}`
        )
        .join('\n')

      return (
        `${violation.id}: ${violation.help} ` +
        `(${violation.nodes.length} elements)\n${elements}`
      )
    })
    .join('\n\n')

  expect(
    seriousViolations.length,
    `Accessibility violations:` + "\n" + summary
  ).toBe(0)
}

test.describe('Core accessibility - anonymous user', () => {
  test.use({ storageState: emptyState })

  test('Login page has no serious accessibility violations', async ({
    page,
  }, testInfo) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' })

    await expect(
      page.getByRole('heading', {
        name: /Sign in to DevnDespro SEO/i,
      })
    ).toBeVisible()

    await checkAccessibility(page, testInfo)
  })
})

test.describe('Core accessibility - administrator', () => {
  test.use({ storageState: adminState })

  test('Projects dashboard has no serious accessibility violations', async ({
    page,
  }, testInfo) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    await expect(
      page.getByRole('heading', {
        name: 'Projects',
        exact: true,
      })
    ).toBeVisible({ timeout: 60000 })

    await expect(
      page.getByText('Loading...', { exact: true })
    ).toBeHidden({ timeout: 60000 })

    await checkAccessibility(page, testInfo)
  })
})

test.describe('Core accessibility - restricted user', () => {
  test.use({ storageState: userState })

  test('Project Overview has no serious accessibility violations', async ({
    page,
  }, testInfo) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    await expect(
      page.getByRole('heading', {
        name: 'Projects',
        exact: true,
      })
    ).toBeVisible({ timeout: 60000 })

    await expect(
      page.getByText('Loading...', { exact: true })
    ).toBeHidden({ timeout: 60000 })

    const project = page
      .getByText('devndespro', { exact: true })
      .filter({ visible: true })
      .first()

    await expect(project).toBeVisible({ timeout: 30000 })
    await project.click()

    await expect(page).toHaveURL(/\/site\/\d+\/?$/)

    await expect(
      page
        .getByRole('heading', {
          name: /^Overview/i,
        })
        .filter({ visible: true })
        .first()
    ).toBeVisible({ timeout: 60000 })

    await expect(
      page.getByText('Loading...', { exact: true })
    ).toBeHidden({ timeout: 60000 })

    await checkAccessibility(page, testInfo)
  })
})





