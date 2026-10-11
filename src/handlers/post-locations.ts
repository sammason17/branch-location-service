import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { DynamoDBService } from '../services/dynamodb-service';
import { NominatimGeocoderService } from '../services/nominatim-geocoder-service';
import { IBranchRepository, IGeocoderService } from '../types/interfaces';
import { BranchLocation } from '../types/location';
import { ConflictError } from '../types/errors';
import { validateCreateBranchDto } from '../utils/validation';

const defaultRepository = new DynamoDBService();
const defaultGeocoder = new NominatimGeocoderService();

export function createPostLocationsHandler(
    repository: IBranchRepository = defaultRepository,
    geocoder: IGeocoderService = defaultGeocoder
) {
    return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
        if (!event.body) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: 'Request body is required' }),
            };
        }

        let payload: unknown;
        try {
            payload = JSON.parse(event.body);
        } catch {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: 'Malformed JSON in request body' }),
            };
        }

        const validation = validateCreateBranchDto(payload);
        if (!validation.valid || !validation.data) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: validation.error }),
            };
        }

        const branchData = validation.data;

        let coordinates;
        try {
            coordinates = await geocoder.geocode(branchData.city, branchData.country, branchData.state);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return {
                statusCode: 422,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: `Failed to resolve location coordinates: ${errorMessage}`,
                }),
            };
        }

        const newBranch: BranchLocation = {
            id: randomUUID(),
            name: branchData.name.trim(),
            city: branchData.city.trim(),
            state: branchData.state?.trim(),
            country: branchData.country.trim(),
            latitude: coordinates.latitude,
            longitude: coordinates.longitude,
        };

        try {
            const createdItem = await repository.create(newBranch);

            return {
                statusCode: 201,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(createdItem),
            };
        } catch (error: unknown) {
            if (error instanceof ConflictError) {
                return {
                    statusCode: 409,
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

export const postLocationsHandler = createPostLocationsHandler();