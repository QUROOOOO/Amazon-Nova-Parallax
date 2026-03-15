const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const crypto = require('crypto');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
  console.log('Received event:', JSON.stringify(event, null, 2));

  try {
    // 1. Verify Authorization (Assuming Cognito Integration passes claims)
    const claims = event.requestContext?.authorizer?.claims;
    const userId = claims ? claims.sub : 'anonymous-user-for-testing'; // Fallback for local testing if needed

    if (event.httpMethod === 'GET') {
      // Handle GET: Fetch user's saved notes
      const command = new QueryCommand({
        TableName: process.env.CONTENT_TABLE,
        IndexName: 'UserContentIndex',
        KeyConditionExpression: 'userId = :u',
        ExpressionAttributeValues: {
          ':u': userId
        },
        ScanIndexForward: false // Sort descending by createdAt
      });

      const response = await docClient.send(command);

      return {
        statusCode: 200,
        headers: { 
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          data: response.Items || []
        }),
      };
    } else if (event.httpMethod === 'POST') {
      // 2. Parse Body
      const body = JSON.parse(event.body || '{}');
      const { idea, isAudio = false, title, contentId: existingContentId, createdAt: existingCreatedAt } = body;

      if (!idea) {
        return {
          statusCode: 400,
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ error: 'Idea content is required' }),
        };
      }

      // 3. Construct Item
      const contentId = existingContentId || `idea_${crypto.randomUUID()}`;
      const timestamp = existingCreatedAt || new Date().toISOString();

      const item = {
        contentId,
        userId,
        type: 'spark_idea',
        title: title || '',
        content: idea,
        isAudio,
        createdAt: timestamp,
        status: 'pending_processing', // Future hook for background Bedrock processing
      };

      // 4. Save to DynamoDB
      const command = new PutCommand({
        TableName: process.env.CONTENT_TABLE,
        Item: item,
      });

      await docClient.send(command);

      // 5. Return Success
      return {
        statusCode: 201,
        headers: { 
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: 'Idea saved successfully',
          data: item,
        }),
      };
    } else if (event.httpMethod === 'DELETE') {
      const body = JSON.parse(event.body || '{}');
      const { contentId } = body;

      if (!contentId) {
        return {
          statusCode: 400,
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ error: 'contentId is required for deletion' }),
        };
      }

      const command = new DeleteCommand({
        TableName: process.env.CONTENT_TABLE,
        Key: {
          contentId: contentId,
          userId: userId // Sort key
        }
      });

      await docClient.send(command);

      return {
        statusCode: 200,
        headers: { 
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: 'Idea deleted successfully' }),
      };
    } else {
      return {
        statusCode: 405,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Method Not Allowed' }),
      };
    }

  } catch (error) {
    console.error('Error saving idea:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Failed to save idea' }),
    };
  }
};
