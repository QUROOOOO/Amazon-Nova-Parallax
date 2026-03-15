const { S3Client } = require("@aws-sdk/client-s3");
const { Upload } = require("@aws-sdk/lib-storage");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { PutCommand, UpdateCommand, DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");
const https = require("https");
const crypto = require("crypto");

const region = process.env.REGION;
const s3Client = new S3Client({ region });
const ddbClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));

// Standard CORS headers
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Content-Type": "application/json",
};

// Standard helper to extract YouTube ID
function extractYouTubeId(url) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

// Enterprise Media Proxy Service caller
function fetchRapidApiStreamUrl(videoId) {
  return new Promise((resolve, reject) => {
    const options = {
      method: "GET",
      hostname: "youtube-media-downloader.p.rapidapi.com",
      path: `/v2/video/details?videoId=${videoId}`,
      headers: {
        "x-rapidapi-key": process.env.RAPIDAPI_KEY || '', // ensure key comes from environment and never hardcoded
        "x-rapidapi-host": "youtube-media-downloader.p.rapidapi.com"
      }
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on("data", chunk => chunks.push(chunk));
      res.on("end", () => {
        try {
          const rawString = Buffer.concat(chunks).toString();
          console.log("[RapidAPI Raw JSON First 200 chars]:", rawString.substring(0, 200));
          const data = JSON.parse(rawString);
          
          if (data.message) {
            reject(new Error(`RapidAPI Access Error: ${data.message}`));
            return;
          }

          const videoObj = data.videos?.items?.find(v => v.extension === 'mp4') || data.videos?.items?.[0] || data;
          const streamUrl = videoObj.url || videoObj.link;
          
          if (!streamUrl) {
            reject(new Error("RapidAPI returned invalid schema. Key missing 'url' property."));
          } else {
            resolve(streamUrl);
          }
        } catch (e) {
          reject(new Error(`Failed to parse RapidAPI JSON: ${e.message}`));
        }
      });
    });
    
    req.on("error", (err) => reject(new Error(`RapidAPI HTTPS Request Failed: ${err.message}`)));
    req.end();
  });
}

function fetchVideoStream(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        resolve(res);
      } else if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Handle stream redirects
        https.get(res.headers.location, (redirectRes) => {
           if (redirectRes.statusCode >= 200 && redirectRes.statusCode < 300) {
              resolve(redirectRes);
           } else {
              reject(new Error(`Redirect target returned HTTP ${redirectRes.statusCode}`));
           }
        }).on("error", reject);
      } else {
        reject(new Error(`Stream server returned HTTP ${res.statusCode}`));
      }
    });
    req.on("error", reject);
  });
}

exports.handler = async (event) => {
  console.log("Enterprise Ingestion Handler Invoked");

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  }

  let jobId = null;
  const updateStage = async (jId, stat, stageText) => {
    console.log(`[STATUS] ${stat} | [STAGE] ${stageText}`);
    try {
      await ddbClient.send(
        new UpdateCommand({
          TableName: process.env.JOBS_TABLE,
          Key: { jobId: jId },
          UpdateExpression: "SET #st = :s, stage = :stage, updatedAt = :u",
          ExpressionAttributeNames: { "#st": "status" },
          ExpressionAttributeValues: {
            ":s": stat,
            ":stage": stageText,
            ":u": new Date().toISOString(),
          },
        })
      );
    } catch (e) {
      console.error("DynamoDB update error:", e);
    }
  };

  try {
    const claims = event.requestContext?.authorizer?.claims;
    const userId = claims ? claims.sub : "anonymous-creator";
    const body = JSON.parse(event.body || "{}");
    const { url } = body;

    if (!url) return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "URL is required" }) };
    
    jobId = crypto.randomUUID();
    const objectKey = `uploads/${userId}/${jobId}.mp4`;
    let streamUrl = url;

    // 1. Log Job Initialization
    await ddbClient.send(
      new PutCommand({
        TableName: process.env.JOBS_TABLE,
        Item: {
          jobId, userId,
          status: "INGESTING",
          stage: "Validating URL...",
          sourceKey: objectKey,
          sourceUrl: url,
          filename: "video.mp4",
          processedShorts: [],
          createdAt: new Date().toISOString(),
        },
      })
    );

    // 2. Routing Logic (YouTube via RapidAPI Proxies vs Direct MP4 URL)
    const ytid = extractYouTubeId(url);
    if (ytid) {
      await updateStage(jobId, "INGESTING", "Federating stream resolution via RapidAPI proxy networks...");
      try {
        streamUrl = await fetchRapidApiStreamUrl(ytid);
        console.log("RapidAPI securely resolved direct CDN stream.");
      } catch (proxyErr) {
        console.error("RapidAPI Error:", proxyErr);
        await updateStage(jobId, "FAILED", "Proxy server rejected resolution.");
        return {
          statusCode: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify({ failed: true, error: "Enterprise Proxy Failed", statusCode: 502, jobId })
        };
      }
    }

    // 3. Initiate Stream Transfer to Amazon S3
    await updateStage(jobId, "INGESTING", "Streaming media bytes directly to AWS S3 Data Lake...");
    const passthroughStream = await fetchVideoStream(streamUrl);

    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: process.env.VIDEO_BUCKET,
        Key: objectKey,
        Body: passthroughStream,
        ContentType: "video/mp4",
      },
    });

    upload.on("httpUploadProgress", (progress) => {
      console.log(`Pumping bytes to S3: ${progress.loaded} uploaded`);
    });

    await upload.done();
    console.log("S3 Upload complete. ObjectKey:", objectKey);
    await updateStage(jobId, "TRANSCRIBING", "Ingestion complete. Queuing AWS Elemental MediaConvert...");

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        message: "Ingestion accepted via Enterprise Proxy. Pipeline triggered.",
        jobId,
        objectKey,
      }),
    };

  } catch (err) {
    console.error("Fatal ingestion error:", err);
    if (jobId) await updateStage(jobId, "FAILED", `System failure: ${err.message}`);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Internal Server Error during processing' }),
    };
  }
};
