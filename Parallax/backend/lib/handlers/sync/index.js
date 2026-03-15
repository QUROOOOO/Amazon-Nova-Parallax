const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const crypto = require('crypto');

const region = process.env.REGION;
const ddbClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'OPTIONS,POST',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Content-Type': 'application/json',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  try {
    const claims = event.requestContext?.authorizer?.claims;
    const senderId = claims ? claims.sub : 'anonymous';
    
    const body = JSON.parse(event.body || '{}');
    const { targetUserId } = body;

    if (!targetUserId) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'targetUserId is required' }) };
    }

    // Optional Validation: Check if the user is Actually 'Available' in ProfilesTable
    const profileRes = await ddbClient.send(new GetCommand({
      TableName: process.env.PROFILES_TABLE,
      Key: { userId: targetUserId }
    }));

    if (profileRes.Item && profileRes.Item.status === 'In a Collab') {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'This user is currently busy in a collab!', failed: true })
      };
    }

    const syncId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    await ddbClient.send(new PutCommand({
      TableName: process.env.CONNECTIONS_TABLE,
      Item: {
        syncId,
        senderId,
        targetUserId,
        status: 'REQUESTED',
        createdAt: timestamp,
        updatedAt: timestamp
      }
    }));

    // Mock Email Notification Trigger would happen here 
    console.log(`Mock Email: Sending Sync Request from ${senderId} to ${targetUserId}`);

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: true, syncId, status: 'REQUESTED' }),
    };
  } catch (error) {
    console.error('Failed to send sync request:', error);
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Internal Server Error during processing' }) };
  }
};
