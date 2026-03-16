const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const cloudinary = require('cloudinary').v2;
const { Readable } = require('stream');

// ── AWS Clients ──────────────────────────────────────────────
const s3Client = new S3Client({ region: process.env.REGION || 'us-east-1' });

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
        folder: 'parallax/lab',
        public_id: `parallax_${Date.now()}_${filename.split('.')[0]}`,
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

    // ── STEP 3: Demo Mode fallback (hardcoded timestamps) ──────
    const safeDuration = Number.isFinite(videoDuration) ? videoDuration : 10;
    const start = 0;
    const end = Math.min(10, Math.max(1, safeDuration));
    const hookDescription = 'Demo mode (first 10s)';

    console.log(`[Demo] Clip: ${start.toFixed(1)}s → ${end.toFixed(1)}s (${(end - start).toFixed(1)}s)`);

    // ── STEP 4: Build Cloudinary transformation URL ─────────────
    // Demo mode: always crop to 1:1 with auto subject tracking for first 10 seconds
    const transformations = `so_${start.toFixed(2)},eo_${end.toFixed(2)},c_fill,ar_1:1,g_auto`;

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
        croppedToSquare: true,
      },
    }, origin);

  } catch (error) {
    console.error('[Amazon Nova Parallax] Processing error:', error);
    return buildResponse(500, {
      error: error.message || 'Video processing failed.',
    }, origin);
  }
};
