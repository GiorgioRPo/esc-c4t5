# Test Plan

95 total test cases (45 unit, 43 integration, 7 end to end)

Tools: Vitest 4 for unit and backend integration, Vitest with React Testing Library for component and route integration, Postman run by Newman for API contract, Cypress for end to end.

---

## 1. Test cases

### 1.1 Unit tests, `frontend/src/lib/utils.ts`

| ID | Description | Objective | Input | Expected output | Tool |
|---|---|---|---|---|---|
| UT-01 | `pointsForAmount` across three amounts | Loyalty rule is 10 points per dollar and rounds half up | `450`, `450.04`, `450.05` | `4500`, `4500`, `4501` | Vitest |
| UT-02 | `nightsBetween` for normal, identical and reversed dates | Night count is correct, and the `Math.max(1, …)` clamp is deliberate | `('2026-08-01','2026-08-04')`, `('2026-08-01','2026-08-01')`, `('2026-08-04','2026-08-01')` | `3`, `1`, `1` | Vitest |
| UT-03 | `addDays` across a month boundary with `TZ=UTC` | Day arithmetic crosses months correctly | `('2026-07-30', 3)` | `'2026-08-02'` | Vitest |
| UT-04 | `addDays` and `isoDate` in a UTC+8 zone | `isoDate` and `addDays` both work from local date fields, so a call from a zone east of UTC keeps the calendar day | `TZ=Asia/Singapore`; `addDays('2026-07-25', 1)`; `isoDate(new Date(2026, 7, 10))` | `'2026-07-26'` and `'2026-08-10'` | Vitest |
| UT-05 | `generateBookingRef` over 200 unstubbed calls | Reference format holds, and the alphabet excludes the ambiguous `I`, `O`, `Z`, `0`, `1` | 200 successive calls, `Math.random` left alone | Every ref matches `/^ASC-[A-HJ-NP-Y2-9]{6}$/` | Vitest |
| UT-06 | `maskCardNumber` on a full and a short number | Only the last four digits are kept, and short input passes through unmasked | `'4111111111111111'`, `'12'` | `'1111'`, `'12'` | Vitest |
| UT-07 | `guestRatingLabel` at every threshold | Band boundaries are inclusive at 9, 8, 7 and 6 | `9`, `8.99`, `8`, `7`, `6`, `5.9` | `'Exceptional'`, `'Excellent'`, `'Excellent'`, `'Very Good'`, `'Good'`, `'Fair'` | Vitest |
| UT-08 | `defaultStaySearch` under a fixed clock | Defaults are today plus 14 and today plus 16, 2 adults, 1 room | `TZ=UTC`, system time `2026-07-25` | `checkIn '2026-08-08'`, `checkOut '2026-08-10'`, `adults 2`, `rooms 1` | Vitest |
| UT-09 | `formatGuestsSummary` pluralisation | Guests and rooms pluralise independently, and children fold into the guest total | `(1, 0, 1)`, `(2, 1, 2)` | `'1 guest · 1 room'`, `'3 guests · 2 rooms'` | Vitest |

### 1.2 Unit tests, `frontend/src/lib/search.ts`

| ID | Description | Objective | Input | Expected output | Tool |
|---|---|---|---|---|---|
| UT-10 | `parseStaySearch` number coercion | Numeric strings from the URL become numbers, and unparseable ones fall back | `{ adults: '3', rooms: '2' }`, then `{ adults: 'abc' }` | `adults 3, rooms 2`, then `adults 2` | Vitest |
| UT-11 | `parseStaySearch` fallback on absent and empty fields | A missing key and an empty string both yield the computed default, not the empty value | `{}`, then `{ checkIn: '' }` | Both give `checkIn` equal to `defaultStaySearch().checkIn` | Vitest |
| UT-12 | `parseStaySearch` accepts invalid values | No minimum, range or ordering check exists, which is why UC03 `validateDates` has nothing to test | `{ adults: -5, checkIn: '2026-09-01', checkOut: '2026-08-01' }` | Values preserved verbatim | Vitest |
| UT-13 | `parseBookingSearch` defaults | Room name defaults sensibly, but a missing price defaults to 0 and permits a zero dollar booking attempt | `{}` | `roomName 'Standard Room'`, `pricePerNight 0` | Vitest |
| UT-14 | `parseConfirmationSearch` derived totals | Total falls back to subtotal plus 12 percent, and points derive from that total | `{ pricePerNight: 100, checkIn: '2026-08-01', checkOut: '2026-08-03', rooms: 1 }` | `total 224`, `points 2240` | Vitest |
| UT-15 | `parseConfirmationSearch` reference handling | A supplied ref survives, but an absent one mints a different ref on every parse | `{ ref: 'ASC-ABC234' }`, then `{}` twice | `'ASC-ABC234'`; the two bare parses return different refs | Vitest |

