const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { PutCommand, DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
const crypto = require('crypto');

const s3Client = new S3Client({ region: process.env.REGION });
const ddbClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.REGION }));

exports.handler = async (event) => {
  console.log('VideoUpload handler invoked:', JSON.stringify(event, null, 2));

  try {
    const claims = event.requestContext?.authorizer?.claims;
    const userId = claims ? claims.sub : 'anonymous-creator';

    const body = JSON.parse(event.body || '{}');
    const { contentType = 'video/mp4', filename = 'video.mp4' } = body;

    const extension = filename.split('.').pop() || 'mp4';
    const jobId = crypto.randomUUID();
    const objectKey = `uploads/${userId}/${jobId}.${extension}`;

    // Generate Presigned PUT URL (15 min expiry for large files)
    const command = new PutObjectCommand({
      Bucket: process.env.VIDEO_BUCKET,
      Key: objectKey,
      ContentType: contentType,
    });
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });

    // Create job record in DynamoDB
    await ddbClient.send(new PutCommand({
      TableName: process.env.JOBS_TABLE,
      Item: {
        jobId,
        userId,
        status: 'PENDING',
        stage: 'Waiting for upload...',
        sourceKey: objectKey,
        filename,
        processedShorts: [],
        createdAt: new Date().toISOString(),
      },
    }));

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uploadUrl, jobId, objectKey }),
    };
  } catch (error) {
    console.error('Error in VideoUpload handler:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Internal Server Error during processing' }),
    };
  }
};
