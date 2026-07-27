const ASCENDA_URL = process.env.ASCENDA_API_URL;
const PARTNER_PARAMS = {
    partner_id: "1089",
    landing_page: "wl-acme-earn",
    product_type: "earn",
};
export const buildAscendaUrl = (endpoint, params) => {
    const url = new URL(`${ASCENDA_URL}/${endpoint}`);
    for (const [key, value] of Object.entries(PARTNER_PARAMS)) {
        url.searchParams.set(key, value);
    }
    for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
    }
    return url;
};