### 1.3 Unit tests, `frontend/src/lib/ascenda.ts`

| ID | Description | Objective | Input | Expected output | Tool |
|---|---|---|---|---|---|
| UT-16 | `buildGuestsParam` for multiple and single rooms | Guests are formatted per the Ascenda spec, adults repeated once per room | `(2, 3)`, `(4, 1)` | `'2\|2\|2'`, `'4'` | Vitest |
| UT-17 | `fetchHotelPrices` drops children from the query | Children are collected in the UI but never reach the API, so results ignore them | `fetch` spy; params with `adults 2, rooms 1` and 3 children selected | Query carries `guests=2` and no children parameter | Vitest |
| UT-18 | `fetchHotelPrices` query contract | The partner parameters the API requires are all present and correct | `fetch` spy; a full params object | Query has `destination_id`, `checkin`, `checkout`, `lang=en_US`, `currency=USD`, `country_code=US`, `guests`, `partner_id=1089`, `landing_page=wl-acme-earn`, `product_type=earn` | Vitest |
| UT-19 | `hotelImages` indexing, cap and absent details | URLs are built 1 indexed, capped at `max`, and a missing block yields nothing | `{prefix:'p/', count:3, suffix:'.jpg'}`, `{count:20}`, `undefined` | `['p/1.jpg','p/2.jpg','p/3.jpg']`, length 5, `[]` | Vitest |
| UT-20 | `mapAmenities` mapping rules | Pool variants collapse to one key, and unknown or false entries are dropped | `{outdoorPool:true, indoorPool:true}`, `{spaceship:true, wifi:false, gym:true}` | `['pool']`, `['gym']` | Vitest |
| UT-21 | `mapToHotel` guest rating | TrustYou score is divided by 10, and an absent block gives 0 | `trustyou.score.overall = 87`, then `trustyou` absent | `guestRating 8.7`, then `0` | Vitest |
| UT-22 | `mapRooms` naming and breakfast detection | Name falls through normalised, description, then literal, and breakfast is matched case insensitively | Room with only `description: 'Deluxe'`; room with neither; `amenities: ['Free BREAKFAST buffet']` | `'Deluxe'`, `'Standard Room'`, `breakfastIncluded true` | Vitest |
| UT-23 | `fetchHotels` and `fetchHotelPrices` on a non-OK response | A failed request rejects rather than resolving empty, so the caller can tell an outage apart from a destination with no hotels | `fetch` resolves 500, then 503 | Both reject carrying the status code, and neither returns an empty result | Vitest |
| UT-24 | *Withdrawn* — covered `searchDestinations`, a remote destination lookup removed from `lib/ascenda.ts` in `a7c072f`; destination autocomplete is local-only (Fuse over `LOCAL_DESTINATIONS`) | — | — | — | — |

### 1.4 Unit tests, `applyFilters` in `components/hotels/FilterSidebar.tsx`

