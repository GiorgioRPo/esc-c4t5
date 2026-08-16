import {Hono} from "hono";
import {buildAscendaUrl} from "../lib/ascenda.js";
import {getCached, setCached} from "../lib/cache.js";
import {hotelsQuerySchema} from "../../schema.js";
const hotels = new Hono();

hotels.get("/", async (c) => {
    const raw = c.req.query();
    const parsed = hotelsQuerySchema.safeParse(raw);
    if (!parsed.success) {
        return c.json({ error: parsed.error.flatten().fieldErrors }, 400);
    }
    const destinationId = parsed.data.destination_id;

    try {
        const cacheKey = `hotels_${destinationId}`;
        const cachedHotels = getCached<unknown>(cacheKey);
        if (cachedHotels) return c.json(cachedHotels);

        const url = buildAscendaUrl("hotels", { destination_id: destinationId});

        const response = await fetch(url.toString());
        if (!response.ok) {
            console.error(`HotelAPI error: ${response.status}`);
            return c.json({ error: "Failed to fetch hotels from Ascenda Hotel API" }, 502);
        }
        const data = await response.json();
        setCached(cacheKey, data, 3600000); // 1 hour cache
        return c.json(data);
    } catch (error) {
        console.error("Error fetching hotel:", error);
        return c.json({ error: "An error occured while fetching hotels" }, 500);
    }
});

export default hotels;