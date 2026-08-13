# ESC C4T5: Hotel Booking Platform

## Stack

| Layer | Tech |
|---|---|
| Frontend | React, TanStack Router, Tailwind CSS v4, Vite |
| Backend | Hono, Node.js, Zod, Stripe |
| Recommendation engine | FastAPI (Python), Postgres + pgvector, sentence-transformers |
| Auth / DB | Supabase |
| Hotel data | Ascenda API |
| Payments | Stripe (Payment Element + webhooks) |
| Containerization | Docker Compose |

## Features

### Feature 1: Destination Search (Done)
- Autocomplete with typo tolerance via Fuse.js fuzzy search
- Instant search over ~170 curated, well-known destinations, plus a lazily
  loaded background catalog of ~15,800 more cities that merges into results
  once it's done loading. It's a separate code-split chunk, so it doesn't
  slow down the initial page load.
- Datepicker for check-in / check-out dates
- Guests and rooms selector formatted to Ascenda API spec
- Form validation blocks search if no destination is selected from the dropdown
- Submits and redirects to Feature 2

### Feature 2: Hotel Search Results (Done)
- Fetches hotel list and prices from Ascenda API (via the backend) for the
  selected destination, dates, guests and rooms
- Progressive loading: prices polled every 3s, hotels appear as first results arrive
- Filter panel for star rating, guest rating, price range, facilities
- Sort by price and guest rating
- Pagination, 20 hotels per page
- Related destinations shown alongside search results, powered by the
  recommendation engine (see below)
- Select button on each hotel redirects to Feature 3

### Feature 3: Hotel Detail (Done)
- Hotel info, photo gallery, amenities, and location loaded from Ascenda API
- Room types fetched from Ascenda prices API, polling until data is complete so rooms appear progressively as they load
- OpenStreetMap embed for hotel location
- Hotel descriptions rendered with HTML formatting
- Share dialog: copy link or share via WhatsApp, Facebook, X, Telegram, Email
- Select room redirects to Feature 4

### Feature 4: Booking & Payment (Done)
- Guest details form: salutation, name, email, phone, country (full country list)
- Payment via Stripe Payment Element, card details never touch our servers
- Special requests field passed to hotel
- `POST /api/bookings` creates a Stripe PaymentIntent, then a Stripe webhook
  writes the actual booking row once payment succeeds
- Price summary sidebar with taxes, total, and points earned
- 3-step progress indicator

### Feature 5: Confirmation (Done)
- Booking reference, stay summary, and points earned banner
- All data passed through from the booking flow, no mock data

### UC-07: Booking History (Done)
- `/bookings` page lists all past bookings for the logged-in user
- Fetches from `GET /api/bookings`, resolves hotel names and images from Ascenda
- Collapsible cards showing hotel image, name, dates, nights, total paid
- Expanded view shows booking reference, guests, room type, special requests, and booked-on date
- "My Bookings" link in navbar for signed-in users

### Destination Recommendations (Done)
- Separate FastAPI service that ranks related destinations using semantic
  (embedding) and geographic candidate retrieval over a curated destination set
  in Postgres/pgvector
- Impressions and clicks are logged for future ranking evaluation
- Full design write-up in [`docs/recommendation-system.md`](docs/recommendation-system.md)

## Auth (Done)
- Login and signup pages connected to Supabase
- Booking, confirmation, and bookings history pages are protected, redirects to login if not signed in
- Navbar reflects signed-in state; sign out supported

## Backend

- `POST /api/bookings`: create a Stripe PaymentIntent for a booking (Zod validated)
- `GET /api/bookings`: fetch bookings for the logged-in user
- `POST /api/webhooks/stripe`: Stripe webhook, writes the booking row on `payment_intent.succeeded`
- `GET /api/hotels`: Ascenda hotel list proxy (cached)
- `GET /api/hotels/prices`: Ascenda price list proxy (cached)
- `GET /api/hotels/:id`: Ascenda hotel detail proxy
- `GET /api/hotels/:id/price`: Ascenda per-hotel price proxy
- `POST /api/recommendations`: related-destination recommendations (calls the FastAPI recommender internally)
- `POST /api/recommendations/events`: logs impression/click events

All Ascenda calls are made server-side by the backend, not directly from the browser.

## Testing

- Frontend unit/integration tests: `cd frontend && npm test` (Vitest)
- Frontend e2e tests: `cd frontend && npm run test:e2e` (Playwright, requires Docker)
- Backend unit/integration tests: `cd backend && npm test` (Vitest)
- Recommendation engine tests: `cd backend/services/recommendation && pytest`
- Full test plan and coverage notes: [`docs/TEST_PLAN.md`](docs/TEST_PLAN.md)

## Setup

Full, detailed local setup (all three services, credentials, one-time
recommendation-engine seeding) is documented in
[`docs/SETUP.md`](docs/SETUP.md). Start there if this is your first time
running the project. The quickstart below assumes you already have the
`.env` values from a teammate.

### Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env` (ask team for values):
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_STRIPE_PUBLISHABLE_KEY=
```

```bash
npm run dev   # http://localhost:3000
```

### Backend

```bash
cd backend
npm install
```

Create `backend/.env` (ask team for values):
```
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
SUPABASE_JWKS_URL=
SUPABASE_SERVICE_ROLE_KEY=
ASCENDA_API_URL=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
RECOMMENDER_URL=
RECOMMENDER_INTERNAL_TOKEN=
```

```bash
npm run dev   # http://localhost:3001
```

### Recommendation engine (optional, only needed for destination recommendations)

```bash
cd backend/services/recommendation
pip install -r requirements.txt
```

Create `backend/services/recommendation/.env` (ask team for values):
```
RECOMMENDER_DATABASE_URL=
RECOMMENDER_INTERNAL_TOKEN=
```

See [`docs/SETUP.md`](docs/SETUP.md) section 6 for the one-time destination-seeding step.

### Docker (all services at once)

```bash
docker compose up
```

Brings up the frontend (nginx), backend, and recommendation engine together,
see `docker-compose.yml`. `docker-compose.e2e.yml` additionally spins up
Playwright for end-to-end tests.
