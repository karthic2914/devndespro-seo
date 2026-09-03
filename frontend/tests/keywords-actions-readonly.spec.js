import { test, expect } from '@playwright/test'

const userState = 'playwright/.auth/user.json'

test.use({ storageState: userState })
test.setTimeout(90000)

async function openAssignedProject(page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' })

  await expect(
    page.getByRole('heading', { name: 'Projects', exact: true })
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
    page.getByRole('heading', {
      name: heading,
      exact: true,
    }).filter({ visible: true }).first()
  ).toBeVisible({ timeout: 60000 })

  return siteId
}

test.describe('Keywords and Action Plan - devndespro restricted user', () => {
  test('Keywords page opens and shows its primary content', async ({
    page,
  }, testInfo) => {
    await openSection(page, 'keywords', 'Keywords')

    if (testInfo.project.name === 'android-responsive') {
      await expect(
        page.getByRole('heading', {
          name: 'Keyword Gap',
          exact: true,
        })
      ).toBeVisible()

      await expect(
        page.getByRole('heading', {
          name: 'Discover',
          exact: true,
        })
      ).toBeVisible()

      await expect(
        page.getByRole('button', {
          name: 'Rediscover keywords',
        })
      ).toBeVisible()
    } else {
      await expect(
        page.getByText(/^Tracked Keywords \(\d+\)$/)
      ).toBeVisible()

      await expect(
        page.getByPlaceholder('Filter tracked keywords')
      ).toBeVisible()
    }
  })

  test('Keywords filtering controls work without changing data', async ({
    page,
  }, testInfo) => {
    await openSection(page, 'keywords', 'Keywords')

    if (testInfo.project.name === 'android-responsive') {
      await expect(
        page.getByText(/Discover, research and track search opportunities/i)
      ).toBeVisible()

      await expect(
        page.getByRole('button', { name: /Refresh/i }).first()
      ).toBeVisible()
    } else {
      const filter = page.getByPlaceholder(
        'Filter tracked keywords'
      )

      await filter.fill('__no_keyword_should_match__')
      await expect(filter).toHaveValue(
        '__no_keyword_should_match__'
      )

      await filter.fill('')
      await expect(filter).toHaveValue('')

      await expect(
        page.getByRole('button', { name: /^All \(\d+\)$/ })
      ).toBeVisible()
    }

    await expect(page).toHaveURL(/\/site\/\d+\/keywords\/?$/)
  })

  test('Action Plan opens and shows progress information', async ({
    page,
  }, testInfo) => {
    await openSection(page, 'actions', 'Action Plan')

    await expect(
      page.getByText(/\d+% completed/i).first()
    ).toBeVisible({ timeout: 30000 })

    await expect(
      page.getByText(/Numbered by ranking impact/i).filter({ visible: true }).first()
    ).toBeVisible()

    if (testInfo.project.name === 'android-responsive') {
      await expect(
        page.getByRole('button', { name: /Refresh/i }).first()
      ).toBeVisible()
    } else {
      await expect(
        page.getByRole('button', {
          name: /Refresh priorities/i,
        })
      ).toBeVisible()

      await expect(
        page.getByText('Priority guide:', { exact: true })
      ).toBeVisible()
    }
  })

  test('Action Plan navigation controls are available', async ({
    page,
  }, testInfo) => {
    await openSection(page, 'actions', 'Action Plan')

    if (testInfo.project.name === 'android-responsive') {
      const mobileTabs = page.locator('.ma-tabs')

      const nextBest = mobileTabs.getByRole('button', {
        name: 'Next best',
        exact: true,
      })

      const pending = mobileTabs.getByRole('button', {
        name: /Pending/i,
      })

      const completed = mobileTabs.getByRole('button', {
        name: /Completed/i,
      })

      await expect(nextBest).toBeVisible()
      await expect(pending).toBeVisible()
      await expect(completed).toBeVisible()

      await pending.click()
      await completed.click()
      await nextBest.click()
    } else {
      await expect(
        page.getByText(/^Do now \(\d+\)$/).first()
      ).toBeVisible()

      await expect(
        page.getByText(/^Soon \(\d+\)$/).first()
      ).toBeVisible()

      await expect(
        page.getByText(/^Later \(\d+\)$/).first()
      ).toBeVisible()

      await expect(
        page.getByPlaceholder('New action item...')
      ).toBeVisible()
    }

    await expect(page).toHaveURL(/\/site\/\d+\/actions\/?$/)
  })
})


