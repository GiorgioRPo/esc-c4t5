

import {Hono} from "hono";
import {SearchQuery} from "../domain/SearchQuery.js";
import {buildAscendaUrl} from "../lib/ascenda.js";
const hotelDetails = new Hono();

hotelDetails.get("/:id/price",async (c) => {
try {
  const hotelId = c.req.param('id');
  const query = SearchQuery.fromQueryParams(c.req.query());
  const url = buildAscendaUrl(`hotels/${hotelId}/price`, query.toParameters());

  const response = await fetch(url.toString());
  if(!response.ok) {
    console.error(`Error fetching hotel price: ${response.status}`);
    return c.json({error:"Failed to fetch hotel price from Ascenda Hotel API"},502);
  }
  const data = await response.json();
  return c.json(data);
} catch (error) {
    console.error("Error fetching hotel details:", error);
    return c.json({ error: error.message }, 500);
}
})

