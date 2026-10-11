import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
    DynamoDBDocumentClient,
    GetCommand,
    PutCommand,
    ScanCommand,
    UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { BranchLocation, PaginatedResult, UpdateBranchDto } from '../types/location';
import { IBranchRepository } from '../types/interfaces';
import { ConflictError, NotFoundError } from '../types/errors';

export class DynamoDBService implements IBranchRepository {
    private readonly dbTable: string;
    private readonly docClient: DynamoDBDocumentClient;

    constructor(dbInstance: DynamoDBClient = new DynamoDBClient()) {
        this.dbTable = process.env.LOCATIONS_TABLE!;
        this.docClient = DynamoDBDocumentClient.from(dbInstance);
    }

    public async create(branch: BranchLocation): Promise<BranchLocation> {
        try {
            await this.docClient.send(
                new PutCommand({
                    TableName: this.dbTable,
                    Item: branch,
                    ConditionExpression: 'attribute_not_exists(id)',
                })
            );
            return branch;
        } catch (error: unknown) {
            if (
                typeof error === 'object' &&
                error !== null &&
                'name' in error &&
                (error as { name: string }).name === 'ConditionalCheckFailedException'
            ) {
                throw new ConflictError(`Location with id ${branch.id} already exists`);
            }
            throw error;
        }
    }

    public async update(
        id: string,
        updates: UpdateBranchDto & { latitude?: number; longitude?: number }
    ): Promise<BranchLocation> {
        const updatePayload = updates as unknown as Record<string, unknown>;
        const entries = Object.entries(updatePayload).filter(
            ([, value]) => value !== undefined
        );

        if (entries.length === 0) {
            return this.getById(id);
        }

        const expressionAttributeNames: Record<string, string> = {};
        const expressionAttributeValues: Record<string, unknown> = {};
        const setExpressions: string[] = [];

        for (const [key, value] of entries) {
            const attrName = `#${key}`;
            const attrValue = `:${key}`;

            expressionAttributeNames[attrName] = key;
            expressionAttributeValues[attrValue] = value;
            setExpressions.push(`${attrName} = ${attrValue}`);
        }

        const updateExpression = `SET ${setExpressions.join(', ')}`;

        try {
            const response = await this.docClient.send(
                new UpdateCommand({
                    TableName: this.dbTable,
                    Key: { id },
                    UpdateExpression: updateExpression,
                    ExpressionAttributeNames: expressionAttributeNames,
                    ExpressionAttributeValues: expressionAttributeValues,
                    ConditionExpression: 'attribute_exists(id)',
                    ReturnValues: 'ALL_NEW',
                })
            );

            if (!response.Attributes) {
                throw new NotFoundError(`Location with id ${id} not found`);
            }

            return response.Attributes as BranchLocation;
        } catch (error: unknown) {
            if (
                typeof error === 'object' &&
                error !== null &&
                'name' in error &&
                (error as { name: string }).name === 'ConditionalCheckFailedException'
            ) {
                throw new NotFoundError(`Location with id ${id} not found`);
            }
            throw error;
        }
    }

    public async getById(id: string): Promise<BranchLocation> {
        const response = await this.docClient.send(
            new GetCommand({
                TableName: this.dbTable,
                Key: { id },
            })
        );

        if (!response.Item) {
            throw new NotFoundError(`Location with id ${id} not found`);
        }

        return response.Item as BranchLocation;
    }

    public async list(limit = 20, nextToken?: string): Promise<PaginatedResult<BranchLocation>> {
        let exclusiveStartKey: Record<string, unknown> | undefined;
        if (nextToken) {
            try {
                exclusiveStartKey = JSON.parse(Buffer.from(nextToken, 'base64').toString('utf8'));
            } catch {
                throw new Error('Invalid pagination token');
            }
        }

        const response = await this.docClient.send(
            new ScanCommand({
                TableName: this.dbTable,
                Limit: limit,
                ExclusiveStartKey: exclusiveStartKey,
            })
        );

        const newNextToken = response.LastEvaluatedKey
            ? Buffer.from(JSON.stringify(response.LastEvaluatedKey)).toString('base64')
            : undefined;

        return {
            items: (response.Items as BranchLocation[]) ?? [],
            nextToken: newNextToken,
        };
    }
}