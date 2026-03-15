const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');

// Standard CORS headers — defined once, used everywhere
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'OPTIONS,GET,POST',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Content-Type': 'application/json',
};

// Lazy-init the DynamoDB client inside the handler to prevent
// cold-start crashes if REGION env var is momentarily undefined.
let ddbClient = null;
function getClient() {
  if (!ddbClient) {
    const region = process.env.REGION || process.env.AWS_REGION || 'ap-south-1';
    ddbClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
  }
  return ddbClient;
}

exports.handler = async (event) => {
  console.log('GetProfiles Event:', event.httpMethod, event.path);

  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  try {
    const client = getClient();

    const claims = event.requestContext?.authorizer?.claims;
    const currentUserId = claims ? claims.sub : 'anonymous';
    const industryFilter = event.queryStringParameters?.industry || null;

    const tableName = process.env.PROFILES_TABLE;
    if (!tableName) {
      console.error('PROFILES_TABLE env var is not set!');
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Server configuration error: PROFILES_TABLE not set.' }),
      };
    }

    const commandParams = {
      TableName: tableName,
    };

    // Add FilterExpression if an industry is specified
    if (industryFilter && industryFilter !== 'All') {
      commandParams.FilterExpression = 'industry = :industry';
      commandParams.ExpressionAttributeValues = {
        ':industry': industryFilter,
      };
    }

    const { Items } = await client.send(new ScanCommand(commandParams));

    // Exclude the current user from their own recommendations
    let profiles = Items || [];
    profiles = profiles.filter(p => p.userId !== currentUserId);

    // If the table is completely empty, seed it with mock users for the hackathon demo
    if (profiles.length === 0 && (!industryFilter || industryFilter === 'All')) {
      console.log('No profiles found. Seeding mock data for Hackathon Demo...');
      const mockProfiles = [
        {
          userId: 'mock-1',
          name: 'Sarah Chen',
          avatarUrl: 'https://i.pravatar.cc/150?u=sarah',
          industry: 'Video Editor',
          vibeScore: 98,
          status: 'Available',
          badges: ['Premiere Pro', 'After Effects', 'Fast Responder'],
          portfolios: [
            { type: 'youtube', url: 'https://youtube.com/watch?v=1', thumbnail: 'https://picsum.photos/300/200?random=1' },
            { type: 'pdf', url: 'https://example.com/resume.pdf', title: 'Editing Reel 2026.pdf' }
          ]
        },
        {
          userId: 'mock-2',
          name: 'David Rodriguez',
          avatarUrl: 'https://i.pravatar.cc/150?u=david',
          industry: 'ML Engineer',
          vibeScore: 94,
          status: 'In a Collab',
          badges: ['AWS Certified', 'Bedrock Expert'],
          portfolios: [
            { type: 'github', url: 'https://github.com/david', title: 'Generative AI Pipelines' },
            { type: 'image', url: 'https://picsum.photos/300/200?random=2', title: 'Architecture Diagram' }
          ]
        },
        {
          userId: 'mock-3',
          name: 'Aisha Patel',
          avatarUrl: 'https://i.pravatar.cc/150?u=aisha',
          industry: 'Prompt Architect',
          vibeScore: 99,
          status: 'Available',
          badges: ['Top Rated', 'Creative Direction'],
          portfolios: [
            { type: 'pdf', url: 'https://example.com/prompts.pdf', title: 'Master Prompt Guide.pdf' }
          ]
        }
      ];

      // Seed in parallel for speed
      await Promise.all(mockProfiles.map(p =>
        client.send(new PutCommand({ TableName: tableName, Item: p }))
      ));
      profiles = mockProfiles;
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify(profiles),
    };
  } catch (error) {
    console.error('Failed to get profiles:', error);

    // ── Determine a helpful error message ──
    let message = 'Internal Server Error during processing.';
    if (error.name === 'ResourceNotFoundException') {
      message = 'Profiles table does not exist. Please deploy the backend stack first.';
    } else if (error.name === 'AccessDeniedException') {
      message = 'Lambda does not have permission to read the Profiles table.';
    } else if (error.code === 'CredentialsProviderError' || error.name === 'CredentialsProviderError') {
      message = 'AWS credentials not available in this Lambda environment.';
    }

    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: message }),
    };
  }
};
