

import {Hono} from "hono";
import {SearchQuery} from "../domain/SearchQuery.js";
import {buildAscendaUrl} from "../lib/ascenda.js";
import {getCached, setCached} from "../lib/cache.js";
const hotelDetails = new Hono();

hotelDetails.get("/:id/price",async (c) => {
try {
  const hotelId = c.req.param('id');
  const query = SearchQuery.fromQueryParams(c.req.query());
  if (!query) return c.json({error: "Missing required query parameters"}, 400);
  const cacheKey = `hotel_${hotelId}_price_${JSON.stringify(query.toParameters())}`;
  const cachedPrice = getCached<{completed:boolean}>(cacheKey);
  if (cachedPrice) return c.json(cachedPrice);
  const url = buildAscendaUrl(`hotels/${hotelId}/price`, query.toParameters());
  
  const response = await fetch(url.toString());
  if(!response.ok) {
    console.error(`Error fetching hotel price: ${response.status}`);
    return c.json({error:"Failed to fetch hotel price from Ascenda Hotel API"},502);
  }
  const data = await response.json();
  if(data.completed) {
    setCached(cacheKey, data, 5*60*1000); //5 minute cache
  }
  return c.json(data);
} catch (error) {
    console.error("Error fetching hotel details:", error);
    return c.json({ error: "Failed to fetch hotel details from Ascenda Hotel API" }, 500);
}
})

export default hotelDetails;
