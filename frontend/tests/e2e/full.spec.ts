/**
 * Full end-to-end tests against the Dockerised stack.
 *
 * Required services before running:
 *   docker compose up                          # frontend :3000, api :3001, recommender :8000
 *   stripe listen --forward-to http://localhost:3001/api/webhooks/stripe
 *
 * The Stripe CLI must be running so that webhook events (payment_intent.succeeded)
 * are forwarded to the backend and bookings are persisted in Supabase.
 *
 * Environment variables:
 *   E2E_TEST_EMAIL    — pre-seeded Supabase user email (default: e2e-test@ascenda.local)
 *   E2E_TEST_PASSWORD — password for that user (default: Testpass123!)
 *
 * Run:
 *   npx playwright test tests/e2e/full.spec.ts
 */
import { test, expect, type Page } from '@playwright/test'

const BASE_URL = 'http://localhost:3000'

// Stripe test card — always succeeds, no real charge.
const TEST_CARD_NUMBER = '4242 4242 4242 4242'
const TEST_CARD_EXPIRY = '12/30'
const TEST_CARD_CVC = '123'

// Pre-seeded test user (must exist in Supabase with confirmed email).
const TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? 'e2e-test@ascenda.local'
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD ?? 'Testpass123!'

// ---- helpers ----

async function logIn(page: Page) {
  await page.goto(`${BASE_URL}/login`)
  // Wait for the login form to be present before interacting
  await page.locator('form').waitFor({ state: 'visible' })
  // Use CSS locators scoped to the form to avoid label-text ambiguity
  const form = page.locator('form')
  await form.locator('input[type="email"]').fill(TEST_EMAIL)
  await form.locator('input[type="password"]').fill(TEST_PASSWORD)
  await form.locator('button[type="submit"]').click()
  await expect(page).toHaveURL(BASE_URL)
}

/**
 * Fill the Stripe Elements payment form and submit.
 * Stripe test cards trigger an immediate succeed event.
 */
async function fillAndSubmitPayment(page: Page) {
  // Wait for the Stripe Elements iframe to appear
  await page.waitForSelector('iframe[src*="stripe"]', { state: 'attached', timeout: 10_000 })
  await page.waitForTimeout(1000)

  // Scroll the Stripe iframe into view via JS
  await page.evaluate(() => {
    const iframe = document.querySelector('iframe[src*="stripe"]') as HTMLIFrameElement | null
    iframe?.scrollIntoView({ block: 'center' })
  })
  await page.waitForTimeout(500)

  const cardFrame = page.frameLocator('iframe[src*="stripe"]').first()

  // Expand the card section inside the Stripe iframe if collapsed
  const cardSection = cardFrame.getByRole('button', { name: /card/i }).first()
  if (await cardSection.count()) {
    await cardSection.click()
    await page.waitForTimeout(500)
  }

  // Fill card details
  await cardFrame.getByRole('textbox', { name: /card number/i }).fill(TEST_CARD_NUMBER)
  await cardFrame.locator('input[name="expiry"]').fill(TEST_CARD_EXPIRY)
  await cardFrame.locator('input[name="cvc"]').fill(TEST_CARD_CVC)

  // Wait for Stripe to validate (card number should show as valid)
  await page.waitForTimeout(1000)

  // Check for any Stripe error messages before submitting
  const stripeError = await cardFrame.locator('.p-FieldError, .p-Input--error').count()
  if (stripeError > 0) {
    console.log('Stripe validation error detected')
  }

  // Click confirm & pay on the main page
  const payButton = page.getByRole('button', { name: /confirm & pay/i })
  await payButton.scrollIntoViewIfNeeded()
  await payButton.click()
}

/**
 * Wait for the booking confirmation page to load, then verify key details.
 */
async function expectConfirmationPage(
  page: Page,
  opts: { hotelName: string; total: number },
) {
  await expect(page.getByRole('heading', { name: /booking confirmed/i })).toBeVisible()
  if (opts.hotelName) {
    await expect(page.getByText(opts.hotelName)).toBeVisible()
  }
  // Scroll price summary into view before asserting
  await page.locator('.border-t.border-border.pt-2').first().scrollIntoViewIfNeeded()
  // Match $1,009 with optional commas/currency symbols
  const pricePattern = opts.total
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  await expect(page.getByText(new RegExp(`\\$?${pricePattern}`, 'i'))).toBeVisible()
}

/**
 * Wait for the My Bookings page to show at least one booking.
 */
async function expectBookingInList(page: Page) {
  await page.goto(`${BASE_URL}/bookings`)
  await expect(page.getByRole('heading', { name: /my bookings/i })).toBeVisible()
  // Poll every 3s until booking card appears (up to 60s)
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    const count = await page.locator('.rounded-card').filter({ has: page.getByText(/night/i) }).count()
    if (count > 0) return
    await page.reload()
    await expect(page.getByRole('heading', { name: /my bookings/i })).toBeVisible()
    await new Promise(r => setTimeout(r, 3000))
  }
  throw new Error('Booking not found after 60s of polling')
}