| ID | Description | Objective | Input | Expected output | Tool |
|---|---|---|---|---|---|
| UT-25 | Star filter membership | The star filter is exact set membership, and an empty selection disables it | Hotels at 3 and 4 stars; `starRatings: [4]`, then `[]` | Only the 4 star hotel, then both | Vitest |
| UT-26 | Fractional star ratings | Ascenda ratings can be fractional, and those hotels match no checkbox | Hotel with `starRating 4.5`; `starRatings: [4]` and `[5]` | Excluded by both | Vitest |
| UT-27 | Guest rating threshold | The guest rating filter is a `>=` comparison and is off at 0 | Hotels rated 7.9 and 8.0; `minGuestRating: 8`, then `0` | Only the 8.0 hotel, then both | Vitest |
| UT-28 | Facilities conjunction | Every selected facility must be present, not just one | Hotel with `['wifi']`; filter `['wifi','pool']` | Hotel excluded | Vitest |
| UT-29 | Hotel with no rooms | `cheapestPrice()` of an empty room list is `Infinity`, so such hotels can never pass the price predicate | Hotel with `rooms: []`, `DEFAULT_FILTERS` | Hotel excluded | Vitest |
| UT-30 | Price ceiling above the slider maximum | The slider cannot be dragged past 500, so a `maxPrice` at that value means no ceiling rather than a ceiling of 500 | Hotel at 650 a night; `DEFAULT_FILTERS`, then `maxPrice: 400` | Hotel retained under `DEFAULT_FILTERS`, then excluded once the slider is actually lowered below its price | Vitest |

### 1.5 Unit tests, results sorting and booking arithmetic

These need a small extraction first, scheduled on day 1: move `cheapestPrice`, `sortHotels` and a `computeStayTotals` helper into `frontend/src/lib/`, and export `formatCardNumberInput` and `formatExpiryInput` from `booking.tsx`. Without it there is no callable subject. The v1 cases for page count are dropped here and covered at component level by IT-17.

| ID | Description | Objective | Input | Expected output | Tool |
|---|---|---|---|---|---|
| UT-31 | `cheapestPrice` for populated and empty room lists | The minimum room price is returned, and an empty list is sentinel valued | Rooms at 300, 150, 220; then `[]` | `150`, then `Infinity` | Vitest |
| UT-32 | `sortHotels` by ascending price | The price sort orders by cheapest room, not by list position | 3 hotels with mixed room prices, key `price-asc` | Ascending by cheapest room price | Vitest |
| UT-33 | `recommended` and `rating-desc` compared | There is no `recommended` branch, so both keys fall through to the same guest rating sort | The same 5 hotels under both keys | Identical arrays | Vitest |
| UT-34 | `formatCardNumberInput` grouping | Digits group in fours with no trailing space on a partial group | `'4111111111111111'`, `'411111'` | `'4111 1111 1111 1111'`, `'4111 11'` | Vitest |
| UT-35 | `formatExpiryInput` slash insertion | The separator appears only after the second digit | `'0'`, `'08'`, `'0827'` | `'0'`, `'08'`, `'08/27'` | Vitest |
| UT-36 | `computeStayTotals` money path | Subtotal is price by nights by rooms, and tax is 12 percent of it, rounded | 200 a night, 3 nights, 2 rooms | `subtotal 1200`, `taxesAndFees 144`, `total 1344` | Vitest |
| UT-37 | Points from the tax inclusive total | Points accrue on what the guest actually pays, not on the subtotal | `total 1344` | `points 13440` | Vitest |

### 1.6 Unit tests, `backend/schema.ts`

| ID | Description | Objective | Input | Expected output | Tool |
|---|---|---|---|---|---|
| UT-38 | Valid payload | A well formed booking parses cleanly | Full valid payload | `success: true` | Vitest |
| UT-39 | `children` omitted | The field defaults rather than failing | Valid payload with `children` removed | `success: true`, `data.children === 0` | Vitest |
| UT-40 | `user_id` presence and format | The owning user is mandatory and must be a UUID | Remove `user_id`; then `user_id: 'not-a-uuid'` | `success: false` in both, issue path `['user_id']` | Vitest |
| UT-41 | Guest counts | Adults must be a whole number of at least 1 and children may not be negative | `adults: 0`; `adults: 1.5`; `children: -1` | `success: false` in all three | Vitest |
| UT-42 | `price_paid` positivity | A zero or negative charge is rejected at the boundary | `price_paid: 0`; `price_paid: -100` | `success: false` in both | Vitest |
| UT-43 | `room_types` shape | The field must be an array of strings, not a bare string | `room_types: 'ocean'` | `success: false` | Vitest |
| UT-44 | Unknown keys | Extra client supplied keys are stripped rather than rejected, so they cannot reach the insert | Valid payload plus `is_admin: true` | `success: true`, `data.is_admin` undefined | Vitest |
| UT-45 | Date fields | Dates are plain strings with no format or ordering check | `start_date: 'yesterday'`, `end_date: '1'` | `success: true` | Vitest |

