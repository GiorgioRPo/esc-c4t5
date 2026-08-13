import {Hono} from "hono";
import {buildAscendaUrl} from "../lib/ascenda.js";
import {getCached, setCached} from "../lib/cache.js";
const hotels = new Hono();



hotels.get("/", async (c) => {
    const destinationId = c.req.query("destination_id");


    if (!destinationId) {
        return c.json(
            {
            error: "destination_id is required",
    },
    400

);
    }


        try {
            const cacheKey = `hotels_${destinationId}`;
            const cachedHotels = getCached<unknown>(cacheKey);
            if (cachedHotels) return c.json(cachedHotels);
            
            const url = buildAscendaUrl("hotels", { destination_id: destinationId});

            const response = await fetch(url.toString());
            if (!response.ok) {
                console.error( 
                    `HotelAPI error: ${response.status}`
                );
                return c.json(
                    {
                        error: "Failed to fetch hotels from Ascenda Hotel API",
                    },
                    502
                );
                    }
                    const hotels = await response.json();
                    setCached(cacheKey, hotels, 3600000); // 1 hour cache
                    return c.json(hotels);
                } catch (error) {
                    console.error("Error fetching hotel:", error);
                    return c.json(
                        {
                            error:"An error occured while fetching hotels",
                        },
                        500
                    );
                }
            }
        )
        
export default hotels;