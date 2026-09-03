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

test.describe('Email Reports - devndespro restricted user', () => {
  test('Email Reports page shows status and report contents', async ({
    page,
  }) => {
    await openSection(page, 'email-reports', 'Email Reports')

    await expect(
      page.getByRole('region', {
        name: 'Email report status',
      })
    ).toBeVisible()

    await expect(
      page
        .getByRole('heading', {
          name: 'Delivery schedule',
          exact: true,
        })
        .filter({ visible: true })
        .first()
    ).toBeVisible()

    await expect(
      page
        .getByRole('heading', {
          name: 'Recipients',
          exact: true,
        })
        .filter({ visible: true })
        .first()
    ).toBeVisible()

    await expect(
      page
        .getByRole('heading', {
          name: 'Report contents',
          exact: true,
        })
        .filter({ visible: true })
        .first()
    ).toBeVisible()
  })

  test('Email Report configuration controls are available', async ({
    page,
  }) => {
    await openSection(page, 'email-reports', 'Email Reports')

    await expect(
      page.getByLabel('Frequency')
    ).toBeVisible()

    await expect(
      page.getByLabel('Send time')
    ).toBeVisible()

    const recipient = page.getByLabel('Email address')
    await expect(recipient).toBeVisible()

    await recipient.fill('test-validation@example.com')
    await expect(recipient).toHaveValue(
      'test-validation@example.com'
    )

    await recipient.fill('')
    await expect(recipient).toHaveValue('')

    await expect(
      page.getByRole('button', {
        name: /Send report now/i,
      })
    ).toBeVisible()

    await expect(page).toHaveURL(
      /\/site\/\d+\/email-reports\/?$/
    )
  })
})

test.describe('Backlinks - devndespro restricted user', () => {
  test('Backlinks page opens and shows backlink workspace', async ({
    page,
  }) => {
    await openSection(page, 'backlinks', 'Backlinks')

    await expect(
      page.getByText(
        /One workspace for link pulse, health, sources, and growth opportunities/i
      ).filter({ visible: true }).first()
    ).toBeVisible()

    const addMode = page.getByRole('tablist', {
      name: 'Add mode',
    }).filter({ visible: true }).first()

    await expect(addMode).toBeVisible()
    await expect(addMode.getByRole('tab')).toHaveCount(2)

    await expect(page).toHaveURL(
      /\/site\/\d+\/backlinks\/?$/
    )
  })

  test('Backlink add modes switch without saving data', async ({
    page,
  }) => {
    await openSection(page, 'backlinks', 'Backlinks')

    const addMode = page.getByRole('tablist', {
      name: 'Add mode',
    }).filter({ visible: true }).first()

    const tabs = addMode.getByRole('tab')
    await expect(tabs).toHaveCount(2)

    await tabs.nth(0).click()

    await expect(
      page
        .getByPlaceholder('e.g. clutch.co')
        .filter({ visible: true })
        .first()
    ).toBeVisible()

    await tabs.nth(1).click()

    await expect(
      page
        .getByPlaceholder(
          'https://example.com/post-with-your-link'
        )
        .filter({ visible: true })
        .first()
    ).toBeVisible()

    await expect(page).toHaveURL(
      /\/site\/\d+\/backlinks\/?$/
    )
  })
})

test.describe('Competitors - devndespro restricted user', () => {
  test('Competitors page shows summary and comparison', async ({
    page,
  }) => {
    await openSection(page, 'competitors', 'Competitors')

    await expect(
      page.getByRole('region', {
        name: 'Competitor summary',
      })
    ).toBeVisible()

    await expect(
      page
        .getByRole('heading', {
          name: 'Comparison',
          exact: true,
        })
        .filter({ visible: true })
        .first()
    ).toBeVisible()

    await expect(
      page.getByText(/\d+ tracked/i)
        .filter({ visible: true })
        .first()
    ).toBeVisible()

    await expect(page).toHaveURL(
      /\/site\/\d+\/competitors\/?$/
    )
  })

  test('Add competitor form opens and closes without saving', async ({
    page,
  }, testInfo) => {
    await openSection(page, 'competitors', 'Competitors')

    const addButton =
      testInfo.project.name === 'android-responsive'
        ? page
            .locator('main .competitors-clean__header button')
            .filter({ visible: true })
            .first()
        : page
            .getByRole('button', {
              name: 'Add competitor',
              exact: true,
            })
            .filter({ visible: true })
            .first()

    await expect(addButton).toBeVisible()
    await addButton.click()

    const formHeading = page
      .getByRole('heading', {
        name: 'Add competitor',
        exact: true,
      })
      .filter({ visible: true })
      .first()

    await expect(formHeading).toBeVisible()

    const domain = page
      .getByPlaceholder('competitor.com')
      .filter({ visible: true })
      .first()

    await expect(domain).toBeVisible()
    await domain.fill('test-only.example')

    await expect(domain).toHaveValue('test-only.example')

    await page
      .getByRole('button', {
        name: 'Close',
        exact: true,
      })
      .filter({ visible: true })
      .first()
      .click()

    await expect(formHeading).toBeHidden()

    await expect(page).toHaveURL(
      /\/site\/\d+\/competitors\/?$/
    )
  })
})



