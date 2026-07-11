# ESC C4T5 — Hotel Booking Platform

## Stack

| Layer | Tech |
|---|---|
| Frontend | React, TanStack Router, Tailwind CSS v4, Vite |
| Backend | Hono, Node.js, Zod |
| Auth | Supabase |
| Hotel data | Ascenda API |

## Status

### Frontend

- **Feature 1 — Destination search** — Done. Autocomplete with typo tolerance (Fuse.js), datepicker, guests/rooms selector, form validation
- **Feature 2 — Hotel results** — Done. Progressive price loading, filters, sort, pagination, hotel detail page
- **Auth** — Done. Login, signup, protected routes via Supabase
- **Feature 3 — Booking form** — UI done, not yet connected to backend
- **Feature 4 — Confirmation** — UI done, not yet connected to backend

Note: all Ascenda API calls (destinations, hotels, prices) are currently made directly from the frontend via a Vite dev proxy, bypassing the backend. Will be rerouted through the backend once the relevant proxy endpoints are ready.

### Backend

- **Auth** — Done. Supabase session verification via `withSupabase` middleware
- **`POST /api/bookings`** — Done. Create a booking (Zod validated, saved to Supabase)
- **`GET /api/bookings`** — Done. Fetch bookings for the logged-in user
- **Ascenda hotel/price proxy** — Not yet implemented

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