### 1.7 Integration tests, cluster A: `lib/` with `components/`

Strategy: decomposition based, bottom up. The decomposition tree is the module hierarchy, and layer 1 and layer 2 are proven by section 1.1 to 1.3 before this cluster starts, so `utils.ts`, `search.ts` and the pure mappers are used for real. Only a test driver and a `fetch` stub are supplied, which is the reason for choosing bottom up over top down: no stubs to write, and a failure here localises to layer 3.

| ID | Strategy | Description | Objective | Input | Expected output | Tool |
|---|---|---|---|---|---|---|
| IT-01 | Decomposition, bottom up | `DestinationAutocomplete` with Fuse and the local destination list | Fuzzy matching tolerates a typo | Type `"Singapur"` | Dropdown lists Singapore | Vitest + RTL |
| IT-02 | Decomposition, bottom up | Same component below the character threshold | The dropdown stays shut under 2 characters, so no request is wasted | Type `"S"` | No dropdown rendered, no `fetch` | Vitest + RTL |
| IT-03 | Decomposition, bottom up | Rapid typing across `DestinationAutocomplete`'s local Fuse lookup | Rapid typing settles on a match for the final query, and costs no network request (suggestions are local-only, not debounced) | Render with empty value, type 5 characters inside 100 ms, advance timers 350 ms | Dropdown lists Tokyo, Japan; `fetch` never called | Vitest + RTL, fake timers |
| IT-04 | Decomposition, bottom up | Local suggestion cap and dedupe in `DestinationAutocomplete` | The local Fuse results are capped at 8 with no duplicate values | Query matching more than 8 local entries | 8 suggestions, no repeated `value` | Vitest + RTL |
| IT-05 | Decomposition, bottom up | `SearchBar` with `DestinationAutocomplete` | Free text without a dropdown selection cannot submit a search | Type `"Toky"`, do not select, click Search | `"Please select a destination first"` shown, no navigation | Vitest + RTL |
| IT-06 | Decomposition, bottom up | `DateRangePicker` with `utils.addDays` | Picking a check-in sets check-out to the next day, and past dates cannot be picked | `TZ=UTC`, system time 25 Jul 2026, click 10 Aug 2026 | Check-out becomes 11 Aug 2026; 24 Jul and earlier carry `disabled` | Vitest + RTL |
| IT-07 | Decomposition, bottom up | Destination search matching nothing (UC03) | A term with no matches says so, rather than leaving the user with a blank dropdown | Type `"zzzzzz"` | A no results found message renders in the dropdown | Vitest + RTL |
| IT-08 | Decomposition, bottom up | `SearchBar` with `validateDates` (UC03) | A check-out on or before check-in, and a check-in in the past, both block the search | `TZ=UTC`, system time 25 Jul 2026. Submit `checkIn 2026-09-01` with `checkOut 2026-08-01`, then `checkIn 2026-07-01` | A date validation error renders both times, and no navigation occurs | Vitest + RTL |

### 1.8 Integration tests, cluster B: results and detail routes with the Ascenda client

Strategy: call graph based, pairwise. The behaviour under test is the recursive `pollPrices` loop, which lives on the edge between the route and `fetchHotelPrices` rather than inside either one. Unit testing the client proves only that it issues one request, and unit testing the route against a stubbed client never exercises the retry contract, so the pair is driven together with only the network stubbed beyond the far endpoint. Timers must be advanced with `advanceTimersByTimeAsync`, because the timeout callback awaits a promise.

