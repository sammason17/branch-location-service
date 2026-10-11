# Branch Location Service

The Branch Location Service is a serverless REST API built with AWS CDK, API Gateway, Lambda, and DynamoDB for managing branch locations. It automatically embellishes location addresses with geographic coordinates via OpenStreetMap geocoding while enforcing domain-level validation and structured error handling.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

* `npm run build`   type-check the project
* `npm run watch`   watch for changes and type-check
* `npm run test`    perform the jest unit tests
* `npm run test:coverage`    perform the jest unit tests with coverage report (recommended)
* `npm run lint`    runs static code analysis and enforces TypeScript styling rules.
* `npx cdk deploy`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesised CloudFormation template

## Getting Started & Verification
### Prerequisites
Node.js: v20.x or later (Service was built using node 24 so that is recommended)
npm: v10.x or later (bundled with Node.js)

AWS CLI & Credentials: Not required for building, testing, or synthesising (cdk synth). Only required if deploying to an active AWS account.

### Run the following commands in sequence to verify the solution:
```bash
# 1. Install dependencies
npm ci
# 2. Check linting and code style
npm run lint
# 3. Compile TypeScript
npm run build
# 4. Run full test suite with coverage report (100% coverage)
npm run test:coverage
# 5. Synthesise CDK CloudFormation template
npx cdk synth
```

## Engineering & Solution Design Decisions
### Database: DynamoDB
Key Schema: A single Partition Key (locationId as a String) is all that is required, this keeps the service more simple as records are only ever fetched by their ID or by performing a scan and fetching all records

Billing & Removal: For CDK best practice in a test/dev environment, billingMode has been set to BillingMode.PAY_PER_REQUEST (On-Demand) and removalPolicy to RemovalPolicy.DESTROY so it doesn't leave lingering resources or incur any fixed hourly costs if deployed.

### API Gateway & Traffic Management
Amazon API Gateway acts as the secure entry point, decoupling HTTP routing, status mapping, and protocol handling from Lambda execution. Configured throttling (steady-state rate) and burst limits enforce upstream protection for OpenStreetMap’s strict 1 request-per-second policy, prevent regional Lambda concurrency exhaustion, and guarding against "noisy-neighbor" cost spikes by immediately returning 429 Too Many Requests at the network edge before compute is invoked.

The `/v1` stage establishes clear API contract versioning from the outset, allowing breaking changes in future iterations without disrupting existing consumers.

A rate of 10 RPS with a burst of 20 is an industry-standard baseline for low-to-medium volume domain services. These limits use a standard 2:1 ratio to absorb momentary traffic spikes while preventing runaway AWS billing and upstream API exhaustion.

A randomly generated API key was implemented via API Gateway Usage Plans as a lightweight, zero-dependency mechanism to identify callers, enforce rate limits, and block anonymous access.

### Architectural Decision: Granular Single-Purpose Lambdas
The service adopts a single-responsibility pattern with dedicated Lambda functions per API Gateway method/route (createLocation, updateLocation, getLocation (get by id), and listLocations (get all)) rather than a monolithic router handler. 

This approach enforces AWS IAM least-privilege access—read operations (GET) are restricted to dynamodb:GetItem and dynamodb:Scan, while write operations (POST/PUT) are isolated with write and external network egress permissions. 

Additionally, this pattern optimises Lambda bundle sizes, minimises cold-start overhead, prevents cross-route failure cascading, and provides fine-grained operational metrics (error rates, duration, throttles) per individual endpoint in Amazon CloudWatch.

### Dependency Inversion
High-level modules do not depend on low-level modules: The business handlers (post, put, get, list) do not directly instantiate or depend on concrete infrastructure classes (DynamoDBService, NominatimGeocoderService).

Both depend on abstractions: Handlers depend purely on abstract interfaces defined in the services domain contracts (IBranchRepository, IGeocoderService).

#### Inversion via Factory Functions
Each handler uses a factory (e.g., createPostLocationsHandler(repository, geocoder)), allowing the servcie to inject mocks cleanly in tests without extreme patching or touching the actual AWS SDK / network layers. The concrete AWS/Nominatim implementations are simply passed as default parameters for the Lambda runtime entry point.

### Error Handling
The service implements custom domain error classes—specifically NotFoundError and ConflictError—to decouple application domain failures from HTTP-specific transport concerns. 

When infrastructure operations fail (such as a missing branch ID during lookup or a conditional write failure during creation), the service maps raw DynamoDB responses into these domain errors. 

Lambda handlers catch them centrally, returning consistent JSON envelopes with appropriate HTTP status codes (400, 404, 409, or 500) while ensuring internal stack traces and database implementation details are never leaked to clients.

### Testing Strategy
This service was built folowing a TDD methodology building and testing one module at a time. The service achieves 100% coverage across a mix of Functional (lambda), Unit (services, utils, classes), and infrastructure (ensuring cdk stack behaves as expected).

## Tech Stack 
* `Node version`: v24.14.0
* `TypeScript Version`: v6.0.2
* `CDK version`: v2.1145.0

The latest AWS-supported runtimes were selected to maximise long-term maintainability and support, carrying negligible risk for a scoped service of this size.

Using TypeScript 6 instead of TypeScript 7 because TS7's Go-based compiler doesn't expose the JavaScript compiler API required by ts-jest and other development tooling. While TS7 offers 10x performance improvements, the ecosystem hasn't fully adapted yet. TS6 is the final JavaScript-based release and provides stable compatibility with Node 24 runtime, Jest testing framework, and all build tools.


## AI Usage
Whilst code was all written by myself, Claude Code was used on completion to run a code review, suggestions incldued: 
- General 500 errors needed to be sanitised to not leak error messages
- Pagination token validation missing try/catch (could throw on malformed input)
- TTL field configured in DynamoDB but never used in code
- Route naming uses singular /location instead of plural /locations (REST convention)

These findings were quickly updated to finish off a more robust and comprehensive service.

Gemini was used as chat to discuss:
- Makign final decisions on scope
- Finding edge cases for tests
- Diagnosing failing tests


## Future Improvements
### Error Handling
For production scale, error handling could be enhanced by adopting a middleware like Middy.js to remove boilerplate try/catch blocks, standardising on RFC 7807 error response schemas, and attaching request-scoped correlation IDs for easier CloudWatch debugging.

### Path Aliasing
Replace relative import chains (e.g., ../../domain/errors) with TypeScript path aliases (such as @domain/* and @services/*) to eliminate deep nesting and improve modularity.

### Postman Collecton and environment
I would have liked to build a postman collection and environment for testing the api once deployed which could be stored without variables in a `/docs` folder in the repo.

###  API Security
In a multi-tenant production environment, static API keys should be replaced with OAuth 2.0 / OIDC access_tokens evaluated by a custom Lambda Authoriser or Amazon Cognito. Implementing token-based authentication would allow stateless signature verification, fine-grained role-based access control (RBAC) at the route level, and seamless identity propagation without managing shared static secrets across client environments.
