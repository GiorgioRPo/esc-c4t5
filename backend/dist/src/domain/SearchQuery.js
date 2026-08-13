export class SearchQuery {
    destinationId;
    checkin;
    checkout;
    guests;
    currency;
    countryCode;
    language;
    constructor(destinationId, checkin, checkout, guests, currency = "SGD", countryCode = "SG", language = "en_US") {
        this.destinationId = destinationId;
        this.checkin = checkin;
        this.checkout = checkout;
        this.guests = guests;
        this.currency = currency;
        this.countryCode = countryCode;
        this.language = language;
    }
    static fromQueryParams(queryParams) {
        const { destination_id, checkin, checkout, guests, currency, country_code, lang } = queryParams;
        if (!destination_id || !checkin || !checkout || !guests) {
            return null;
        }
        return new SearchQuery(destination_id, checkin, checkout, guests, currency ?? "SGD", country_code ?? "SG", lang ?? "en_US");
    }
    validateDates() {
        const checkinDate = new Date(this.checkin);
        const checkoutDate = new Date(this.checkout);
        if (Number.isNaN(checkinDate.getTime()) || Number.isNaN(checkoutDate.getTime()))
            return false;
        return checkoutDate > checkinDate;
    }
    toParameters() {
        return {
            destination_id: this.destinationId,
            checkin: this.checkin,
            checkout: this.checkout,
            guests: this.guests,
            currency: this.currency,
            country_code: this.countryCode,
            lang: this.language
        };
    }
}
