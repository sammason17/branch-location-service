import { APIGatewayProxyEvent } from 'aws-lambda';
import { createListLocationsHandler } from '../../src/handlers/list-locations';
import { IBranchRepository } from '../../src/types/interfaces';

describe('listLocationsHandler', () => {
  let mockRepo: jest.Mocked<IBranchRepository>;

  beforeEach(() => {
    mockRepo = {
      list: jest.fn(),
      getById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };
  });

  it('returns 200 and calls repository without params when query string is omitted', async () => {
    mockRepo.list.mockResolvedValueOnce({ items: [], nextToken: undefined });
    const handler = createListLocationsHandler(mockRepo);

    const event = {
      queryStringParameters: null,
    } as unknown as APIGatewayProxyEvent;

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    expect(mockRepo.list).toHaveBeenCalledWith(undefined, undefined);
    expect(JSON.parse(result.body)).toEqual({ items: [], nextToken: undefined });
  });

  it('passes parsed limit and nextToken to repository when provided', async () => {
    mockRepo.list.mockResolvedValueOnce({
      items: [{ id: 'loc-1', name: 'Test', city: 'Test', country: 'Test', latitude: 0, longitude: 0 }],
      nextToken: 'enc-cursor',
    });
    const handler = createListLocationsHandler(mockRepo);

    const event = {
      queryStringParameters: { limit: '25', nextToken: 'enc-cursor' },
    } as unknown as APIGatewayProxyEvent;

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    expect(mockRepo.list).toHaveBeenCalledWith(25, 'enc-cursor');
    expect(JSON.parse(result.body)).toEqual({
      items: [{ id: 'loc-1', name: 'Test', city: 'Test', country: 'Test', latitude: 0, longitude: 0 }],
      nextToken: 'enc-cursor',
    });
  });

  it.each([
    ['not-a-number'],
    ['-5'],
    ['0'],
  ])('returns 400 when limit is invalid (%p)', async (invalidLimit) => {
    const handler = createListLocationsHandler(mockRepo);

    const event = {
      queryStringParameters: { limit: invalidLimit },
    } as unknown as APIGatewayProxyEvent;

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      message: 'Query parameter "limit" must be a positive integer',
    });
    expect(mockRepo.list).not.toHaveBeenCalled();
  });

  it('returns 400 when pagination token is invalid', async () => {
    mockRepo.list.mockRejectedValueOnce(new Error('Invalid pagination token'));
    const handler = createListLocationsHandler(mockRepo);

    const event = {
      queryStringParameters: { nextToken: 'invalid-token' },
    } as unknown as APIGatewayProxyEvent;

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      message: 'Invalid pagination token',
    });
  });

  it('returns 500 when repository throws an unexpected error', async () => {
    mockRepo.list.mockRejectedValueOnce(new Error('Scan failed in DynamoDB'));
    const handler = createListLocationsHandler(mockRepo);

    const event = {} as unknown as APIGatewayProxyEvent;

    const result = await handler(event);

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toEqual({
      message: 'Internal server error',
    });
  });
});