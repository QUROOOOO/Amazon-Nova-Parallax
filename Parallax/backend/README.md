# Vibe Collab AI - Serverless Backend

This document describes the AWS Serverless architecture driving the Vibe Collab AI platform.

## Architecture & Infrastructure

The entire backend is orchestrated using **AWS CDK (TypeScript)**.

### Core AWS Services Used

- **Compute:** AWS Lambda functions (using `Node.js 20.x`) to run isolated business logic (idea generation, video repurposing handling, S3 presigned URL generation).
- **Storage:** Amazon DynamoDB (UsersTable, ContentTable) and Amazon S3 (ImageBucket, VideoBucket).
- **API & Auth:** Amazon API Gateway providing secure RESTful routes protected by Amazon Cognito (Passwordless / OTP enabled).
- **Generative AI:** Amazon Bedrock (Claude 3.5 Sonnet) invoked directly via AWS SDK within Lambda logic to power the vault and matching algorithms.

## Commands

- `npm run build` compile typescript to js
- `npm run watch` watch for changes and compile
- `npm run test` perform the jest unit tests
- `npx cdk deploy` deploy this stack to your default AWS account/region
- `npx cdk diff` compare deployed stack with current state
- `npx cdk synth` emits the synthesized CloudFormation template