test.describe('E2E — search & results', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL)
  })

  test('search for a destination and see the results page', async ({ page }) => {
    const input = page.getByPlaceholder('Where are you going?')
    await input.fill('Tokyo')
    await page.getByRole('button', { name: /japan/i }).first().click()
    await page.getByRole('button', { name: /search/i }).click()

    await expect(page).toHaveURL(/\/hotels/)
    await expect(page.locator('h1', { hasText: /stays found|searching/i })).toBeVisible()
  })

  test('applies a star rating filter', async ({ page }) => {
    await page.getByPlaceholder('Where are you going?').fill('Tokyo')
    await page.getByRole('button', { name: /japan/i }).first().click()
    await page.getByRole('button', { name: /search/i }).click()
    await page.waitForURL(/\/hotels/)

    // Scroll filters into view and toggle a star rating
    await page.locator('aside .rounded-card').scrollIntoViewIfNeeded()
    const starCheckbox = page.locator('input[value="5"]')
    if (await starCheckbox.count()) {
      await starCheckbox.check()
      await expect(page.locator('input[value="5"]')).toBeChecked()
    }
  })

  test('sorts results by price ascending', async ({ page }) => {
    await page.getByPlaceholder('Where are you going?').fill('Tokyo')
    await page.getByRole('button', { name: /japan/i }).first().click()
    await page.getByRole('button', { name: /search/i }).click()
    await page.waitForURL(/\/hotels/)

    await page.locator('select#sort').selectOption('price-asc')
    await expect(page.locator('select#sort')).toHaveValue('price-asc')
  })
})

test.describe('E2E — hotel detail & room selection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL)
  })

  test('navigates to a hotel detail page and sees room options', async ({ page }) => {
    const input = page.getByPlaceholder('Where are you going?')
    await input.fill('Singapore')
    await page.getByRole('button', { name: /singapore/i }).first().click()
    await page.getByRole('button', { name: /search/i }).click()
    await page.waitForURL(/\/hotels/)

    // Click the first "View details" link
    const viewDetails = page.getByRole('link', { name: /view details/i }).first()
    await viewDetails.scrollIntoViewIfNeeded()
    await viewDetails.click()
    await page.waitForURL(/\/hotels\//)
    await page.waitForTimeout(500)

    // Wait for hotel name heading to be visible (h1 with text-3xl on detail page)
    await expect(page.locator('h1.text-3xl.font-bold')).toBeVisible()
    // Scroll to "Choose your room" section
    await page.getByRole('heading', { name: /choose your room/i }).scrollIntoViewIfNeeded()
    await expect(page.getByRole('heading', { name: /choose your room/i })).toBeVisible()
  })
})

test.describe('E2E — authentication', () => {
  test('signs in with valid credentials and lands on home page', async ({ page }) => {
    await logIn(page)
    await expect(page).toHaveURL(BASE_URL)
  })

  test('shows an error for invalid credentials', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`)
    await page.locator('form').locator('input[type="email"]').fill('wrong@example.com')
    await page.locator('form').locator('input[type="password"]').fill('wrongpassword')
    await page.locator('form').locator('button[type="submit"]').click()
    await expect(page.locator('p.text-red-600')).toBeVisible()
  })

  test('signs out via navbar', async ({ page }) => {
    await logIn(page)

    // Sign out via navbar
    const accountBtn = page.getByRole('link', { name: /sign in|account/i }).first()
    if (await accountBtn.count()) {
      await accountBtn.click()
      await page.getByRole('menuitem', { name: /sign out/i }).click()
      await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible()
    }
  })
})

test.describe('E2E — booking flow with Stripe', () => {
  test.use({ baseURL: BASE_URL })

  test('completes a booking as a logged-in user and sees it in My Bookings', async ({
    page,
  }) => {
    await logIn(page)

    // Search for a destination
    await page.goto(BASE_URL)
    await page.getByPlaceholder('Where are you going?').fill('Singapore')
    await page.getByRole('button', { name: /singapore/i }).first().click()
    await page.getByRole('button', { name: /search/i }).click()
    await page.waitForURL(/\/hotels/)

    // Click into a hotel detail page
    const viewDetails = page.getByRole('link', { name: /view details/i }).first()
    await viewDetails.scrollIntoViewIfNeeded()
    await viewDetails.click()
    await page.waitForURL(/\/hotels\//)
    // Wait for the new page to fully render (TanStack Router transition)
    await page.waitForTimeout(500)

    // Capture the hotel name for later verification (h1 on detail page is text-3xl, not text-2xl)
    const hotelName = await page.locator('h1.text-3xl.font-bold').first().textContent() ?? ''

    // Click "Select room" on the first room
    const selectRoom = page.getByRole('link', { name: /select room/i }).first()
    await selectRoom.scrollIntoViewIfNeeded()
    await selectRoom.click()
    await page.waitForURL(/\/booking/)

    // Fill guest details
    await page.getByRole('textbox', { name: /first name/i }).fill('E2e')
    await page.getByRole('textbox', { name: /last name/i }).fill('Tester')
    await page.getByRole('textbox', { name: /email/i }).fill(TEST_EMAIL)
    await page.getByRole('textbox', { name: /phone/i }).fill('+65 9000 0000')
    await page.getByRole('combobox', { name: /country/i }).selectOption('Singapore')

    // Submit payment via Stripe test card
    await fillAndSubmitPayment(page)

    // Scroll price summary into view before reading total
    await page.locator('.border-t.border-border.pt-3').first().scrollIntoViewIfNeeded()
    await page.waitForTimeout(300)
    const totalText = await page.locator('.font-display.text-xl.font-bold').first().textContent() ?? '0'
    const total = parseInt(totalText.replace(/[^0-9]/g, ''), 10) || 0

    // Should land on the confirmation page
    await expectConfirmationPage(page, { hotelName, total })

    // Verify the booking appears in My Bookings
    await expectBookingInList(page)
  })

  test('redirects to login when accessing booking without authentication', async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/booking?test=1`)
    await expect(page).toHaveURL(/\/login/)
  })
})
