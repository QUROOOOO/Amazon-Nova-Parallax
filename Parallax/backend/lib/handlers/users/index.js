const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.REGION });
const docClient = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
  const method = event.httpMethod;

  try {
    // Both endpoints require auth, extract user ID from Cognito token
    const userId = event.requestContext?.authorizer?.claims?.sub;
    if (!userId) {
      return { statusCode: 401, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'Unauthorized. Missing Cognito token.' }) };
    }

    if (method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const { name, roles, platforms, customRole, customPlatform, phone, bio, upiId, notifications } = body;

      // Upsert profile in DynamoDB
      const timestamp = new Date().toISOString();
      const userItem = {
        userId,
        name: name || 'Anonymous',
        roles: roles || [],
        platforms: platforms || [],
        customRole: customRole || null,
        customPlatform: customPlatform || null,
        phone: phone || null,
        bio: bio || '',
        upiId: upiId || null,
        notifications: notifications || { collabRequests: true, brandDeals: true, productUpdates: false },
        updatedAt: timestamp,
        createdAt: timestamp,
      };

      await docClient.send(new PutCommand({
        TableName: process.env.USERS_TABLE,
        Item: userItem,
      }));

      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: 'Profile saved successfully', user: userItem }),
      };
    } 
    
    else if (method === 'PUT') {
      // Partial update — only update the fields provided
      const body = JSON.parse(event.body || '{}');
      const timestamp = new Date().toISOString();
      
      // Build dynamic update expression
      const expressionParts = [];
      const expressionNames = {};
      const expressionValues = { ':updatedAt': timestamp };
      
      const allowedFields = ['name', 'bio', 'upiId', 'notifications', 'roles', 'platforms', 'customRole', 'customPlatform', 'phone'];
      
      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          expressionParts.push(`#${field} = :${field}`);
          expressionNames[`#${field}`] = field;
          expressionValues[`:${field}`] = body[field];
        }
      }
      
      expressionParts.push('#updatedAt = :updatedAt');
      expressionNames['#updatedAt'] = 'updatedAt';
      
      if (expressionParts.length === 1) {
        // Only updatedAt, nothing to update
        return {
          statusCode: 400,
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ error: 'No fields to update' }),
        };
      }

      const result = await docClient.send(new UpdateCommand({
        TableName: process.env.USERS_TABLE,
        Key: { userId },
        UpdateExpression: `SET ${expressionParts.join(', ')}`,
        ExpressionAttributeNames: expressionNames,
        ExpressionAttributeValues: expressionValues,
        ReturnValues: 'ALL_NEW',
      }));

      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: 'Profile updated successfully', user: result.Attributes }),
      };
    }
    
    else if (method === 'GET') {
      const response = await docClient.send(new GetCommand({
        TableName: process.env.USERS_TABLE,
        Key: { userId },
      }));

      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ user: response.Item || null }),
      };
    }

    return { statusCode: 405, headers: { 'Access-Control-Allow-Origin': '*' }, body: 'Method Not Allowed' };

  } catch (error) {
    console.error('Users Lambda Error:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Internal Server Error during processing' }),
    };
  }
};
