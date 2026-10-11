import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBService } from '../services/dynamodb-service';
import { IBranchRepository } from '../types/interfaces';

const defaultRepository = new DynamoDBService();

export function createListLocationsHandler(
  repository: IBranchRepository = defaultRepository
) {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const limitQuery = event.queryStringParameters?.limit;
    const nextToken = event.queryStringParameters?.nextToken;

    let limit: number | undefined;
    if (limitQuery !== undefined) {
      const parsed = parseInt(limitQuery, 10);
      if (isNaN(parsed) || parsed <= 0) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'Query parameter "limit" must be a positive integer' }),
        };
      }
      limit = parsed;
    }

    try {
      const result = await repository.list(limit, nextToken);

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result),
      };
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'Invalid pagination token') {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'Invalid pagination token' }),
        };
      }

      console.error('Repository error:', error);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Internal server error' }),
      };
    }
  };
}

export const listLocationsHandler = createListLocationsHandler();