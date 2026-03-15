const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { BedrockRuntimeClient, ConverseCommand } = require('@aws-sdk/client-bedrock-runtime');
const cloudinary = require('cloudinary').v2;
const { Readable } = require('stream');

// ── AWS Clients ──────────────────────────────────────────────
const s3Client = new S3Client({ region: process.env.REGION || 'us-east-1' });
const bedrockClient = new BedrockRuntimeClient({ region: 'us-east-1' }); // Nova only available in us-east-1

// ── Cloudinary Config ────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ── CORS Headers ──────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const getCorsHeaders = (origin) => {
  const allowOrigin = allowedOrigins.length
    ? (origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0])
    : '*';
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'OPTIONS,POST',
    'Vary': 'Origin',
  };
};

const buildResponse = (statusCode, bodyObj, origin) => ({
  statusCode,
  headers: getCorsHeaders(origin),
  body: JSON.stringify(bodyObj),
});

// ── Upload buffer to Cloudinary ───────────────────────────────
const uploadToCloudinary = (buffer, filename) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'video',
        folder: 'parallax/repurpose',
        public_id: `repurpose_${Date.now()}_${filename.split('.')[0]}`,
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    const readable = new Readable();
    readable._read = () => {};
    readable.push(buffer);
    readable.push(null);
    readable.pipe(uploadStream);
  });
};

