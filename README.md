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
- Room options shown with price, perks, and points earned
- Select room redirects to Feature 4

### Feature 4 — Booking (WIP)
- Guest details and payment form UI is built
- Card number and expiry auto-format as you type
- 3-step progress indicator and stay summary sidebar
- Not yet connected to the backend booking API — currently reads from local data

### Feature 5 — Confirmation (WIP)
- Booking reference, stay summary, points earned banner, and masked card UI is built
- Not yet connected to real booking data from the backend

## Auth (Done)
- Login and signup pages connected to Supabase
- Booking and confirmation pages are protected — redirects to login if not signed in
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
npm run dev
```
