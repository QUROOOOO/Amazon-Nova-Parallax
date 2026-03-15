import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';

require('dotenv').config();

export class BackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ==========================================
    // 1. AUTHENTICATION: Cognito User Pool
    // ==========================================
    // Set up Email-based OTP login
    const userPool = new cognito.UserPool(this, 'ParallaxEmailUserPool', {
      userPoolName: 'ParallaxEmailUsers',
      selfSignUpEnabled: true,
      signInAliases: { email: true }, // Changed to email
      autoVerify: { email: true }, // Verify via email
      passwordPolicy: {
        minLength: 8,
        requireLowercase: false,
        requireUppercase: false,
        requireDigits: false,
        requireSymbols: false,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For hackathon purposes
    });

    const userPoolClient = new cognito.UserPoolClient(this, 'ParallaxAppClient', {
      userPool,
      generateSecret: false,
      authFlows: {
        custom: true, // For OTP Flow Custom Auth Challenges
        userSrp: true,
      },
    });

    // ==========================================
    // 2. DATABASE & STORAGE
    // ==========================================
    // Users Table (Profiles, Metadata, Matchmaker)
    const usersTable = new dynamodb.Table(this, 'UsersTable', {
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Ideas & Trends Table (The Spark & Research Vault)
    const contentTable = new dynamodb.Table(this, 'ContentTable', {
      partitionKey: { name: 'contentId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    
    // Add GSI to fetch all content for a user easily
    contentTable.addGlobalSecondaryIndex({
      indexName: 'UserContentIndex',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
    });

    // Repurpose Lab Jobs Table
    const jobsTable = new dynamodb.Table(this, 'JobsTable', {
      partitionKey: { name: 'jobId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    jobsTable.addGlobalSecondaryIndex({
      indexName: 'UserJobsIndex',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
    });

    // Matchmaker Profiles Table
    const profilesTable = new dynamodb.Table(this, 'ProfilesTable', {
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    // Find users by their industry role
    profilesTable.addGlobalSecondaryIndex({
      indexName: 'IndustryIndex',
      partitionKey: { name: 'industry', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'vibeScore', type: dynamodb.AttributeType.NUMBER },
    });

    // Matchmaker Connections Table (Sync Requests)
    const connectionsTable = new dynamodb.Table(this, 'ConnectionsTable', {
      partitionKey: { name: 'syncId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // S3 Bucket for Static Images (Rich Notes)
    const imageBucket = new s3.Bucket(this, 'ParallaxImageBucket', {
      publicReadAccess: true,
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: false,
        blockPublicPolicy: false,
        ignorePublicAcls: false,
        restrictPublicBuckets: false,
      }),
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.POST, s3.HttpMethods.PUT],
          allowedOrigins: ['https://main.d16fcylhtesdpm.amplifyapp.com', 'http://localhost:5173'],
          allowedHeaders: ['*'],
        },
      ],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // ==========================================
    // 3. COMPUTE: AWS Lambda Functions
    // ==========================================
    // Shared NodeJs Lambda properties
    const lambdaProps = {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      memorySize: 128, // Credit Conservation
      environment: {
        USERS_TABLE: usersTable.tableName,
        CONTENT_TABLE: contentTable.tableName,
        USER_POOL_ID: userPool.userPoolId,
        REGION: cdk.Stack.of(this).region,
        GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
      },
    };

    // Post Confirmation Handler (Welcome Email)
    const postConfirmationHandler = new lambda.Function(this, 'PostConfirmationHandler', {
      ...lambdaProps,
      code: lambda.Code.fromAsset(path.join(__dirname, 'handlers/post-confirmation')),
      environment: {
        ...lambdaProps.environment,
        SENDER_EMAIL: process.env.SENDER_EMAIL || 'welcome@parallax.video',
      }
    });

    postConfirmationHandler.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ses:SendEmail', 'ses:SendRawEmail'],
      resources: ['*'],
    }));

    userPool.addTrigger(cognito.UserPoolOperation.POST_CONFIRMATION, postConfirmationHandler);

    // The Spark (Save Idea) Handler
    const sparkHandler = new lambda.Function(this, 'SparkHandler', {
      ...lambdaProps,
      code: lambda.Code.fromAsset(path.join(__dirname, 'handlers/spark')),
    });
    contentTable.grantReadWriteData(sparkHandler);

    // Smart Vault (Trends) Handler
    const trendsHandler = new lambda.Function(this, 'TrendsHandler', {
      ...lambdaProps,
      code: lambda.Code.fromAsset(path.join(__dirname, 'handlers/trends')),
      timeout: cdk.Duration.seconds(30),
      environment: {
        ...lambdaProps.environment,
        YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY || '',
        GEMINI_API_KEY: process.env.GEMINI_API_KEY || ''
      }
    });

    // Mock AI Generator Handler (no Bedrock — zero cost)
    const generateHandler = new lambda.Function(this, 'GenerateHandler', {
      ...lambdaProps,
      code: lambda.Code.fromAsset(path.join(__dirname, 'handlers/generate')),
      timeout: cdk.Duration.seconds(10),
    });

    // Cloudinary Video Upload Handler
    const cloudinaryUploadHandler = new lambda.Function(this, 'CloudinaryUploadHandler', {
      ...lambdaProps,
      code: lambda.Code.fromAsset(path.join(__dirname, 'handlers/cloudinary-upload')),
      timeout: cdk.Duration.seconds(60),
      memorySize: 512, // Higher memory for video upload streaming
      environment: {
        ...lambdaProps.environment,
        CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || '',
        CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || '',
        CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || '',
      }
    });

    // Cloudinary Video Analysis Handler — Amazon Nova Parallax Pipeline
    const cloudinaryAnalyzeHandler = new lambda.Function(this, 'CloudinaryAnalyzeHandler', {
      ...lambdaProps,
      code: lambda.Code.fromAsset(path.join(__dirname, 'handlers/cloudinary-analyze')),
      timeout: cdk.Duration.minutes(5), // Bypass API Gateway 29s limit
      memorySize: 512, // Enough for base64 video buffer
      environment: {
        ...lambdaProps.environment,
        CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || '',
        CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || '',
        CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || '',
        IMAGE_BUCKET: imageBucket.bucketName,                   // Required for S3 upload → Bedrock
        ACCOUNT_ID: cdk.Stack.of(this).account,                 // Required for Bedrock S3 bucket owner
        ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || 'https://main.d16fcylhtesdpm.amplifyapp.com,http://localhost:5173',
      }
    });

    // Grant S3 write permission for video upload (used by Bedrock S3 URI)
    imageBucket.grantWrite(cloudinaryAnalyzeHandler);
    imageBucket.grantRead(cloudinaryAnalyzeHandler);

    // Grant Bedrock permissions to invoke Amazon Nova Lite
    cloudinaryAnalyzeHandler.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'bedrock:InvokeModel',
        'bedrock:Converse',
        'bedrock:ConverseStream',
      ],
      resources: [
        `arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-lite-v1:0`,
        `arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-pro-v1:0`,
      ],
    }));

    // Direct Lambda Function URL — bypasses API Gateway 29s hard timeout
    const analyzeUrl = cloudinaryAnalyzeHandler.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ['*'],
        allowedHeaders: ['*'],
        allowedMethods: [lambda.HttpMethod.ALL],
      },
    });

    // Explicitly grant public access to the Function URL. 
    // CDK sometimes skips this if other authorizations are in play.
    cloudinaryAnalyzeHandler.grantInvokeUrl(new iam.AnyPrincipal());

    // Image Upload Presigned URL Generator
    const uploadHandler = new lambda.Function(this, 'UploadHandler', {
      ...lambdaProps,
      code: lambda.Code.fromAsset(path.join(__dirname, 'handlers/upload')),
      environment: {
        ...lambdaProps.environment,
        IMAGE_BUCKET: imageBucket.bucketName,
      }
    });
    
    imageBucket.grantWrite(uploadHandler);

    // Users API Handler (Profile Management)
    const usersHandler = new lambda.Function(this, 'UsersHandler', {
      ...lambdaProps,
      code: lambda.Code.fromAsset(path.join(__dirname, 'handlers/users')),
    });
    usersTable.grantReadWriteData(usersHandler);

    // Get Profiles Handler (Matchmaker)
    const getProfilesHandler = new lambda.Function(this, 'GetProfilesHandler', {
      ...lambdaProps,
      code: lambda.Code.fromAsset(path.join(__dirname, 'handlers/profiles')),
      environment: {
        ...lambdaProps.environment,
        PROFILES_TABLE: profilesTable.tableName,
      }
    });
    profilesTable.grantReadData(getProfilesHandler);
    getProfilesHandler.addToRolePolicy(new iam.PolicyStatement({
      actions: ['dynamodb:Scan'],
      resources: [profilesTable.tableArn, `${profilesTable.tableArn}/index/*`]
    }));

    // Send Sync Request Handler
    const sendSyncRequestHandler = new lambda.Function(this, 'SendSyncRequestHandler', {
      ...lambdaProps,
      code: lambda.Code.fromAsset(path.join(__dirname, 'handlers/sync')),
      environment: {
        ...lambdaProps.environment,
        CONNECTIONS_TABLE: connectionsTable.tableName,
        PROFILES_TABLE: profilesTable.tableName, // Needs to read availability
      }
    });
    connectionsTable.grantWriteData(sendSyncRequestHandler);
    profilesTable.grantReadData(sendSyncRequestHandler);

    // ==========================================
    // 4. ROUTING: API Gateway
    // ==========================================
    const api = new apigateway.RestApi(this, 'ParallaxApi', {
      restApiName: 'Parallax Service',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type', 'Authorization', 'X-Amz-Date',
          'X-Api-Key', 'X-Amz-Security-Token', 'X-Requested-With',
        ],
      }
    });

    // Create the Cognito Authorizer
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'ParallaxAuthorizer', {
      cognitoUserPools: [userPool],
    });

    // POST/GET /spark -> Save and load raw ideas
    const sparkResource = api.root.addResource('spark');
    sparkResource.addMethod('POST', new apigateway.LambdaIntegration(sparkHandler), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    sparkResource.addMethod('GET', new apigateway.LambdaIntegration(sparkHandler), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    sparkResource.addMethod('DELETE', new apigateway.LambdaIntegration(sparkHandler), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // GET /trends -> Fetch mock viral trends for the Smart Vault
    const trendsResource = api.root.addResource('trends');
    trendsResource.addMethod('GET', new apigateway.LambdaIntegration(trendsHandler), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // POST /generate -> AI hook & pitch generation
    const generateResource = api.root.addResource('generate');
    generateResource.addMethod('POST', new apigateway.LambdaIntegration(generateHandler), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // POST /upload -> Get S3 Presigned URL for Image Uploads
    const uploadResource = api.root.addResource('upload');
    uploadResource.addMethod('POST', new apigateway.LambdaIntegration(uploadHandler), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Repurpose Lab API Routes (Cloudinary Pipeline)
    const repurposeResource = api.root.addResource('repurpose');
    const repurposeCloudinaryUpload = repurposeResource.addResource('cloudinary-upload');
    repurposeCloudinaryUpload.addMethod('POST', new apigateway.LambdaIntegration(cloudinaryUploadHandler), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    const repurposeCloudinaryAnalyze = repurposeResource.addResource('cloudinary-analyze');
    repurposeCloudinaryAnalyze.addMethod('POST', new apigateway.LambdaIntegration(cloudinaryAnalyzeHandler), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // POST/GET /users -> Manage profiles in DynamoDB
    const usersResource = api.root.addResource('users');
    usersResource.addMethod('POST', new apigateway.LambdaIntegration(usersHandler), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    usersResource.addMethod('GET', new apigateway.LambdaIntegration(usersHandler), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    usersResource.addMethod('PUT', new apigateway.LambdaIntegration(usersHandler), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // GET /profiles -> Fetch matchmaker recommendations
    const profilesResource = api.root.addResource('profiles');
    profilesResource.addMethod('GET', new apigateway.LambdaIntegration(getProfilesHandler), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // POST /sync -> Send a collab sync request
    const syncResource = api.root.addResource('sync');
    syncResource.addMethod('POST', new apigateway.LambdaIntegration(sendSyncRequestHandler), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Outputs to use in Frontend
    new cdk.CfnOutput(this, 'ParallaxApiEndpoint', { value: api.url });
    new cdk.CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
    new cdk.CfnOutput(this, 'UserPoolClientId', { value: userPoolClient.userPoolClientId });
    new cdk.CfnOutput(this, 'UsersTableName', { value: usersTable.tableName });
    new cdk.CfnOutput(this, 'ProfilesTableName', { value: profilesTable.tableName });
    new cdk.CfnOutput(this, 'ConnectionsTableName', { value: connectionsTable.tableName });
    new cdk.CfnOutput(this, 'ContentTableName', { value: contentTable.tableName });
    new cdk.CfnOutput(this, 'JobsTableName', { value: jobsTable.tableName });
    new cdk.CfnOutput(this, 'ImageBucketName', { value: imageBucket.bucketName });
    new cdk.CfnOutput(this, 'AnalyzeFunctionUrl', { value: analyzeUrl.url });
  }
}