| ID | Strategy | Description | Objective | Input | Expected output | Tool |
|---|---|---|---|---|---|---|
| IT-09 | Call graph, pairwise | Metadata and price requests issued together | Both endpoints are called once and joined by hotel id | `/hotels` with a valid `destinationId`, both stubs resolving | Cards render the merged name and price | Vitest + RTL |
| IT-10 | Call graph, pairwise | Poll terminates on completion | Polling stops as soon as `completed: true` arrives | First response `completed:false`, second `true`, advance 3 s | Exactly 2 price requests, the updating indicator clears | Vitest + RTL, fake timers |
| IT-11 | Call graph, pairwise | Poll attempt ceiling | The loop stops at the ceiling even when the API never completes | All responses `completed:false`, advance 3 s twelve times | 12 price requests in total, then none | Vitest + RTL, fake timers |
| IT-12 | Call graph, pairwise | Merge filtering | Rows priced at or below zero, and rows with no matching metadata, are skipped without crashing | Price response with one row at `lowest_converted_price: 0` and one unknown id | Both rows absent, remaining hotels render | Vitest + RTL |
| IT-13 | Call graph, pairwise | Poll rejection | A rejected poll ends the loop and leaves existing results on screen | Second poll rejects | Loop stops, results retained, no unhandled rejection | Vitest + RTL |
| IT-14 | Call graph, pairwise | Network failure on first load | A transport failure surfaces the error state | `fetch` rejects | `"Could not load hotels. Please try again."` rendered | Vitest + RTL |
| IT-15 | Call graph, pairwise | HTTP error on first load (UC03, UC04) | An error status from Ascenda reaches the user as an error with a retry suggestion, not as an empty result set | `fetch` resolves 500 on the hotels request | An error message suggesting a retry renders, and the header does not read `"0 stays found"` | Vitest + RTL |
| IT-16 | Call graph, pairwise | Unmount during polling | `cancelRef` stops further requests when the user navigates away | Unmount after the first poll, advance 3 s | No further `fetch` calls | Vitest + RTL, fake timers |
| IT-17 | Call graph, pairwise | Pagination across poll updates | Page count is right, and the page resets to 1 whenever a poll replaces the hotel list | 45 merged hotels; read page 3, then let one poll resolve | 3 pages with 5 hotels on page 3; after the poll the view returns to page 1 | Vitest + RTL, fake timers |
| IT-18 | Call graph, pairwise | `/hotels` opened without a destination (UC04) | Missing or invalid parameters send the user back to search rather than rendering an empty results shell | Visit `/hotels` with no `destinationId` | Redirect to the search page, and no hotel request is issued | Vitest + RTL |
| IT-19 | Call graph, pairwise | Price request rate limited (UC04) | A 429 waits and retries once, rather than being read as an empty result | First price request resolves 429, the retry resolves normally, advance the delay | One retry issued after the delay, and results render | Vitest + RTL, fake timers |
| IT-20 | Call graph, pairwise | Detail route load (UC05) | The detail page requests one hotel rather than the whole destination list, and tells an unreachable API apart from a hotel that does not exist | Open `/hotels/$hotelId`; then with `getHotelDetails` rejecting; then with it resolving 404 | One `getHotelDetails(hotelId)` call plus one room price call; a fetch error message on rejection; a not found message on 404 | Vitest + RTL |

### 1.9 Integration tests, cluster C: auth, booking and history routes with their service collaborators

Strategy: call graph based, pairwise. What is verified is the handoff on each edge, meaning the route reads a Supabase session, attaches `Bearer ${session.access_token}`, and maps the response into either navigation or user visible text. `@/lib/supabase` is mocked wholesale to supply a deterministic session and deterministic auth outcomes, and the payment gateway is stubbed at its client boundary.

