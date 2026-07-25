import {Hono} from "hono";
import {buildAscendaUrl} from "../lib/ascenda.js";
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