import { test, expect } from '@playwright/test'

const userState = 'playwright/.auth/user.json'

test.use({ storageState: userState })
test.setTimeout(90000)

async function openAssignedProject(page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' })

  await expect(
    page.getByRole('heading', {
      name: 'Projects',
      exact: true,
    })
  ).toBeVisible({ timeout: 60000 })

  const project = page
    .getByText('devndespro', { exact: true })
    .filter({ visible: true })
    .first()

  await expect(project).toBeVisible({ timeout: 30000 })
  await project.click()

  await expect(page).toHaveURL(/\/site\/\d+\/?$/, {
    timeout: 30000,
  })

  const match = page.url().match(/\/site\/(\d+)/)
  expect(match).not.toBeNull()

  return match[1]
}

async function openSection(page, path, heading) {
  const siteId = await openAssignedProject(page)

  await page.goto(`/site/${siteId}/${path}`, {
    waitUntil: 'domcontentloaded',
  })

  await expect(page).toHaveURL(
    new RegExp(`/site/${siteId}/${path}/?$`)
  )

  await expect(
    page
      .getByRole('heading', {
        name: new RegExp(`^${heading}`, 'i'),
      })
      .filter({ visible: true })
      .first()
  ).toBeVisible({ timeout: 60000 })

  return siteId
}

test.describe('Integrations and AI Visibility - devndespro restricted user', () => {
  test('Integrations page opens and shows connection summary', async ({
    page,
  }) => {
    await openSection(page, 'integrations', 'Integrations')

    await expect(
      page.getByText('Connected', { exact: true }).first()
    ).toBeVisible()

    await expect(
      page.getByText('Available', { exact: true }).first()
    ).toBeVisible()

    const tabList = page.getByRole('tablist', {
      name: 'Integration type',
    })

    await expect(tabList).toBeVisible()
    await expect(tabList.getByRole('tab')).toHaveCount(3)

    await expect(page).toHaveURL(
      /\/site\/\d+\/integrations\/?$/
    )
  })

  test('Integration tabs expose the correct providers', async ({
    page,
  }) => {
    await openSection(page, 'integrations', 'Integrations')

    const tabList = page.getByRole('tablist', {
      name: 'Integration type',
    })

    const tabs = tabList.getByRole('tab')
    await expect(tabs).toHaveCount(3)

    await tabs.nth(0).click()

    await expect(
      page
        .getByRole('button', {
          name: /Google Search Console/i,
        })
        .filter({ visible: true })
        .first()
    ).toBeVisible()

    await tabs.nth(1).click()

    await expect(
      page
        .getByRole('button', { name: /Shopify/i })
        .filter({ visible: true })
        .first()
    ).toBeVisible()

    await expect(
      page
        .getByRole('button', { name: /Webflow/i })
        .filter({ visible: true })
        .first()
    ).toBeVisible()

    await tabs.nth(2).click()

    await expect(
      page
        .getByRole('button', {
          name: /Ahrefs CSV Import/i,
        })
        .filter({ visible: true })
        .first()
    ).toBeVisible()

    await expect(page).toHaveURL(
      /\/site\/\d+\/integrations\/?$/
    )
  })

  test('AI Visibility page opens with the correct access state', async ({
    page,
  }) => {
    await openSection(page, 'ai-visibility', 'AI Visibility')

    const fullAccess = page
      .getByRole('heading', {
        name: 'Questions AI Users Ask',
        exact: true,
      })
      .filter({ visible: true })

    const freeAccess = page
      .getByText(/Free plan shows your overall score/i)
      .filter({ visible: true })

    await expect(
      fullAccess.or(freeAccess).first()
    ).toBeVisible({ timeout: 60000 })

    await expect(page).toHaveURL(
      /\/site\/\d+\/ai-visibility\/?$/
    )
  })

  test('AI Visibility read-only controls are available', async ({
    page,
  }) => {
    await openSection(page, 'ai-visibility', 'AI Visibility')

    const questions = page
      .getByRole('heading', {
        name: 'Questions AI Users Ask',
        exact: true,
      })
      .filter({ visible: true })

    const freeMessage = page
      .getByText(/Free plan shows your overall score/i)
      .filter({ visible: true })

    await expect(
      questions.or(freeMessage).first()
    ).toBeVisible({ timeout: 60000 })

    if (await questions.first().isVisible()) {
      await expect(
        page
          .getByRole('button', {
            name: /Export Report/i,
          })
          .filter({ visible: true })
          .first()
      ).toBeVisible()
    } else {
      await expect(freeMessage.first()).toBeVisible()
    }

    await expect(page).toHaveURL(
      /\/site\/\d+\/ai-visibility\/?$/
    )
  })
})

