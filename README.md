# ESC C4T5 — Hotel Booking Platform

## Stack

| Layer | Tech |
|---|---|
| Frontend | React, TanStack Router, Tailwind CSS v4, Vite |
| Backend | Hono, Node.js, Zod |
| Auth | Supabase |
| Hotel data | Ascenda API |

## Features

### Feature 1 — Destination Search (Done)
- Autocomplete with typo tolerance via Fuse.js fuzzy search (instant, no network round trip)
- Ascenda destinations API called in parallel for supplemental results
- Datepicker for check-in / check-out dates
- Guests and rooms selector formatted to Ascenda API spec
- Form validation — blocks search if no destination selected from dropdown
- Submits and redirects to Feature 2

### Feature 2 — Hotel Search Results (Done)
- Fetches hotel list and prices from Ascenda API for the selected destination, dates, guests and rooms
- Progressive loading — prices polled every 3s, hotels appear as first results arrive
- Filter panel — star rating, guest rating, price range, facilities
- Sort — by price and guest rating
- Pagination — 20 hotels per page
- Select button on each hotel redirects to Feature 3

### Feature 3 — Hotel Detail (Done)
- Hotel info, photo gallery, amenities, and location loaded from Ascenda API
- Room types fetched from Ascenda prices API with polling until data is complete — rooms appear progressively as they load
- OpenStreetMap embed for hotel location
- Hotel descriptions rendered with HTML formatting
- Select room redirects to Feature 4

### Feature 4 — Booking (Done)
- Guest details form — salutation, name, email, phone, country (full country list)
- Payment form — cardholder name, card number (auto-formats), expiry (auto-formats), CVC, billing postal code
- Special requests field passed to hotel
- Submits to `POST /api/bookings` with auth token
- Price summary sidebar with taxes, total, and points earned
- 3-step progress indicator

### Feature 5 — Confirmation (Done)
- Booking reference, stay summary, points earned banner, and masked card displayed
- All data passed through from the booking flow — no mock data

### UC-07 — Booking History (Done)
- `/bookings` page lists all past bookings for the logged-in user
- Fetches from `GET /api/bookings`, resolves hotel names and images from Ascenda
- Collapsible cards — hotel image, name, dates, nights, total paid
- Expanded view shows booking reference, guests, room type, special requests, and booked-on date
- "My Bookings" link in navbar for signed-in users

## Auth (Done)
- Login and signup pages connected to Supabase
- Booking, confirmation, and bookings history pages are protected — redirects to login if not signed in
- Navbar reflects signed-in state; sign out supported

## Backend

- `POST /api/bookings` — Create a booking (Zod validated, saved to Supabase)
- `GET /api/bookings` — Fetch bookings for the logged-in user
- Ascenda hotel/price proxy — Not yet implemented

> All Ascenda API calls are currently made directly from the frontend via a Vite dev proxy, bypassing the backend. Will be rerouted through the backend once the proxy endpoints are ready.

## Setup

### Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env` (ask team for values):
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
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
```

```bash
npm run dev   # http://localhost:3001
```
