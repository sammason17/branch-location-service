import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBService } from '../services/dynamodb-service';
import { IBranchRepository } from '../types/interfaces';
import { NotFoundError } from '../types/errors';

const defaultRepository = new DynamoDBService();

export function createGetLocationsHandler(
    repository: IBranchRepository = defaultRepository
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

        try {
            const item = await repository.getById(id);

            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item),
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
                body: JSON.stringify({ message: 'Internal server error' }),
            };
        }
    };
}

export const getLocationsHandler = createGetLocationsHandler();