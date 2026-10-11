import { APIGatewayProxyEvent } from 'aws-lambda';
import { createGetLocationsHandler } from '../../src/handlers/get-locations';
import { IBranchRepository } from '../../src/types/interfaces';
import { BranchLocation } from '../../src/types/location';
import { NotFoundError } from '../../src/types/errors';

describe('getLocationsHandler', () => {
    let mockRepo: jest.Mocked<IBranchRepository>;

    const exampleItem: BranchLocation = {
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
            getById: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            list: jest.fn(),
        };
    });

    it('returns 200 and the location item when found', async () => {
        mockRepo.getById.mockResolvedValueOnce(exampleItem);
        const handler = createGetLocationsHandler(mockRepo);

        const event = {
            pathParameters: { id: 'loc-1' },
        } as unknown as APIGatewayProxyEvent;

        const result = await handler(event);

        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual(exampleItem);
        expect(mockRepo.getById).toHaveBeenCalledWith('loc-1');
    });

    it('returns 404 when item does not exist', async () => {
        mockRepo.getById.mockRejectedValueOnce(new NotFoundError('Location with id loc-999 not found'));
        const handler = createGetLocationsHandler(mockRepo);

        const event = {
            pathParameters: { id: 'loc-999' },
        } as unknown as APIGatewayProxyEvent;

        const result = await handler(event);

        expect(result.statusCode).toBe(404);
        expect(JSON.parse(result.body)).toEqual({
            message: 'Location with id loc-999 not found',
        });
    });

    it('returns 400 when pathParameters is missing or empty', async () => {
        const handler = createGetLocationsHandler(mockRepo);

        const eventNull = {
            pathParameters: null,
        } as unknown as APIGatewayProxyEvent;

        const result = await handler(eventNull);

        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body)).toEqual({
            message: 'Missing location ID in path parameters',
        });
        expect(mockRepo.getById).not.toHaveBeenCalled();
    });

    it('returns 400 when id is whitespace only', async () => {
        const handler = createGetLocationsHandler(mockRepo);

        const eventBlank = {
            pathParameters: { id: '   ' },
        } as unknown as APIGatewayProxyEvent;

        const result = await handler(eventBlank);

        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body)).toEqual({
            message: 'Missing location ID in path parameters',
        });
        expect(mockRepo.getById).not.toHaveBeenCalled();
    });

    it('returns 500 when repository throws an error', async () => {
        mockRepo.getById.mockRejectedValueOnce(new Error('DynamoDB read failure'));
        const handler = createGetLocationsHandler(mockRepo);

        const event = {
            pathParameters: { id: 'loc-1' },
        } as unknown as APIGatewayProxyEvent;

        const result = await handler(event);

        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body)).toEqual({
            message: 'Internal server error',
        });
    });
});
