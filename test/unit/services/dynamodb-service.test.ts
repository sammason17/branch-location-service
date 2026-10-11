import { DynamoDBDocumentClient, GetCommand, ScanCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBService } from '../../../src/services/dynamodb-service';
import { BranchLocation } from '../../../src/types/location';
import { ConflictError, NotFoundError } from '../../../src/types/errors';


const ddbMock = mockClient(DynamoDBDocumentClient);

describe('DynamoDBService', () => {
    const originalEnv = process.env.LOCATIONS_TABLE;

    const exampleItem: BranchLocation = {
        id: "loc-1",
        name: "London Branch",
        city: "London",
        state: "Greater London",
        latitude: 51.5074,
        longitude: -0.1278,
        country: "UK",
    };

    beforeAll(() => {
        process.env.LOCATIONS_TABLE = 'TestTable';
    });

    afterAll(() => {
        process.env.LOCATIONS_TABLE = originalEnv;
    });

    beforeEach(() => {
        ddbMock.reset();
    });

    it('gets an item by id', async () => {
        ddbMock.on(GetCommand).resolves({
            Item: exampleItem,
        });

        const service = new DynamoDBService();
        const result = await service.getById('loc-1');

        expect(result).toEqual(exampleItem);
        expect(ddbMock.commandCalls(GetCommand)).toHaveLength(1);
    });

    it('throws NotFoundError when getting item by id if no item exists', async () => {
        ddbMock.on(GetCommand).resolves({});

        const service = new DynamoDBService();

        await expect(service.getById('loc-1')).rejects.toThrow(NotFoundError);
        await expect(service.getById('loc-1')).rejects.toThrow('Location with id loc-1 not found');
        expect(ddbMock.commandCalls(GetCommand)).toHaveLength(2);
    });

    it('gets all items in db', async () => {
        const items = Array.from({ length: 6 }, (_, index) => ({
            ...exampleItem,
            id: `loc-${index + 1}`,
            name: `Branch ${index + 1}`,
        }));

        ddbMock.on(ScanCommand).resolves({
            Items: items,
        });

        const service = new DynamoDBService();
        const result = await service.list();

        expect(result).toEqual({
            items,
            nextToken: undefined,
        });

        expect(ddbMock.commandCalls(ScanCommand)).toHaveLength(1);
    });

    it('handles pagination: encodes LastEvaluatedKey to nextToken and passes ExclusiveStartKey', async () => {
        const service = new DynamoDBService();

        const firstBatchItems = [{ ...exampleItem, id: 'loc-1', name: 'Branch 1' }];
        const mockLastEvaluatedKey = { id: 'loc-1' };
        const secondBatchItems = [{ ...exampleItem, id: 'loc-2', name: 'Branch 2' }];

        // Queue up responses in order
        ddbMock
            .on(ScanCommand)
            .resolvesOnce({
                Items: firstBatchItems,
                LastEvaluatedKey: mockLastEvaluatedKey,
            })
            .resolvesOnce({
                Items: secondBatchItems,
                LastEvaluatedKey: undefined,
            });

        // First call
        const firstResult = await service.list(1);

        expect(firstResult.items).toEqual(firstBatchItems);
        expect(firstResult.nextToken).toBeDefined();

        const decodedToken = JSON.parse(
            Buffer.from(firstResult.nextToken!, 'base64').toString('utf8')
        );
        expect(decodedToken).toEqual(mockLastEvaluatedKey);

        // Second call
        const secondResult = await service.list(1, firstResult.nextToken);

        expect(secondResult.items).toEqual(secondBatchItems);
        expect(secondResult.nextToken).toBeUndefined();

        // Assert mock calls
        const calls = ddbMock.commandCalls(ScanCommand);
        expect(calls).toHaveLength(2);
        expect(calls[1].args[0].input).toMatchObject({
            TableName: 'TestTable',
            Limit: 1,
            ExclusiveStartKey: mockLastEvaluatedKey,
        });
    });

    it('throws error when pagination token is invalid base64', async () => {
        const service = new DynamoDBService();

        await expect(service.list(10, 'not-valid-base64!!!')).rejects.toThrow('Invalid pagination token');
        expect(ddbMock.commandCalls(ScanCommand)).toHaveLength(0);
    });

    it('throws error when pagination token is valid base64 but not valid JSON', async () => {
        const service = new DynamoDBService();
        const invalidToken = Buffer.from('not json content').toString('base64');

        await expect(service.list(10, invalidToken)).rejects.toThrow('Invalid pagination token');
        expect(ddbMock.commandCalls(ScanCommand)).toHaveLength(0);
    });

    it('handles empty database response', async () => {
        ddbMock.on(ScanCommand).resolves({
            Items: [],
        });

        const service = new DynamoDBService();
        const result = await service.list();

        expect(result).toEqual({
            items: [],
            nextToken: undefined,
        });

        expect(ddbMock.commandCalls(ScanCommand)).toHaveLength(1);
    });

    it('handles undefined database response', async () => {
        ddbMock.on(ScanCommand).resolves({
            Items: undefined, // added for coverage but theoretically should not happen
        });

        const service = new DynamoDBService();
        const result = await service.list();

        expect(result).toEqual({
            items: [],
            nextToken: undefined,
        });

        expect(ddbMock.commandCalls(ScanCommand)).toHaveLength(1);
    });

    it('create new record', async () => {
        const service = new DynamoDBService();
        const newItem: BranchLocation = exampleItem;

        ddbMock.on(PutCommand).resolves({});

        const result = await service.create(newItem);

        expect(result).toEqual(newItem);
        expect(ddbMock.commandCalls(PutCommand)).toHaveLength(1);
    });

    it('create new record fails as record already exists', async () => {
        const service = new DynamoDBService();
        const newItem: BranchLocation = exampleItem;

        const conditionalError = new Error('The conditional request failed');
        conditionalError.name = 'ConditionalCheckFailedException';

        ddbMock.on(PutCommand).rejects(conditionalError);

        const promise = service.create(newItem);

        await expect(promise).rejects.toBeInstanceOf(ConflictError);
        await expect(promise).rejects.toThrow(
            `Location with id ${newItem.id} already exists`
        );

        expect(ddbMock.commandCalls(PutCommand)).toHaveLength(1);
    });

    it('throws unhandled DynamoDB errors during create', async () => {
        const service = new DynamoDBService();
        const awsError = new Error('ProvisionedThroughputExceededException');
        awsError.name = 'ProvisionedThroughputExceededException';

        ddbMock.on(PutCommand).rejects(awsError);

        await expect(service.create(exampleItem)).rejects.toThrow(
            'ProvisionedThroughputExceededException'
        );

        expect(ddbMock.commandCalls(PutCommand)).toHaveLength(1);
    });

    it('updates a record and returns updated item', async () => {
        const updatedItem: BranchLocation = {
            ...exampleItem,
            name: 'Updated London Branch',
        };

        ddbMock.on(UpdateCommand).resolves({
            Attributes: updatedItem,
        });

        const service = new DynamoDBService();
        const result = await service.update('loc-1', {
            name: 'Updated London Branch',
        });

        expect(result).toEqual(updatedItem);
        expect(ddbMock.commandCalls(UpdateCommand)).toHaveLength(1);

        const callInput = ddbMock.commandCalls(UpdateCommand)[0].args[0].input;
        expect(callInput).toMatchObject({
            TableName: 'TestTable',
            Key: { id: 'loc-1' },
            UpdateExpression: 'SET #name = :name',
            ConditionExpression: 'attribute_exists(id)',
            ReturnValues: 'ALL_NEW',
        });
    });

    it('returns existing item if update payload has no keys to update', async () => {
        ddbMock.on(GetCommand).resolves({
            Item: exampleItem,
        });

        const service = new DynamoDBService();
        const result = await service.update('loc-1', {
            name: undefined,
        });

        expect(result).toEqual(exampleItem);
        expect(ddbMock.commandCalls(UpdateCommand)).toHaveLength(0);
        expect(ddbMock.commandCalls(GetCommand)).toHaveLength(1);
    });

    it('throws NotFoundError if record does not exist to update', async () => {
        const conditionalError = new Error('The conditional request failed');
        conditionalError.name = 'ConditionalCheckFailedException';

        ddbMock.on(UpdateCommand).rejects(conditionalError);

        const service = new DynamoDBService();

        await expect(
            service.update('loc-999', {
                name: 'Nonexistent',
            })
        ).rejects.toThrow(NotFoundError);

        expect(ddbMock.commandCalls(UpdateCommand)).toHaveLength(1);
    });

    it('throws unhandled DynamoDB errors during update', async () => {
        const awsError = new Error('InternalServerError');
        awsError.name = 'InternalServerError';

        ddbMock.on(UpdateCommand).rejects(awsError);

        const service = new DynamoDBService();

        await expect(
            service.update('loc-1', {
                name: 'New Name',
            })
        ).rejects.toThrow('InternalServerError');

        expect(ddbMock.commandCalls(UpdateCommand)).toHaveLength(1);
    });

    it('throws NotFoundError if update response contains no Attributes', async () => {
        ddbMock.on(UpdateCommand).resolves({});

        const service = new DynamoDBService();

        await expect(
            service.update('loc-1', {
                name: 'New Name',
            })
        ).rejects.toThrow(NotFoundError);

        expect(ddbMock.commandCalls(UpdateCommand)).toHaveLength(1);
    });
});
