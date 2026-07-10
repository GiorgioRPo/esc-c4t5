import {Hono} from "hono";

const hotels = new Hono();

const ASCENDA_URL = process.env.ASCENDA_API_URL;

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
            const url = new URL(`${ASCENDA_URL}/hotels`);
            url.searchParams.set("destination_id", destinationId);
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