| ID | Strategy | Description | Objective | Input | Expected output | Tool |
|---|---|---|---|---|---|---|
| IT-21 | Call graph, pairwise | Signup with an address that already has an account (UC01) | Registration checks availability before creating anything, and an existing address routes the user to login | `isEmailRegistered` resolves true, submit an otherwise valid form | No user is created, and the app navigates to `/login` with an account already exists notice | Vitest + RTL |
| IT-22 | Call graph, pairwise | Login submitted with a missing field (UC02) | The controller reports missing fields itself rather than leaving it to the browser | Submit with an empty email, then with an empty password | A fields required message renders both times, and no auth request is issued | Vitest + RTL |
| IT-23 | Call graph, pairwise | Login failures told apart (UC02) | An unknown account, a wrong password and a rate limited attempt each get their own message and their own next step | Auth stub returns account not found, then invalid credentials, then rate limited | Unknown account suggests signing up, wrong password shows the attempts remaining, rate limited shows a wait warning, and no session is created in any of the three | Vitest + RTL |
| IT-24 | Call graph, pairwise | Confirmation link opened (UC09) | A valid token marks the address verified, and an expired one offers a resend instead of failing silently | Open the confirmation route with a valid token, then with an expired one | Valid: `markEmailVerified` called once, a confirmed message, then redirect to login. Expired: a link expired message with a resend option, and no verification call | Vitest + RTL |
| IT-25 | Call graph, pairwise | Booking submission shape | The request is correctly authenticated, matches `bookingSchema`, charges the displayed total, and carries no card data | Fill guest and payment fields, submit | One `POST /api/bookings` with `Authorization: Bearer <token>`, `price_paid` equal to the displayed total, and no card number, expiry or CVC anywhere in the body | Vitest + RTL |
| IT-26 | Call graph, pairwise | Card details rejected by the gateway (UC06) | Payment details are validated before anything is charged or written, and the CVC is actually read | Gateway `validateCard` stub returns invalid for a card failing the check digit; then submit with the CVC left blank | A card invalid message renders, the user stays on `/booking`, and no charge and no `POST /api/bookings` are issued | Vitest + RTL |
| IT-27 | Call graph, pairwise | Charge declined (UC06) | A declined payment stops the booking and asks for new payment details | Gateway `charge` stub resolves a decline | A payment failed message renders, and no `POST /api/bookings` is issued | Vitest + RTL |
| IT-28 | Call graph, pairwise | Missing session | An expired session is caught before any request is made | `getSession()` resolves `{ session: null }`, submit | `"Your session has expired. Please sign in again."`, no `fetch` issued | Vitest + RTL |
| IT-29 | Call graph, pairwise | Backend error mapping | A labelled error is shown verbatim and an unlabelled one falls back to a generic message | `400 {error:'Validation failed'}`, then `500` with an empty body | `"Validation failed"`, then `"Booking failed (500). Please try again."`, user stays on `/booking` | Vitest + RTL |
| IT-30 | Call graph, pairwise | Successful booking | Success navigates to confirmation carrying the derived values | `fetch` resolves 201 | Navigation to `/confirmation` with `ref` matching `/^ASC-/`, plus `last4`, `guestName`, `email`, `total`, `points` | Vitest + RTL |
| IT-31 | Call graph, pairwise | Confirmation arithmetic agreement | The confirmation screen derives tax backwards from the total, and must agree with the forward computation on the booking screen | The totals produced by UT-36 passed through the confirmation search parser | Displayed subtotal and taxes match the booking screen exactly | Vitest + RTL |
| IT-32 | Call graph, pairwise | History name resolution | Hotel names are resolved once per unique destination, and an unresolvable id degrades to the raw value | `/bookings` returns 2 bookings across 2 destinations, one hotel absent from the Ascenda response | `fetchHotels` called once per destination, names rendered, raw `hotel_id` shown for the missing one, no crash | Vitest + RTL |
| IT-33 | Call graph, pairwise | History failure paths | Both failure branches of UC07 render their message instead of an empty list | `getSession()` resolves null, then `/api/bookings` resolves 500 | `"Not signed in."`, then `"Failed to load bookings."` | Vitest + RTL |
| IT-34 | Call graph, pairwise | Account deletion from the account screen (UC08) | Deletion is confirmed first, then clears the data, ends the session and returns home, and a failure prompts a retry | Request deletion and confirm at the warning; then repeat with the endpoint resolving 500 | First: one delete request, session invalidated, redirect to `/`. Second: an error with a retry prompt, and the session still active | Vitest + RTL |

