# Parallax

One video, ten platforms, zero manual editing — AI-first repurposing powered by Amazon Nova.

Built for the **Amazon Nova AI Hackathon** · Amazon Nova Lite (Bedrock) · AWS Lambda/CDK · React + Vite + TypeScript · Cloudinary · FFmpeg WASM.

![Project Demo](Parallax/docs/demo.gif)

---

# Quick Overview

**Problem** Creators spend hours clipping and reformatting every video for Shorts/Reels, with guesswork on which moments will retain viewers.  
**Solution** Parallax lets creators upload once; Amazon Nova watches the video, finds the most engaging 8–59s segment, and returns a platform-ready clip with smart crops.  
**Impact** Cuts repurposing time from ~4–8 hours to under 2 minutes while increasing hook quality through frame-level AI analysis.

---

# Demo

**Live Demo** https://main.d16fcylhtesdpm.amplifyapp.com  
**Video Demo** *(Link to recorded walkthrough)*  

**Screenshots**  
![Main Interface](Parallax/docs/interface.png)  
![AI Feature](Parallax/docs/ai-feature.png)  
![Results Dashboard](Parallax/docs/results.png)

---

# Problem

- 50M+ independent creators need to publish to YouTube Shorts, Instagram Reels, TikTok, and LinkedIn with different aspect ratios and time limits.  
- Manual timeline scrubbing, clipping, and cropping takes 4–8 hours per long-form video.  
- Audio-only AI misses visual hooks (gestures, fast cuts), so current “auto-clip” tools feel random.  
- Desktop editors and template apps still require human intuition and repetitive exports.

---

# Solution

- **Core idea**: Use Amazon Nova Lite to *watch* the video, pick the strongest hook, and deliver a trimmed, cropped clip ready for social.  
- **Workflow**: Local FFmpeg WASM compresses in-browser → S3 + Cloudinary ingest → Nova Lite inference → Cloudinary URL with precise `start`/`end` → user downloads immediately.  
- **System behavior**: Keeps vertical videos vertical, auto-crops horizontal to square for Shorts/Reels, and returns Nova’s hook description alongside timestamps.

---

# Key Features

- Amazon Nova frame-level hook detection with structured JSON (`start_offset_seconds`, `end_offset_seconds`, `hook_description`).  
- Smart clip extraction (8–59 seconds) optimized for short-form retention.  
- Intelligent crop logic: 16:9 → 1:1 square; preserves native vertical formats.  
- Real-time FFmpeg WASM compression with progress feedback before upload.  
- Cloud-native pipeline using Lambda Function URL + S3 + Cloudinary CDN for instant playback.  
- Spark Notes: rich-text idea pad backed by DynamoDB.  
- Smart Vault: YouTube trend radar with VVRA scoring.  
- Skill Matchmaker: Gemini-powered collaboration scoring.  
- Cognito email OTP auth with dark/light UI.

---

# Architecture

![Architecture Diagram](Parallax/docs/architecture.png)

User → React/Vite frontend → Lambda Function URL (video ingest) → S3 + Cloudinary → Amazon Nova Lite (Bedrock Converse API) → Cloudinary transformation URL → Frontend preview/download → DynamoDB for notes/jobs.

- **Frontend** handles upload, local compression, preview, and UX.  
- **Lambda** orchestrates ingest, Nova call, and Cloudinary URL assembly.  
- **Amazon Nova Lite** provides timestamps + hook description.  
- **Cloudinary** performs serverless trim/crop and delivers CDN media.  
- **DynamoDB** stores notes, jobs, and trend data.

---

# Tech Stack

**Frontend**  
- React 18, TypeScript, Vite, Framer Motion, AWS Amplify JS, @ffmpeg/ffmpeg (WASM)  

**Backend**  
- AWS Lambda (Node.js 20), Amazon API Gateway, AWS CDK (TypeScript), S3, DynamoDB, MediaConvert, Amazon Transcribe, AWS Cognito  

**AI / Machine Learning**  
- Amazon Nova Lite v1 via AWS Bedrock ConverseCommand  
- Google Gemini 1.5 Flash (trend scoring and collaboration matching)  

**Cloud Infrastructure**  
- AWS CDK-deployed stacks, Lambda Function URLs, Amplify hosting, CloudWatch, IAM  

**Other Tools**  
- Cloudinary for video transformation/CDN, YouTube Data API v3

---

# Amazon Nova Integration

- **Tasks**: Nova Lite watches the uploaded video frames to locate the single most engaging segment and returns JSON with precise start/end offsets plus a hook description.  
- **Why it matters**: Frame-level understanding captures visual hooks that transcript-based models miss, making clips consistently watchable.  
- **Interaction pattern**: Frontend uploads → Lambda sends S3 URI to Bedrock → Nova Lite responds → Lambda builds Cloudinary trim URL → Frontend streams the result.

**Workflow through Nova**

`Browser upload → S3 URI → Bedrock ConverseCommand (amazon.nova-lite-v1:0) → JSON offsets → Cloudinary trim/crop → CDN URL → User preview/download`

---


## Environment variables

Key values (see `.env.example` for full list):
- `VITE_API_ENDPOINT`, `VITE_ANALYZE_FUNCTION_URL`, `VITE_USER_POOL_ID`, `VITE_USER_POOL_CLIENT_ID`, `VITE_IMAGE_BUCKET`, `VITE_CLOUDINARY_CLOUD_NAME`, `VITE_GEMINI_API_KEY`
- `YOUTUBE_API_KEY`, `GEMINI_API_KEY`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `REGION` (must be `us-east-1`)

## Run locally
- Start backend (after deploy): services run on AWS; use the deployed API endpoints.  
- Start frontend: `npm run dev` in `frontend` and open the provided localhost URL.

---

# Usage

1. Launch the frontend (local dev or Amplify URL) and sign up via email OTP.  
2. Upload or drag a video (MP4/MOV/WebM, ≤50MB, ≤3 minutes).  
3. Click **Analyze & Repurpose** to trigger Nova Lite and Cloudinary trimming.  
4. Preview Nova’s chosen clip with timestamps and download the ready-to-post file.  

---

# Project Structure

```
Parallax/
├── frontend/            # React + Vite app, UI, FFmpeg WASM, Auth
├── backend/             # AWS CDK stacks + Lambda handlers (Nova, trends, notes)
├── docs/                # Diagrams and README assets
├── screenshots/         # UI captures for submission
├── stack_outputs.json   # CDK/stack output references
└── README.md
```

---

# Example Outputs

![Example Output](Parallax/docs/output.png)

- Horizontal 16:9 input → 23s square clip, auto-cropped around the detected subject.  
- Vertical 9:16 input → 34s native vertical clip, preserved without cropping.  
- Nova hook description displayed with the returned timestamps for quick context.

---

# Future Improvements

- Multi-clip generation (top 3 hooks) with parallel Nova calls.  
- Burned-in captions via Transcribe + MediaConvert.  
- Platform-specific presets (9:16 TikTok, 4:5 Instagram, 1:1 LinkedIn).  
- Batch channel processing and scheduled jobs.  
- Analytics dashboard to track post-publish performance.  
- Upgrade path to Amazon Nova Pro for complex multi-speaker videos.

---

# Team

- Archak Aryan — Full Stack & AI Integration

---

# Acknowledgements

- Amazon Nova AI Hackathon team and mentors.  
- AWS Bedrock, Lambda, API Gateway, Cognito, DynamoDB, MediaConvert.  
- Cloudinary, FFmpeg WASM, YouTube Data API, Google Gemini.

---

# License

MIT
