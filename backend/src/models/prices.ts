import {Hono} from "hono";
import {buildAscendaUrl} from "../lib/ascenda.js";
import {SearchQuery} from "../domain/SearchQuery.js";
import {getCached, setCached} from "../lib/cache.js";
import {searchQuerySchema} from "../../schema.js";
const prices = new Hono();

prices.get("/", async (c) => {
    const raw = c.req.query();
    const parsed = searchQuerySchema.safeParse(raw);
    if (!parsed.success) {
        return c.json({ error: parsed.error.flatten().fieldErrors }, 400);
    }
    const q = parsed.data;

    try {
        const query = new SearchQuery(
            q.destination_id, q.checkin, q.checkout, q.guests,
            q.currency, q.country_code, q.lang
        );
        if (!query.validateDates()) {
            return c.json({ error: "Invalid checkin and checkout dates" }, 400);
        }
        const cacheKey = `prices_${JSON.stringify(query.toParameters())}`;
        const cachedHotels = getCached<{completed:boolean}>(cacheKey);
        if (cachedHotels) return c.json(cachedHotels);

        const url = buildAscendaUrl("hotels/prices", query.toParameters());

        const response = await fetch(url.toString());
        if (!response.ok) {
            console.error(`HotelAPI error: ${response.status}`);
            return c.json({ error: "Ascenda Hotel API not fetching hotel prices." }, 502);
        }
        const data = await response.json();
        if (data.completed) {
            setCached(cacheKey, data, 5 * 60 * 1000);
        }
        return c.json(data);
    } catch (error) {
        console.error("Unable to fetch prices:", error);
        return c.json({ error: "An error occurred while fetching prices" }, 500);
    }
});

export default prices;