### 1.10 Integration tests, cluster D: backend routes with Zod and Supabase

Strategy: top down. The handler is the top module, `bookingSchema` is a real collaborator below it, and the Supabase client is the stubbed bottom collaborator injected through `c.var.supabaseContext`. There is no lower layer worth building up from, and the injection point makes the stub trivial. Vitest drives the real Hono app through `app.request()` for the deterministic branches; Postman covers what only has meaning against a running server and a real database.

| ID | Strategy | Description | Objective | Input | Expected output | Tool |
|---|---|---|---|---|---|---|
| IT-35 | Top down | Successful insert | A valid payload is written and echoed back | `POST /` with a valid body, insert stub resolves a row | `201`, body equals the inserted row | Vitest |
| IT-36 | Top down | Validation short circuit | An invalid payload is rejected before the database is touched | `POST /` with `adults: 0` | `400` with `{error:'Validation failed', details:…}`, insert stub never called | Vitest |
| IT-37 | Top down | Write error mapping | A driver error becomes a 500 carrying its message | Insert stub resolves `{error:{message:'duplicate key'}}` | `500`, body `{error:'duplicate key'}` | Vitest |
| IT-38 | Top down | List ordering and read errors | Bookings come back newest first, and a read error maps to 500 | `GET /` with the select stub resolving rows, then an error | `select('*')` then `.order('created_at',{ascending:false})` with `200`; then `500` carrying the message | Vitest |
| IT-39 | Top down | Authentication guard | The middleware rejects a missing and a malformed token | `GET /api/bookings` with no header, then `Authorization: Bearer garbage` | `401` both times, no booking data in either body | Postman |
| IT-40 | Top down | Live round trip | Create then read works end to end against the real database | Log in, capture the token, `POST` a booking, `GET` the list | `201` then `200`, with the created booking first in the list | Postman |
| IT-41 | Top down | Ownership and price enforced server side (UC06, UC07) | `user_id` comes from the JWT rather than the body, and `price_paid` is checked against the quoted room rate | Authenticate as A and `POST` with B's `user_id`; then `POST` with a tampered `price_paid` | `403` on the first and `400` on the second, with nothing written either time | Postman |
| IT-42 | Top down | Cross user read isolation (UC07) | The list endpoint returns only the caller's bookings | Log in as A, create a booking, log in as B, `GET /api/bookings` | B's response contains only B's bookings and never A's | Postman |
| IT-43 | Top down | Account deletion endpoint (UC08) | `deletePII` clears only the caller's data and invalidates the session, and a driver failure is reported rather than swallowed | Delete as A with data present for A and B; then repeat with the delete stub resolving an error | A's personal data removed, B's untouched, and A's token no longer accepted. The error case returns `500` carrying the driver message | Postman |

### 1.11 End to end tests

