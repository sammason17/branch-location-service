import { APIGatewayProxyEvent } from 'aws-lambda';
import { createPostLocationsHandler } from '../../src/handlers/post-locations';
import { IBranchRepository, IGeocoderService } from '../../src/types/interfaces';
import { BranchLocation } from '../../src/types/location';
import { ConflictError } from '../../src/types/errors';

describe('postLocationsHandler', () => {
    let mockRepo: jest.Mocked<IBranchRepository>;
    let mockGeocoder: jest.Mocked<IGeocoderService>;

    const validPayload = {
        name: 'Durham Branch',
        city: 'Durham',
        state: 'County Durham',
        country: 'UK',
    };

    const mockCoordinates = {
        latitude: 54.7761,
        longitude: -1.5733,
    };

    beforeEach(() => {
        mockRepo = {
            create: jest.fn().mockImplementation(async (branch: BranchLocation) => branch),
            getById: jest.fn(),
            update: jest.fn(),
            list: jest.fn(),
        };

        mockGeocoder = {
            geocode: jest.fn().mockResolvedValue(mockCoordinates),
        };
    });

    it('returns 201 and creates branch location on valid input', async () => {
        const handler = createPostLocationsHandler(mockRepo, mockGeocoder);
        const event = {
            body: JSON.stringify(validPayload),
        } as APIGatewayProxyEvent;

        const result = await handler(event);

        expect(result.statusCode).toBe(201);
        const body = JSON.parse(result.body);
        expect(body).toMatchObject({
            name: validPayload.name,
            city: validPayload.city,
            state: validPayload.state,
            country: validPayload.country,
            latitude: mockCoordinates.latitude,
            longitude: mockCoordinates.longitude,
        });
        expect(body.id).toBeDefined();
        expect(mockGeocoder.geocode).toHaveBeenCalledWith(validPayload.city, validPayload.country, validPayload.state);
        expect(mockRepo.create).toHaveBeenCalledTimes(1);
    });

    it('returns 400 when body is missing', async () => {
        const handler = createPostLocationsHandler(mockRepo, mockGeocoder);
        const event = {} as APIGatewayProxyEvent;

        const result = await handler(event);

        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body)).toEqual({ message: 'Request body is required' });
        expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it('returns 400 on malformed JSON body', async () => {
        const handler = createPostLocationsHandler(mockRepo, mockGeocoder);
        const event = {
            body: '{ malformed json',
        } as APIGatewayProxyEvent;

        const result = await handler(event);

        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body)).toEqual({ message: 'Malformed JSON in request body' });
        expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it('returns 400 when validation fails on invalid payload', async () => {
        const handler = createPostLocationsHandler(mockRepo, mockGeocoder);
        const event = {
            body: JSON.stringify({ name: '' }),
        } as APIGatewayProxyEvent;

        const result = await handler(event);

        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body).message).toBeDefined();
        expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it('returns 422 when geocoding fails to resolve coordinates', async () => {
        mockGeocoder.geocode.mockRejectedValueOnce(new Error('Location not found'));

        const handler = createPostLocationsHandler(mockRepo, mockGeocoder);
        const event = {
            body: JSON.stringify(validPayload),
        } as APIGatewayProxyEvent;

        const result = await handler(event);

        expect(result.statusCode).toBe(422);
        expect(JSON.parse(result.body)).toEqual({
            message: 'Failed to resolve location coordinates: Location not found',
        });
        expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it('returns 500 when repository throws an error', async () => {
        mockRepo.create.mockRejectedValueOnce(new Error('DynamoDB connection lost'));

        const handler = createPostLocationsHandler(mockRepo, mockGeocoder);
        const event = {
            body: JSON.stringify(validPayload),
        } as APIGatewayProxyEvent;

        const result = await handler(event);

        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body)).toEqual({
            message: 'Internal server error',
        });
    });

    it('returns 409 Conflict when repository throws ConflictError for duplicate item', async () => {
        mockRepo.create.mockRejectedValueOnce(
            new ConflictError('Location with id loc-duplicate already exists')
        );

        const handler = createPostLocationsHandler(mockRepo, mockGeocoder);
        const event = {
            body: JSON.stringify(validPayload),
        } as APIGatewayProxyEvent;

        const result = await handler(event);

        expect(result.statusCode).toBe(409);
        expect(JSON.parse(result.body)).toEqual({
            message: 'Location with id loc-duplicate already exists',
        });
        expect(mockRepo.create).toHaveBeenCalledTimes(1);
    });

    it('returns 422 when geocoding throws a non-Error object', async () => {
        mockGeocoder.geocode.mockRejectedValueOnce('String error');

        const handler = createPostLocationsHandler(mockRepo, mockGeocoder);
        const event = {
            body: JSON.stringify(validPayload),
        } as APIGatewayProxyEvent;

        const result = await handler(event);

        expect(result.statusCode).toBe(422);
        expect(JSON.parse(result.body)).toEqual({
            message: 'Failed to resolve location coordinates: Unknown error',
        });
    });
});
