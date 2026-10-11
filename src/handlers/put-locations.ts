import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBService } from '../services/dynamodb-service';
import { NominatimGeocoderService } from '../services/nominatim-geocoder-service';
import { IBranchRepository, IGeocoderService } from '../types/interfaces';
import { UpdateBranchDto } from '../types/location';
import { NotFoundError } from '../types/errors';
import { validateUpdateBranchDto } from '../utils/validation';

const defaultRepository = new DynamoDBService();
const defaultGeocoder = new NominatimGeocoderService();

export function createPutLocationsHandler(
    repository: IBranchRepository = defaultRepository,
    geocoder: IGeocoderService = defaultGeocoder
) {
    return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
        const id = event.pathParameters?.id;
        if (!id || id.trim() === '') {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: 'Missing location ID in path parameters' }),
            };
        }

        if (!event.body) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: 'Request body is required' }),
            };
        }

        let payload: UpdateBranchDto;
        try {
            payload = JSON.parse(event.body);
        } catch {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: 'Malformed JSON in request body' }),
            };
        }

        const validation = validateUpdateBranchDto(payload);
        if (!validation.valid) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: validation.error }),
            };
        }

        // Re-geocode if city or country changes (both required for geocoding)
        let newCoordinates: { latitude: number; longitude: number } | undefined;
        if (payload.city !== undefined || payload.country !== undefined) {
            // Need to fetch existing location to get full geocoding data
            try {
                const existing = await repository.getById(id);
                const city = payload.city ?? existing.city;
                const country = payload.country ?? existing.country;
                const state = payload.state !== undefined ? payload.state : existing.state;

                newCoordinates = await geocoder.geocode(city, country, state);
            } catch (error: unknown) {
                if (error instanceof NotFoundError) {
                    return {
                        statusCode: 404,
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: error.message }),
                    };
                }
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                return {
                    statusCode: 422,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: `Failed to resolve location coordinates: ${errorMessage}`,
                    }),
                };
            }
        }

        const updateData = {
            ...payload,
            ...(payload.name ? { name: payload.name.trim() } : {}),
            ...(payload.city ? { city: payload.city.trim() } : {}),
            ...(payload.state !== undefined ? { state: payload.state?.trim() } : {}),
            ...(payload.country ? { country: payload.country.trim() } : {}),
            ...(newCoordinates ? { latitude: newCoordinates.latitude, longitude: newCoordinates.longitude } : {}),
        };

        try {
            const updatedItem = await repository.update(id, updateData);

            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedItem),
            };
        } catch (error: unknown) {
            if (error instanceof NotFoundError) {
                return {
                    statusCode: 404,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: error.message }),
                };
            }

            console.error('Repository error:', error);
            return {
                statusCode: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: 'Internal server error',
                }),
            };
        }
    };
}

export const putLocationsHandler = createPutLocationsHandler();