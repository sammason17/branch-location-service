import { APIGatewayProxyEvent } from 'aws-lambda';
import { createPutLocationsHandler } from '../../src/handlers/put-locations';
import { IBranchRepository, IGeocoderService } from '../../src/types/interfaces';
import { BranchLocation } from '../../src/types/location';
import { NotFoundError } from '../../src/types/errors';

describe('putLocationsHandler', () => {
    let mockRepo: jest.Mocked<IBranchRepository>;
    let mockGeocoder: jest.Mocked<IGeocoderService>;

    const existingItem: BranchLocation = {
        id: 'loc-1',
        name: 'London Branch',
        city: 'London',
        state: 'Greater London',
        latitude: 51.5074,
        longitude: -0.1278,
        country: 'UK',
    };

    beforeEach(() => {
        mockRepo = {
            update: jest.fn(),
            getById: jest.fn(),
            create: jest.fn(),
            list: jest.fn(),
        };

        mockGeocoder = {
            geocode: jest.fn(),
        };
    });

    it('returns 200 on partial update without calling geocoder when only name changes', async () => {
        const updatedItem = { ...existingItem, name: 'London Flagship Branch' };
        mockRepo.update.mockResolvedValueOnce(updatedItem);

        const handler = createPutLocationsHandler(mockRepo, mockGeocoder);
        const event = {
            pathParameters: { id: 'loc-1' },
            body: JSON.stringify({ name: 'London Flagship Branch' }),
        } as unknown as APIGatewayProxyEvent;

        const result = await handler(event);

        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual(updatedItem);
        expect(mockGeocoder.geocode).not.toHaveBeenCalled();
        expect(mockRepo.update).toHaveBeenCalledTimes(1);

        const [calledId, calledPayload] = mockRepo.update.mock.calls[0];
        expect(calledId).toBe('loc-1');
        expect(calledPayload.name).toBe('London Flagship Branch');
    });

    it('returns 200 and re-geocodes when city changes', async () => {
        const newCoords = { latitude: 54.7761, longitude: -1.5733 };

        mockRepo.getById.mockResolvedValueOnce(existingItem);
        mockGeocoder.geocode.mockResolvedValueOnce(newCoords);
        mockRepo.update.mockResolvedValueOnce({
            ...existingItem,
            city: 'Durham',
            latitude: newCoords.latitude,
            longitude: newCoords.longitude,
        });

        const handler = createPutLocationsHandler(mockRepo, mockGeocoder);
        const event = {
            pathParameters: { id: 'loc-1' },
            body: JSON.stringify({ city: 'Durham' }),
        } as unknown as APIGatewayProxyEvent;

        const result = await handler(event);

        expect(result.statusCode).toBe(200);
        expect(mockGeocoder.geocode).toHaveBeenCalledWith('Durham', 'UK', 'Greater London');
        expect(mockRepo.update).toHaveBeenCalledTimes(1);

        const [, calledPayload] = mockRepo.update.mock.calls[0];
        expect(calledPayload.latitude).toEqual(newCoords.latitude);
        expect(calledPayload.longitude).toEqual(newCoords.longitude);
    });

    it('returns 400 when id path parameter is missing', async () => {
        const handler = createPutLocationsHandler(mockRepo, mockGeocoder);
        const event = {
            pathParameters: null,
            body: JSON.stringify({ name: 'Test' }),
        } as unknown as APIGatewayProxyEvent;

        const result = await handler(event);

        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body)).toEqual({
            message: 'Missing location ID in path parameters',
        });
        expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it('returns 400 when request body is missing', async () => {
        const handler = createPutLocationsHandler(mockRepo, mockGeocoder);
        const event = {
            pathParameters: { id: 'loc-1' },
            body: null,
        } as unknown as APIGatewayProxyEvent;

        const result = await handler(event);

        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body)).toEqual({ message: 'Request body is required' });
    });

    it('returns 400 on malformed JSON body', async () => {
        const handler = createPutLocationsHandler(mockRepo, mockGeocoder);
        const event = {
            pathParameters: { id: 'loc-1' },
            body: '{ broken json',
        } as unknown as APIGatewayProxyEvent;

        const result = await handler(event);

        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body)).toEqual({ message: 'Malformed JSON in request body' });
    });

    it('returns 400 when validation fails on empty update payload', async () => {
        const handler = createPutLocationsHandler(mockRepo, mockGeocoder);
        const event = {
            pathParameters: { id: 'loc-1' },
            body: JSON.stringify({}),
        } as unknown as APIGatewayProxyEvent;

        const result = await handler(event);

        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body)).toEqual({ message: 'Update payload cannot be empty' });
    });

    it('returns 422 when geocoding fails on location update', async () => {
        mockRepo.getById.mockResolvedValueOnce(existingItem);
        mockGeocoder.geocode.mockRejectedValueOnce(new Error('City not recognised'));

        const handler = createPutLocationsHandler(mockRepo, mockGeocoder);
        const event = {
            pathParameters: { id: 'loc-1' },
            body: JSON.stringify({ city: 'UnknownCity' }),
        } as unknown as APIGatewayProxyEvent;

        const result = await handler(event);

        expect(result.statusCode).toBe(422);
        expect(JSON.parse(result.body)).toEqual({
            message: 'Failed to resolve location coordinates: City not recognised',
        });
        expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it('returns 404 when item does not exist in repository (during getById)', async () => {
        mockRepo.getById.mockRejectedValueOnce(new NotFoundError('Location with id loc-999 not found'));

        const handler = createPutLocationsHandler(mockRepo, mockGeocoder);
        const event = {
            pathParameters: { id: 'loc-999' },
            body: JSON.stringify({ city: 'Durham' }),
        } as unknown as APIGatewayProxyEvent;

        const result = await handler(event);

        expect(result.statusCode).toBe(404);
        expect(JSON.parse(result.body)).toEqual({
            message: 'Location with id loc-999 not found',
        });
    });

    it('returns 404 when item does not exist in repository (during update)', async () => {
        mockRepo.update.mockRejectedValueOnce(new NotFoundError('Location with id loc-999 not found'));

        const handler = createPutLocationsHandler(mockRepo, mockGeocoder);
        const event = {
            pathParameters: { id: 'loc-999' },
            body: JSON.stringify({ name: 'Nonexistent' }),
        } as unknown as APIGatewayProxyEvent;

        const result = await handler(event);

        expect(result.statusCode).toBe(404);
        expect(JSON.parse(result.body)).toEqual({
            message: 'Location with id loc-999 not found',
        });
    });

    it('returns 500 when repository throws an error', async () => {
        mockRepo.update.mockRejectedValueOnce(new Error('DynamoDB write failure'));

        const handler = createPutLocationsHandler(mockRepo, mockGeocoder);
        const event = {
            pathParameters: { id: 'loc-1' },
            body: JSON.stringify({ name: 'Failing Update' }),
        } as unknown as APIGatewayProxyEvent;

        const result = await handler(event);

        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body)).toEqual({
            message: 'Internal server error',
        });
    });

    it('returns 200 and re-geocodes using existing city when only country changes', async () => {
        const newCoords = { latitude: 55.9533, longitude: -3.1883 };

        mockRepo.getById.mockResolvedValueOnce(existingItem);
        mockGeocoder.geocode.mockResolvedValueOnce(newCoords);
        mockRepo.update.mockResolvedValueOnce({
            ...existingItem,
            country: 'Scotland',
            latitude: newCoords.latitude,
            longitude: newCoords.longitude,
        });

        const handler = createPutLocationsHandler(mockRepo, mockGeocoder);
        const event = {
            pathParameters: { id: 'loc-1' },
            body: JSON.stringify({ country: 'Scotland' }),
        } as unknown as APIGatewayProxyEvent;

        const result = await handler(event);

        expect(result.statusCode).toBe(200);
        expect(mockGeocoder.geocode).toHaveBeenCalledWith('London', 'Scotland', 'Greater London');
        expect(mockRepo.update).toHaveBeenCalledTimes(1);
    });

    it('returns 200 and re-geocodes using existing state when state not provided', async () => {
        const newCoords = { latitude: 54.7761, longitude: -1.5733 };

        mockRepo.getById.mockResolvedValueOnce(existingItem);
        mockGeocoder.geocode.mockResolvedValueOnce(newCoords);
        mockRepo.update.mockResolvedValueOnce({
            ...existingItem,
            city: 'Durham',
            latitude: newCoords.latitude,
            longitude: newCoords.longitude,
        });

        const handler = createPutLocationsHandler(mockRepo, mockGeocoder);
        const event = {
            pathParameters: { id: 'loc-1' },
            body: JSON.stringify({ city: 'Durham' }),
        } as unknown as APIGatewayProxyEvent;

        const result = await handler(event);

        expect(result.statusCode).toBe(200);
        expect(mockGeocoder.geocode).toHaveBeenCalledWith('Durham', 'UK', 'Greater London');
    });

    it('returns 200 and re-geocodes with new state when city and state both change', async () => {
        const newCoords = { latitude: 54.7761, longitude: -1.5733 };

        mockRepo.getById.mockResolvedValueOnce(existingItem);
        mockGeocoder.geocode.mockResolvedValueOnce(newCoords);
        mockRepo.update.mockResolvedValueOnce({
            ...existingItem,
            city: 'Durham',
            state: 'County Durham',
            latitude: newCoords.latitude,
            longitude: newCoords.longitude,
        });

        const handler = createPutLocationsHandler(mockRepo, mockGeocoder);
        const event = {
            pathParameters: { id: 'loc-1' },
            body: JSON.stringify({ city: 'Durham', state: 'County Durham' }),
        } as unknown as APIGatewayProxyEvent;

        const result = await handler(event);

        expect(result.statusCode).toBe(200);
        expect(mockGeocoder.geocode).toHaveBeenCalledWith('Durham', 'UK', 'County Durham');

        const [, calledPayload] = mockRepo.update.mock.calls[0];
        expect(calledPayload.state).toBe('County Durham');
    });

    it('returns 422 when geocoding throws a non-Error object during update', async () => {
        mockRepo.getById.mockResolvedValueOnce(existingItem);
        mockGeocoder.geocode.mockRejectedValueOnce('String error');

        const handler = createPutLocationsHandler(mockRepo, mockGeocoder);
        const event = {
            pathParameters: { id: 'loc-1' },
            body: JSON.stringify({ city: 'UnknownCity' }),
        } as unknown as APIGatewayProxyEvent;

        const result = await handler(event);

        expect(result.statusCode).toBe(422);
        expect(JSON.parse(result.body)).toEqual({
            message: 'Failed to resolve location coordinates: Unknown error',
        });
    });
});
