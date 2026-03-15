const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');

const s3Client = new S3Client({ region: process.env.REGION });

exports.handler = async (event) => {
  console.log('Received Upload Event:', JSON.stringify(event, null, 2));

  try {
    // 1. Get user identity from Cognito (fallback for local dev)
    const claims = event.requestContext?.authorizer?.claims;
    const userId = claims ? claims.sub : 'anonymous-creator';

    // 2. Parse request body for file info
    const body = JSON.parse(event.body || '{}');
    const { contentType = 'image/jpeg', filename = 'image.jpg', uploadType = 'note' } = body;

    // 3. Generate a secure, unique S3 object key
    const extension = filename.split('.').pop() || 'tmp';
    const uniqueId = crypto.randomUUID();
    
    let objectKey;
    if (uploadType === 'portfolio') {
      objectKey = `portfolios/${userId}/${uniqueId}.${extension}`;
    } else {
      objectKey = `note-images/${userId}/${uniqueId}.${extension}`;
    }

    // 4. Create the Presigned URL command
    const command = new PutObjectCommand({
      Bucket: process.env.IMAGE_BUCKET,
      Key: objectKey,
      ContentType: contentType,
    });

    // 5. Generate the URL (expires in 5 minutes)
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

    // 6. Provide the final public URL where the image will be accessible
    const publicUrl = `https://${process.env.IMAGE_BUCKET}.s3.${process.env.REGION}.amazonaws.com/${objectKey}`;

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uploadUrl,
        publicUrl,
        objectKey
      }),
    };
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Internal Server Error during processing' }),
    };
  }
};
