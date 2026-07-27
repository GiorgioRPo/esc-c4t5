import {Hono} from "hono";
import {buildAscendaUrl} from "../lib/ascenda.js";
import {SearchQuery} from "../domain/SearchQuery.js";
import {getCached, setCached} from "../lib/cache.js";
const prices = new Hono();



prices.get("/", async (c) => {
    const destinationId = c.req.query("destination_id");
    const checkin = c.req.query("checkin");
    const checkout = c.req.query("checkout");
    const guests = c.req.query("guests");

    const currency = c.req.query("currency") ?? "SGD";
    const countryCode = c.req.query("country_code") ?? "SG";
    const language = c.req.query("lang") ?? "en_US";

    if (!destinationId || !checkin || !checkout|| !guests) {
        return c.json(
            {
                error:
                "destination_id, checkin, checkout, and guests are required. Please input them"
            },
            400
        );
    }


    try { 
        const query = SearchQuery.fromQueryParams(c.req.query());
        if(!query) return c.json({error:"Invalid query parameters"}, 400);
        if(!query.validateDates()) return c.json({error:"Invalid checkin and checkout dates"}, 400);
        const cacheKey = `prices_${JSON.stringify(query.toParameters())}`;
        const cachedHotels = getCached<{completed:boolean}>(cacheKey);
        if(cachedHotels) return c.json(cachedHotels);
       
        const url =buildAscendaUrl("hotels/prices",query.toParameters());

        const response = await fetch(url.toString());
        if(!response.ok) {
            console.error(`HotelAPI error: ${response.status}`);
            return c.json(
                {error: "Ascenda Hotel API not fetching hotel prices."},
                502

            );
        }
        const data = await response.json();
        if (data.completed) {
            setCached(cacheKey, data, 5*60*1000); // 5 minute cache
        }
        return c.json(data);


    } catch (error) {
        console.error("Unable to fetch prices:", error);
        return c.json({ error: "An error occurred while fetching prices"}, 500);
    }
});
export default prices;