| ID | Description | Objective | Input | Expected output | Tool |
|---|---|---|---|---|---|
| E2E-01 | Search, choose and book a hotel | The primary user story completes against a stable fixture, including the auth interruption partway through | Ascenda stubbed by fixture. Visit `/`, type `"Singapore"` and select it, pick dates, set 2 adults and 1 room, search, open the first hotel, select a room, sign in at the redirect, complete guest and payment fields, confirm | `/confirmation` shows a reference matching `/^ASC-[A-HJ-NP-Y2-9]{6}$/`, the card's last 4 digits, and points equal to the total times 10. The map iframe `src` contains the hotel's bounding box | Cypress |
| E2E-02 | Auth guard on a direct link | A signed out visitor is bounced to login and returned with search parameters intact | No session. Navigate to `/booking?hotelId=…` | Redirect to `/login?redirect=…`, and after signing in the booking page returns with its parameters | Cypress |
| E2E-03 | Narrow and page a long result list | Filtering, sorting and pagination stay consistent with each other. The v1 assertion about URL state is removed, because filter, sort and page are component state only | `/ascenda-api/**` stubbed with 45 hotels, all priced under 500, of which 24 are 4 star | Unfiltered: 3 pages, 20 cards on page 2, 5 on page 3. With the 4 star filter: 24 results over 2 pages, every card 4 star. Sorted ascending: first card is the cheapest | Cypress |
| E2E-04 | Review past bookings | A returning member sees their booking and can expand it. The spec seeds its own data instead of depending on E2E-01 | Signed in, one booking seeded through the API in `before()`. Visit `/bookings`, expand the newest row | The seeded booking appears first, and expanding reveals reference, guest count, room type and booking date. Note whether the reference matches the one shown at confirmation | Cypress |
| E2E-05 | Incomplete search feedback | Typing a destination without choosing one blocks the search | On `/`, type `"Tok"`, do not select, submit | `"Please select a destination first"` shown, route unchanged | Cypress |
| E2E-06 | Signup validation feedback | Each invalid signup attempt gets its own specific message | On `/signup`, submit with mismatched passwords, then a 6 character password, then a birthday under 18 years ago | `"Passwords do not match."`, then `"Password must be at least 8 characters."`, then the date input reports invalid through `validationMessage` | Cypress |
| E2E-07 | Map view on the results page (UC04) | Results can be shown geographically, and the list survives the round trip | Load results from the 45 hotel fixture, toggle map view, then toggle back | A marker renders for each hotel on the page, and toggling back restores the same list on the same page | Cypress |

---

## 2. Timeline

| Dates | Focus | Cases |
|---|---|---|
| Sat 25 Jul | Harness and testability. Vitest config in both packages with `environment: 'jsdom'`, `globals: true`, a setup file, and `TZ` pinned to UTC. Add `@vitest/coverage-v8`. Move `cheapestPrice`, `sortHotels` and `computeStayTotals` into `lib/`, export the two input formatters. Scaffold the Postman collection with the token capture step | none |
| Sun 26 to Mon 27 Jul | Pure helpers | UT-01 to UT-15 |
| Sun 26 to Tue 28 Jul | API adapters and mappers | UT-16 to UT-24 |
| Sun 26 to Tue 28 Jul | Request schema, then the Vitest half of cluster D. This half depends only on the backend harness, so it runs alongside the frontend unit work rather than after it | UT-38 to UT-45, IT-35 to IT-38 |
| Wed 29 Jul | Filters, sorting and booking arithmetic | UT-25 to UT-37 |
| Wed 29 Jul | Port the Hurl files into the Postman collection and delete them, then rotate the leaked Supabase key and test password | IT-39, IT-40 |
| Thu 30 Jul | Triage the cases that record questionable behaviour with the team, and decide which become defects. Extract the shared helpers `renderWithRouter`, `mockFetchSequence` and `fakeSupabaseSession` | none |
| Thu 30 to Fri 31 Jul | Cluster A. Starts only after the unit layer is green, because integrating layer 3 against an unproven layer 2 forfeits the defect localisation that bottom up is chosen for | IT-01 to IT-08 |
| Fri 31 Jul to Sun 2 Aug | Cluster B, including the fake timer work for the polling loop and the retry | IT-09 to IT-20 |
| Fri 31 Jul to Sun 2 Aug | Cluster C, auth routes first, then booking, history and account deletion | IT-21 to IT-34 |
| Mon 3 Aug | Postman ownership, isolation and deletion cases, then a full suite run and a coverage checkpoint against the 70 percent target on `lib/**` and `schema.ts` | IT-41 to IT-43 |
| Tue 4 Aug | Install Cypress, build the `cy.session()` login helper and the fixtures for E2E-01, E2E-03 and E2E-07 | none |
| Tue 4 to Thu 6 Aug | End to end specs | E2E-01 to E2E-07 |
| Thu 6 Aug | GitHub Actions workflow running lint, typecheck, Vitest with coverage, Newman and Cypress, with artefact upload | none |
| Fri 7 Aug | Stabilise, collect the coverage report, Newman output and Cypress videos | none |
