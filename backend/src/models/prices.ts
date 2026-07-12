import {Hono} from "hono";

const prices = new Hono();
const ASCENDA_URL = process.env.ASCENDA_API_URL;

const PARTNER_PARAMS = {

    partner_id:"1089",
    landing_page: "wl-acme-earn",
    product_type: "earn",
};


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
        const url = new URL(`${ASCENDA_URL}/hotels/prices`);
        url.searchParams.set("destination_id", destinationId);
        url.searchParams.set("checkin", checkin);
        url.searchParams.set("checkout", checkout);
        url.searchParams.set("guests", guests);
        url.searchParams.set("currency", currency);
        url.searchParams.set("country_code", countryCode);
        url.searchParams.set("lang", language);

        for (const [key,value] of Object.entries(PARTNER_PARAMS)) {
            url.searchParams.set(key,value);
        }

        const response = await fetch(url.toString());
        if(!response.ok) {
            console.error(`HotelAPI error: ${response.status}`);
            return c.json(
                {error: "Ascenda Hotel API not fetching hotel prices."},
                502

            );
        }
        const data = await response.json();

        return c.json(data);


    } catch (error) {
        console.error("Unable to fetch prices:", error);
        return c.json({ error: "An error occurred while fetching prices"}, 500);
    }
});
export default prices;