// ── Lambda Handler ────────────────────────────────────────────
exports.handler = async (event) => {
  const httpMethod = event.httpMethod || event.requestContext?.http?.method || 'POST';
  const origin = event.headers?.origin || event.headers?.Origin;

  // Handle CORS preflight
  if (httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: getCorsHeaders(origin), body: '' };
  }

  if (allowedOrigins.length && origin && !allowedOrigins.includes(origin)) {
    return buildResponse(403, { error: 'Origin not allowed.' }, origin);
  }

  try {
    const rawBody = event.body || '';
    const bodySizeBytes = Buffer.byteLength(rawBody, 'utf8');
    if (bodySizeBytes > 5.5 * 1024 * 1024) {
      return buildResponse(413, { error: 'Payload too large. Use a shorter clip or lower size.' }, origin);
    }

    const body = JSON.parse(rawBody || '{}');
    const { video, filename, orientation } = body;

    if (!video || !filename) {
      return buildResponse(400, { error: 'Missing required fields: video (base64) and filename.' }, origin);
    }

    console.log(`[Amazon Nova Parallax] Processing: ${filename} | orientation: ${orientation || 'unknown'}`);

    const buffer = Buffer.from(video, 'base64');
    const bucketName = process.env.IMAGE_BUCKET;

    if (!bucketName) {
      throw new Error('IMAGE_BUCKET environment variable is not configured.');
    }

    // ── STEP 1: Upload to S3 for Bedrock analysis ─────────────
    const s3Key = `parallax/uploads/${Date.now()}_${filename}`;
    const s3Uri = `s3://${bucketName}/${s3Key}`;

    console.log(`[S3] Uploading to: ${s3Key}`);
    await s3Client.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      Body: buffer,
      ContentType: 'video/mp4',
    }));
    console.log('[S3] Upload complete.');

    // ── STEP 2: Upload to Cloudinary for transformation delivery
    console.log('[Cloudinary] Uploading for transformation...');
    const cloudinaryResult = await uploadToCloudinary(buffer, filename);
    const publicId = cloudinaryResult.public_id;
    const videoDuration = cloudinaryResult.duration || 60; // seconds
    console.log(`[Cloudinary] Uploaded: ${publicId} | duration: ${videoDuration}s`);

    // ── STEP 3: Amazon Nova Lite analyzes video via Bedrock ────
    // Clamp target range: min 8s, max 59s (platform constraint for Shorts/Reels)
    const MIN_CLIP = 8;
    const MAX_CLIP = 59;

    const systemPrompt = `You are an elite short-form video editor optimizing for retention on YouTube Shorts and Instagram Reels.
Your goal is to select ONE continuous clip that maximizes viewer engagement.
Ranked criteria:
1) Strong hook in the first 1-2 seconds of the chosen clip.
2) High motion/visual change, emotion, or surprise.
3) Clear context without awkward cuts; avoid intros/outros and dead air.
4) Natural ending with a clean cutoff.
The clip MUST be between ${MIN_CLIP} and ${MAX_CLIP} seconds.
Return ONLY raw JSON (no markdown, no extra text): {"start_offset_seconds": number, "end_offset_seconds": number, "hook_description": "string"}`;

    const converseParams = {
      modelId: 'amazon.nova-lite-v1:0',
      messages: [
        {
          role: 'user',
          content: [
            {
              video: {
                format: 'mp4',
                source: {
                  s3Location: {
                    uri: s3Uri,
                    bucketOwner: process.env.ACCOUNT_ID,
                  },
                },
              },
            },
            {
              text: `Analyze the full video and choose the single best clip for short-form engagement. Video duration: ${videoDuration} seconds. Return timestamps in seconds with 0.1s precision.`,
            },
          ],
        },
      ],
      system: [{ text: systemPrompt }],
      inferenceConfig: {
        maxTokens: 256,
        temperature: 0.1, // Low temperature for deterministic JSON output
      },
    };

    console.log('[Bedrock] Calling Amazon Nova Lite...');
    const bedrockResponse = await bedrockClient.send(new ConverseCommand(converseParams));
    const rawText = bedrockResponse.output?.message?.content?.[0]?.text || '';
    console.log('[Bedrock] Nova response:', rawText);

    // ── STEP 4: Parse and validate Nova's JSON response ────────
    let aiResult;
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      aiResult = JSON.parse(jsonMatch ? jsonMatch[0] : rawText.trim());
    } catch {
      throw new Error(`Amazon Nova returned unparseable response: ${rawText.slice(0, 200)}`);
    }

    let start = parseFloat(aiResult.start_offset_seconds) || 0;
    let end = parseFloat(aiResult.end_offset_seconds) || (start + 30);
    const hookDescription = aiResult.hook_description || 'AI-selected viral moment';

    // Clamp to valid clip range
    start = Math.max(0, Math.min(start, videoDuration - MIN_CLIP));
    end = Math.min(end, videoDuration);
    const clipDuration = end - start;

    // Enforce min/max clip length
    if (clipDuration < MIN_CLIP) {
      end = Math.min(start + MIN_CLIP, videoDuration);
    }
    if (end - start > MAX_CLIP) {
      end = start + MAX_CLIP;
    }

    console.log(`[Nova] Clip: ${start.toFixed(1)}s → ${end.toFixed(1)}s (${(end - start).toFixed(1)}s) | "${hookDescription}"`);

    // ── STEP 5: Build Cloudinary transformation URL ─────────────
    // - Horizontal (16:9 landscape): crop to 1:1 square with smart subject detection
    // - Vertical/square: trim only, preserve native format
    let transformations = `so_${start.toFixed(2)},eo_${end.toFixed(2)}`;

    if (orientation === 'horizontal') {
      // Crop to 1:1, auto-track subject so the subject stays centered
      transformations += `,c_fill,ar_1:1,g_auto:subject`;
    }
    // Vertical/square videos: no crop needed, native format preserved

    const finalUrl = cloudinary.url(publicId, {
      resource_type: 'video',
      raw_transformation: transformations,
      secure: true,
    });

    console.log(`[Cloudinary] Final URL built: ${finalUrl}`);

    return buildResponse(200, {
      finalUrl,
      clipMeta: {
        startSeconds: parseFloat(start.toFixed(2)),
        endSeconds: parseFloat(end.toFixed(2)),
        durationSeconds: parseFloat((end - start).toFixed(2)),
        hookDescription,
        orientation,
        croppedToSquare: orientation === 'horizontal',
      },
    }, origin);

  } catch (error) {
    console.error('[Amazon Nova Parallax] Processing error:', error);
    return buildResponse(500, {
      error: error.message || 'Video processing failed.',
    }, origin);
  }
};
