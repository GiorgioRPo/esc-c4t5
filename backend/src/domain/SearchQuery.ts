export class SearchQuery {
    constructor(
        public destinationId: string,
        public checkin: string,
        public checkout: string,
        public guests: string,
        public currency: string = "SGD",
        public countryCode: string = "SG",
        public language: string = "en_US"
    ) {}

    static fromQueryParams(queryParams: Record<string, string | undefined>): SearchQuery | null {
        const {destination_id, checkin, checkout, guests, currency, country_code, lang } = queryParams;
        if (!destination_id || !checkin || !checkout || !guests) {
            return null;
        }
        return new SearchQuery( 
            destination_id, checkin, checkout, guests, currency?? "SGD", country_code?? "SG", lang ?? "en_US",
        )
    }
    validateDates(): boolean {
        const checkinDate = new Date(this.checkin);
        const checkoutDate = new Date(this.checkout);
        if(Number.isNaN(checkinDate.getTime()) || Number.isNaN(checkoutDate.getTime())) return false;
        return checkoutDate>checkinDate;
    }
    toParameters(): Record<string,string> {
        return {
            destination_id: this.destinationId,
            checkin:this.checkin,
            checkout:this.checkout,
            guests:this.guests,
            currency:this.currency,
            country_code:this.countryCode,
            lang:this.language
        }
    }
}