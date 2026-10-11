import {
  Stack,
  StackProps,
  aws_apigateway as apiGateway,
  aws_lambda as lambda,
  aws_lambda_nodejs as nodeLambda,
  aws_dynamodb as dynamodb,
  Duration,
  CfnOutput,
  RemovalPolicy
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class BranchLocationServiceStack extends Stack {
  private constructPrefix: string;

  private locationsTable: dynamodb.Table;
  private postLocationsFn: nodeLambda.NodejsFunction;
  private putLocationsFn: nodeLambda.NodejsFunction;
  private getLocationsFn: nodeLambda.NodejsFunction;
  private listLocationsFn: nodeLambda.NodejsFunction;
  private api: apiGateway.RestApi;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    this.constructPrefix = `${this.stackName}-`;

    this.createDynamoDbTables();
    this.createLambdaFunctions();
    this.createApi();
  }

  private getConstructId(suffix: string) {
    return this.constructPrefix + suffix;
  }

  private createDynamoDbTables() {
    this.locationsTable = new dynamodb.Table(
      this,
      this.getConstructId('LocationsTable'),
      {
        partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        removalPolicy: RemovalPolicy.DESTROY
      }
    );
  }

  private createLambdaFunctions() {
    this.postLocationsFn = new nodeLambda.NodejsFunction(
      this,
      this.getConstructId('PostLocationsFn'),
      {
        entry: __dirname + '/../src/handlers/post-locations.ts',
        environment: {
          ...this.getDefaultEnvVars(),
        },
        runtime: lambda.Runtime.NODEJS_24_X,
        timeout: Duration.seconds(10),
        tracing: lambda.Tracing.ACTIVE,
        handler: 'postLocationsHandler',
        description: 'API post locations endpoint handler'
      }
    );
    this.locationsTable.grantReadWriteData(this.postLocationsFn);

    this.putLocationsFn = new nodeLambda.NodejsFunction(
      this,
      this.getConstructId('PutLocationsFn'),
      {
        entry: __dirname + '/../src/handlers/put-locations.ts',
        environment: {
          ...this.getDefaultEnvVars(),
        },
        runtime: lambda.Runtime.NODEJS_24_X,
        timeout: Duration.seconds(10),
        tracing: lambda.Tracing.ACTIVE,
        handler: 'putLocationsHandler',
        description: 'API put locations endpoint handler'
      }
    );
    this.locationsTable.grantReadWriteData(this.putLocationsFn);

    this.getLocationsFn = new nodeLambda.NodejsFunction(
      this,
      this.getConstructId('GetLocationsFn'),
      {
        entry: __dirname + '/../src/handlers/get-locations.ts',
        environment: {
          ...this.getDefaultEnvVars(),
        },
        runtime: lambda.Runtime.NODEJS_24_X,
        timeout: Duration.seconds(10),
        tracing: lambda.Tracing.ACTIVE,
        handler: 'getLocationsHandler',
        description: 'API get locations endpoint handler'
      }
    );
    this.locationsTable.grantReadData(this.getLocationsFn);

    this.listLocationsFn = new nodeLambda.NodejsFunction(
      this,
      this.getConstructId('ListLocationsFn'),
      {
        entry: __dirname + '/../src/handlers/list-locations.ts',
        environment: {
          ...this.getDefaultEnvVars(),
        },
        runtime: lambda.Runtime.NODEJS_24_X,
        timeout: Duration.seconds(10),
        tracing: lambda.Tracing.ACTIVE,
        handler: 'listLocationsHandler',
        description: 'API list locations endpoint handler'
      }
    );
    this.locationsTable.grantReadData(this.listLocationsFn);
  }

  private getDefaultEnvVars() {
    return {
      "LOCATIONS_TABLE": this.locationsTable.tableName,
      "ENVIRONMENT": process.env.NODE_ENV || 'dev',
      "REGION": this.region,
    }
  }

  private createApi() {
    this.api = new apiGateway.RestApi(this, this.getConstructId('RESTfulApi'), {
      endpointTypes: [apiGateway.EndpointType.REGIONAL],

      description: 'RESTful API for Branch Location Service',
      deployOptions: {
        stageName: 'v1',
        tracingEnabled: true,
        metricsEnabled: true,
        dataTraceEnabled: true,
        loggingLevel: apiGateway.MethodLoggingLevel.ERROR
      }
    });

    new CfnOutput(this, 'apiUrl', { value: this.api.url });
    const apiResource = this.api.root.addResource('api');

    const locationsResource = apiResource.addResource('locations');
    locationsResource.addMethod(
      'POST',
      new apiGateway.LambdaIntegration(this.postLocationsFn),
      { apiKeyRequired: true }
    );
    locationsResource.addMethod(
      'GET',
      new apiGateway.LambdaIntegration(this.listLocationsFn),
      { apiKeyRequired: true }
    );

    const singleLocationResource = locationsResource.addResource('{id}');
    singleLocationResource.addMethod(
      'GET',
      new apiGateway.LambdaIntegration(this.getLocationsFn),
      { apiKeyRequired: true }
    );
    singleLocationResource.addMethod(
      'PUT',
      new apiGateway.LambdaIntegration(this.putLocationsFn),
      { apiKeyRequired: true }
    );

    const apiKey = this.api.addApiKey(this.getConstructId('ApiKey'), {
      apiKeyName: 'location-service-api-key',
      // No value used to autogenerate key to be retrieved in AWS console
    });

    const usagePlan = this.api.addUsagePlan(this.getConstructId('UsagePlan'), {
      name: 'LocationServiceUsagePlan',
      throttle: {
        rateLimit: 10,
        burstLimit: 20
      },
      quota: {
        limit: 1000,
        period: apiGateway.Period.MONTH
      }
    });

    usagePlan.addApiStage({
      stage: this.api.deploymentStage,
    });
    usagePlan.addApiKey(apiKey);

  }
}
