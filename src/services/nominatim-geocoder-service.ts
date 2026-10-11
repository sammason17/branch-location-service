import { IGeocoderService } from '../types/interfaces';

interface NominatimResult {
    lat: string;
    lon: string;
    display_name: string;
}

export class NominatimGeocoderService implements IGeocoderService {
    private readonly baseUrl: string;
    private readonly userAgent: string;

    constructor(
        baseUrl = 'https://nominatim.openstreetmap.org/search',
        userAgent = 'BranchLocationService/1.0 (internal-demo)'
    ) {
        this.baseUrl = baseUrl;
        this.userAgent = userAgent;
    }

    public async geocode(city: string, country: string, state?: string): Promise<{ latitude: number; longitude: number }> {
        const params = new URLSearchParams({
            city,
            country,
            format: 'json',
        });

        if (state) {
            params.append('state', state);
        }

        const url = `${this.baseUrl}?${params.toString()}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': this.userAgent,
                Accept: 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`Geocoding request failed with status ${response.status}`);
        }

        const data = (await response.json()) as NominatimResult[];

        if (!Array.isArray(data) || data.length === 0) {
            throw new Error(
                `Unable to geocode location: ${city}, ${country}`
            );
        }

        const firstMatch = data[0];

        return {
            latitude: parseFloat(firstMatch.lat),
            longitude: parseFloat(firstMatch.lon),
        };
    }
}