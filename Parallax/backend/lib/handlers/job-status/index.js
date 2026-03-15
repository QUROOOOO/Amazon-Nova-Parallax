const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { GetCommand, UpdateCommand, DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { MediaConvertClient, GetJobCommand } = require('@aws-sdk/client-mediaconvert');

const ddbClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.REGION }));
const s3Client = new S3Client({ region: process.env.REGION });

exports.handler = async (event) => {
  console.log('JobStatus handler invoked:', JSON.stringify(event, null, 2));

  try {
    const jobId = event.queryStringParameters?.jobId;
    if (!jobId) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'jobId query parameter is required' }),
      };
    }

    // Fetch job from DynamoDB
    const result = await ddbClient.send(new GetCommand({
      TableName: process.env.JOBS_TABLE,
      Key: { jobId },
    }));

    if (!result.Item) {
      return {
        statusCode: 404,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Job not found' }),
      };
    }

    const job = result.Item;

    // If job is RENDERING, check MediaConvert status
    if (job.status === 'RENDERING' && job.mediaConvertJobId) {
      try {
        const mcClient = new MediaConvertClient({
          region: process.env.REGION,
          endpoint: job.mediaConvertEndpoint,
        });
        const mcJob = await mcClient.send(new GetJobCommand({
          Id: job.mediaConvertJobId,
        }));

        const mcStatus = mcJob.Job?.Status;
        if (mcStatus === 'COMPLETE') {
          // Generate presigned download URLs for outputs
          const processedShorts = [];
          const outputKeys = job.outputKeys || [];

          for (const key of outputKeys) {
            const downloadUrl = await getSignedUrl(
              s3Client,
              new GetObjectCommand({
                Bucket: process.env.VIDEO_BUCKET,
                Key: key,
              }),
              { expiresIn: 3600 } // 1 hour
            );
            processedShorts.push({
              key,
              downloadUrl,
              platform: key.includes('shorts') ? 'YouTube Shorts'
                : key.includes('reels') ? 'Instagram Reels'
                : 'Moj',
            });
          }

          // Update job to COMPLETE
          await ddbClient.send(new UpdateCommand({
            TableName: process.env.JOBS_TABLE,
            Key: { jobId },
            UpdateExpression: 'SET #s = :s, #stage = :stage, processedShorts = :shorts',
            ExpressionAttributeNames: { '#s': 'status', '#stage': 'stage' },
            ExpressionAttributeValues: {
              ':s': 'COMPLETE',
              ':stage': 'All variants ready!',
              ':shorts': processedShorts,
            },
          }));

          job.status = 'COMPLETE';
          job.stage = 'All variants ready!';
          job.processedShorts = processedShorts;
        } else if (mcStatus === 'ERROR') {
          await ddbClient.send(new UpdateCommand({
            TableName: process.env.JOBS_TABLE,
            Key: { jobId },
            UpdateExpression: 'SET #s = :s, #stage = :stage',
            ExpressionAttributeNames: { '#s': 'status', '#stage': 'stage' },
            ExpressionAttributeValues: {
              ':s': 'FAILED',
              ':stage': 'MediaConvert job failed',
            },
          }));
          job.status = 'FAILED';
          job.stage = 'MediaConvert job failed';
        }
      } catch (mcErr) {
        console.warn('MediaConvert status check failed (non-fatal):', mcErr.message);
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jobId: job.jobId,
        status: job.status,
        stage: job.stage,
        processedShorts: job.processedShorts || [],
        bedrockAnalysis: job.bedrockAnalysis || null,
        createdAt: job.createdAt,
      }),
    };
  } catch (error) {
    console.error('Error in JobStatus handler:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Internal Server Error during processing' }),
    };
  }
};
