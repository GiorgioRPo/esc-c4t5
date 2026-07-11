# Ascenda — Frontend Mockup

A polished, hardcoded-data mockup of Ascenda's white-label hotel booking platform. Five pages, no backend, built to read as production UI rather than a wireframe.

Run it: `npm run dev`

## What this is

Ascenda sells hotel booking infrastructure *to banks and loyalty programs*, who put their own brand on top of it. The mockup is the consumer-facing booking flow that powers under one of those programs: search → results → hotel detail → booking → confirmation.

## Pages

| Route | What's there |
|---|---|
| `/` | Navy hero with the search bar (destination autocomplete, two-month date-range picker, guests/rooms stepper), a popular-destinations strip, three value props, and featured hotel cards |
| `/hotels` | Compact search bar recapping the active search, a filter sidebar (star rating, guest rating, price range, facilities — all live, client-side), a sort dropdown, skeleton loading on first paint, and a slide-over filter drawer on mobile |
| `/hotels/$hotelId` | Photo gallery with thumbnail swapping, amenities grid, a stylized map placeholder (no real map API), guest review breakdown with score bars, and three room options per hotel |
| `/booking` | A 3-step indicator, a stay-summary recap, guest details + payment form (card number and expiry auto-format as you type), and a sticky price-breakdown sidebar |
| `/confirmation` | Booking reference with copy-to-clipboard, a points-earned banner, stay summary, masked card, and a "what's next" checklist |

Every route is reachable directly (not just via the click-through flow) and still renders something complete — `/confirmation` visited cold shows a sensible sample booking rather than breaking.

## Design system

The brief specified most of this directly; the job was filling in the rest without it reading templated.

**Colors** (`src/styles.css`, Tailwind v4 `@theme` tokens):
- `navy` `#22285A` — navbar, hero, footer
- `accent` `#3B4CA8` / `accent-light` `#EAECF7` — buttons, links, badges
- `surface` `#F8FAFC`, `border` `#E5E7EB`, `muted` `#6B7280` — neutral scaffolding
- `success` `#10B981`, `gold` `#F59E0B` — free-cancellation tags, star ratings

**Type:** Plus Jakarta Sans (`font-display`, headings) + DM Sans (`font-body`, default), loaded via Google Fonts in `index.html`.

**Shape:** `rounded-card` (12px) for cards/panels, `rounded-btn` (8px) for buttons/inputs — both defined once as theme tokens so the radii can't drift between components.

**Signature element — the points thread.** Ascenda's whole pitch is that banks plug their loyalty program into a booking engine. So everywhere a price appears, a second line appears next to it: a small `accent-light` pill reading `+2,340 pts`. It shows up on hotel cards, room options, the booking summary, and pays off as the headline moment on the confirmation page ("You've earned 6,470 points"). That's the one deliberate, repeated idea — everything else (layout, spacing, card structure) stays quiet around it.

**Logo:** the real Ascenda wordmark SVG (`public/ascenda-logo.svg`), flat navy. On the navy navbar/footer it's flipped to white via a CSS `brightness-0 invert` filter rather than needing a separate light-mode asset.

**No spinners.** Loading states are skeleton blocks (`Skeleton`, `HotelCardSkeleton`) — the `/hotels` results simulate a brief load on first mount so the skeleton state is visible at least once.

## How data flows

There's no backend and no global state. Everything travels as **URL search params**, validated per-route:

```
StaySearch        { destination, checkIn, checkOut, adults, childrenCount, rooms }
BookingSearch      extends StaySearch + { hotelId, roomId }
ConfirmationSearch  extends BookingSearch + { ref, last4, guestName, email, total, points }
```

(`src/lib/search.ts`) Each route's `validateSearch` parses these defensively — values can arrive as strings or numbers depending on router serialization, so a `toNumber`/`toStringOr` pass normalizes them, falling back to sensible defaults (today + 14 days, 2 adults, the first hotel/room, a freshly generated booking ref) when a param is missing. That's what lets `/confirmation` look right even with no query string.

Dummy data lives in `src/data/hotels.ts` — 4 hotels (London, Lisbon, Queenstown, Seville), 3 room types each, plus reviews and a rating breakdown per hotel. `src/data/facilities.ts` maps facility keys to lucide icons.

Filtering and sorting on `/hotels` are plain client-side array operations over that dummy list (`FilterSidebar.tsx`'s `applyFilters`) — no params round-trip for them, since there's nothing to fetch.

## Component layout

```
components/
  layout/      Navbar, Footer (shared chrome)
  search/      DestinationAutocomplete, DateRangePicker, GuestsRoomsSelector, SearchBar
  hotels/      HotelCard, HotelCardSkeleton, FilterSidebar
  hotel-detail/  Gallery, RoomCard
  booking/     StepIndicator
  ui/          Button, Badge/PointsBadge, StarRating, RatingPill, Skeleton, HotelImage
lib/           utils.ts (formatting/date helpers), types.ts, search.ts (param parsing)
data/          hotels.ts, facilities.ts
hooks/         useClickOutside.ts
```

`HotelImage` wraps every photo with a skeleton-while-loading state and a graceful icon fallback on a broken URL — relevant here since hotel photos are hotlinked from Unsplash rather than bundled.

## Things worth knowing

- **The date picker, autocomplete, and guests selector are all custom** — no date-picker library. They're popovers closed via a shared `useClickOutside` hook.
- **Search summary text on `/hotels` is cosmetic for destination** — typing a different city doesn't remove hotels from the other three cities; only the star/rating/price/facility filters actually narrow the list. With only 4 dummy hotels total, a strict per-city match would make the results page look broken/empty most of the time.
- **One fixed bug:** the hero section originally had `overflow-hidden` (to contain a decorative SVG line motif) wrapping the whole search bar, which clipped the date-picker popover. Fixed by moving `overflow-hidden` onto a dedicated wrapper around just the SVG, leaving the search bar's popovers free to render outside the hero's box.
- **Card number/expiry inputs** auto-format as you type (digit-only state under the hood, spaces/slash inserted for display) but there's no real validation beyond `required` — this is a presentation layer, not a payments form.
