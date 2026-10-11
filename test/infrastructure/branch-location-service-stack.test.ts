import * as cdk from 'aws-cdk-lib/core';
import { Template } from 'aws-cdk-lib/assertions';
import * as branchLocationService from '../../lib/branch-location-service-stack';


test('DynamoDB Table Created', () => {
    const app = new cdk.App();
    const stack = new branchLocationService.BranchLocationServiceStack(app, 'TestStack');
    const template = Template.fromStack(stack);

    template.hasResourceProperties('AWS::DynamoDB::Table', {
        KeySchema: [
            {
                AttributeName: 'id',
                KeyType: 'HASH'
            }
        ],
        BillingMode: 'PAY_PER_REQUEST'
    });
});

test('Creates all 4 Lambda functions with Node.js 24 runtime', () => {
    const app = new cdk.App();
    const stack = new branchLocationService.BranchLocationServiceStack(app, 'TestStack');
    const template = Template.fromStack(stack);

    template.resourceCountIs('AWS::Lambda::Function', 4);

    const expectedHandlers = [
        'index.postLocationsHandler',
        'index.getLocationsHandler',
        'index.listLocationsHandler',
        'index.putLocationsHandler'
    ];

    for (const handler of expectedHandlers) {
        template.hasResourceProperties('AWS::Lambda::Function', {
            Handler: handler,
            Runtime: 'nodejs24.x'
        });
    }
});

test('API Gateway RestApi created with Regional endpoint, API Key, and Usage Plan', () => {
    const app = new cdk.App();
    const stack = new branchLocationService.BranchLocationServiceStack(app, 'TestStack');
    const template = Template.fromStack(stack);

    template.hasResourceProperties('AWS::ApiGateway::RestApi', {
        EndpointConfiguration: {
            Types: ['REGIONAL']
        }
    });

    template.hasResourceProperties('AWS::ApiGateway::Method', {
        ApiKeyRequired: true
    });

    template.resourceCountIs('AWS::ApiGateway::UsagePlan', 1);

    template.resourceCountIs('AWS::ApiGateway::ApiKey', 1);
    template.resourceCountIs('AWS::ApiGateway::UsagePlanKey', 1);
});

test('API Gateway exposes POST, GET, and PUT methods', () => {
    const app = new cdk.App();
    const stack = new branchLocationService.BranchLocationServiceStack(app, 'TestStack');
    const template = Template.fromStack(stack);

    for (const httpMethod of ['POST', 'GET', 'PUT']) {
        template.hasResourceProperties('AWS::ApiGateway::Method', {
            HttpMethod: httpMethod,
            ApiKeyRequired: true
        });
    }
});
