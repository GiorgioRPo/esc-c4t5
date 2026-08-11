import { test, expect } from '@playwright/test'

const BASE_URL = 'http://localhost:3000'

test.describe('Home page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL)
  })

  test('shows the hero heading and search bar', async ({ page }) => {
    await expect(page.locator('h1', { hasText: /travel rewards/i })).toBeVisible()
    await expect(page.getByPlaceholder('Where are you going?')).toBeVisible()
  })

  test('displays popular destinations', async ({ page }) => {
    const links = page.locator('a[href*="/hotels"]')
    await expect(links.first()).toBeVisible()
    expect(await links.count()).toBeGreaterThan(0)
  })

  test('navigates to hotels page when clicking a popular destination', async ({ page }) => {
    const firstDestLink = page.locator('a[href*="/hotels"]').first()
    await firstDestLink.click()
    await expect(page).toHaveURL(/\/hotels/)
  })
})

test.describe('Destination autocomplete', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL)
  })

  test('opens suggestions dropdown when typing a destination', async ({ page }) => {
    const input = page.getByPlaceholder('Where are you going?')
    await input.fill('Sing')

    // Wait for the dropdown to appear (local Fuse.js matching)
    await expect(page.getByRole('listbox').or(page.locator('.absolute')).first()).toBeVisible({ timeout: 5000 })
  })

  test('selects a destination from the dropdown', async ({ page }) => {
    const input = page.getByPlaceholder('Where are you going?')
    await input.fill('Singapur')
    // Click the suggestion instead of using keyboard nav (buttons, not listbox)
    await page.getByRole('button', { name: /singapore/i }).first().click()

    await expect(input).toHaveValue(/singapore/i)
  })

  test('does not open suggestions for single character input', async ({ page }) => {
    const input = page.getByPlaceholder('Where are you going?')
    await input.fill('S')
    // Should not show any suggestion buttons
    await expect(page.getByRole('button', { name: /singapore/i })).not.toBeVisible()
  })
})

test.describe('Search flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL)
  })

  test('submits search and lands on the hotels results page', async ({ page }) => {
    const input = page.getByPlaceholder('Where are you going?')
    await input.fill('Tokyo')
    await page.getByRole('button', { name: /japan/i }).first().click()
    await page.getByRole('button', { name: /search/i }).click()

    await expect(page).toHaveURL(/\/hotels/)
    await expect(page.locator('h1', { hasText: /stays found|searching/i })).toBeVisible()
  })

  test('shows no results message when API returns empty', async ({ page }) => {
    // Intercept API calls before navigation
    await page.route('**/api/hotels*', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    }))
    await page.route('**/api/hotels/prices*', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ completed: true, currency: 'USD', hotels: [] }),
    }))

    await page.goto(BASE_URL)
    const input = page.getByPlaceholder('Where are you going?')
    await input.fill('Tokyo')
    await page.getByRole('button', { name: /japan/i }).first().click()
    await page.getByRole('button', { name: /search/i }).click()

    await expect(page.locator('text=No stays match your filters')).toBeVisible({ timeout: 15000 })
  })

  test('sort dropdown is visible on the hotels page', async ({ page }) => {
    const input = page.getByPlaceholder('Where are you going?')
    await input.fill('Tokyo')
    await page.getByRole('button', { name: /japan/i }).first().click()
    await page.getByRole('button', { name: /search/i }).click()

    await expect(page.locator('select#sort')).toBeVisible()
  })
})

test.describe('Date range picker', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL)
  })

  test('has date inputs in the search bar', async ({ page }) => {
    const checkInBtn = page.getByRole('button', { name: /check-in/i })
    const checkOutBtn = page.getByRole('button', { name: /check-out/i })
    await expect(checkInBtn).toBeVisible()
    await expect(checkOutBtn).toBeVisible()
  })
})

test.describe('Guests & rooms selector', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL)
  })

  test('shows guest selector in the search bar', async ({ page }) => {
    await expect(page.getByRole('button', { name: /guests/i })).toBeVisible()
  })
})
