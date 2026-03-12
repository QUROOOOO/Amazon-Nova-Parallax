<div align="center">
  <img src="./banner.png" alt="AWS Hackathon Banner" />
</div>

# Vibe Collab AI

<div align="center">
  <img src="./frontend/public/logo.png" alt="Vibe Collab AI Logo" width="120" />
</div>

<div align="center">
  <h3>The Preeminent 1-to-Many Content Engine for Regional Creators.</h3>
</div>

**Live Production:** [https://main.d16fcylhtesdpm.amplifyapp.com/dashboard/](https://main.d16fcylhtesdpm.amplifyapp.com/dashboard/)

<div align="center">
  <img alt="AWS" src="https://img.shields.io/badge/AWS-%23FF9900.svg?style=for-the-badge&logo=amazon-aws&logoColor=white"/>
  <img alt="React" src="https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB"/>
  <img alt="Vite" src="https://img.shields.io/badge/vite-%23646CFF.svg?style=for-the-badge&logo=vite&logoColor=white"/>
  <img alt="TypeScript" src="https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white"/>
  <img alt="Cloudinary" src="https://img.shields.io/badge/Cloudinary-3448C5?style=for-the-badge&logo=cloudinary&logoColor=white" />
  <img alt="Gemini" src="https://img.shields.io/badge/Gemini-8E75B2?style=for-the-badge&logo=googlebard&logoColor=white" />
</div>

---

## 🌍 Executive Summary

India's creator economy is exploding across Tier 2 and Tier 3 cities. Yet, regional creators face a massive bottleneck: post-production. They spend 80% of their time editing rather than creating, struggling to adapt long-form content for short-form platforms (Reels, Shorts, TikTok).

**Vibe Collab AI** is a serverless, end-to-end content engine designed to eradicate this bottleneck. We automate the entire post-production pipeline—identifying viral hooks, instantly trimming videos, and syndicating content—allowing creators to focus entirely on their craft.

## 📊 System Architecture

_Reference diagram for the Vibe Collab AI backend pipeline._

```mermaid
graph TD
    %% Define Styles tailored for a dark-mode or modern PPT slide
    classDef client fill:#1E293B,stroke:#3B82F6,stroke-width:2px,color:#fff
    classDef auth fill:#E11D48,stroke:#9F1239,stroke-width:2px,color:#fff
    classDef api fill:#F59E0B,stroke:#B45309,stroke-width:2px,color:#fff
    classDef compute fill:#F97316,stroke:#C2410C,stroke-width:2px,color:#fff
    classDef data fill:#3B48CC,stroke:#1E3A8A,stroke-width:2px,color:#fff
    classDef storage fill:#0EA5E9,stroke:#0369A1,stroke-width:2px,color:#fff
    classDef external fill:#10B981,stroke:#047857,stroke-width:2px,color:#fff
    classDef ai fill:#8B5CF6,stroke:#5B21B6,stroke-width:2px,color:#fff
    classDef yt fill:#EF4444,stroke:#B91C1C,stroke-width:2px,color:#fff

    %% 1. Client Layer
    subgraph "Client Layer"
        UI[Vite / React UI<br/>Creator Flow]:::client
    end

    %% 2. Edge & Security
    subgraph "Edge & Security"
        Auth[AWS Cognito<br/>Auth & Identity]:::auth
        Gateway[AWS API Gateway<br/>REST & Routing]:::api
    end

    %% 3. Serverless Compute Engine
    subgraph "Serverless Compute Engine (AWS Lambda)"
        direction LR
        L1[Upload & Ingestion<br/>Microservice]:::compute
        L2[AI Analysis & Hooks<br/>Microservice]:::compute
        L3[Dashboard & State<br/>Microservice]:::compute
        L4[VVRA Trends Engine<br/>Microservice]:::compute
    end

    %% 4. Data & Storage
    subgraph "Data Persistence"
        DB[(DynamoDB<br/>Profiles & Spark Data)]:::data
        S3[(Amazon S3<br/>Static Asset Storage)]:::storage
    end

    %% 5. External Intelligence & Media
    subgraph "External Intelligence & Media Pipelines"
        CDN[Cloudinary<br/>Edge Video Transform]:::external
        Gemini[Google Gemini 2.0 Flash<br/>Multimodal AI Engine]:::ai
        YouTube[YouTube Data API v3<br/>Regional Trends Feed]:::yt
    end

    %% --- Connections & Flow ---

    %% User to Edge
    UI -- "Authentication" --> Auth
    UI -- "Secure Requests" --> Gateway

    %% Edge to Compute
    Gateway --> L1
    Gateway --> L2
    Gateway --> L3
    Gateway --> L4

    %% Compute to DB/Storage
    L3 -- "Read/Write State" --> DB
    L3 -- "Fetch Assets" --> S3

    %% Compute to External Pipelines
    L1 -. "Stream Raw Video" .-> CDN
    L2 -. "Calculate Viral Timestamps" .-> Gemini
    L2 -. "Apply 'so_' & 'eo_' Crop Params" .-> CDN
    L4 -. "Fetch Regional Top 50" .-> YouTube
    L4 -. "Score Reproducibility (y-multiplier)" .-> Gemini

    %% Feedback loop
    CDN -. "Deliver 1:1 Shorts" .-> UI
```

---

## ☁️ Core Architecture & Tech Stack

| Component              | Technology                | Purpose                                                                                                          |
| :--------------------- | :------------------------ | :--------------------------------------------------------------------------------------------------------------- |
| **Frontend Framework** | React + Vite (TypeScript) | Lightning-fast HMR and optimized production builds for seamless UI/UX.                                           |
| **API Layer**          | AWS API Gateway           | Secure, scalable REST endpoints routing client requests to serverless compute.                                   |
| **Compute**            | AWS Lambda                | Serverless execution for uploading, analyzing, and matchmaking without provisioning infrastructure.              |
| **Database**           | AWS DynamoDB              | Infinite-scale, ultra-low latency NoSQL database for user profiles, state, and The Spark data.                   |
| **Storage**            | AWS S3                    | Durable, scalable object storage for static assets and raw audio files.                                          |
| **Video Engine**       | Cloudinary                | Instant video ingestion and edge CDN delivery with dynamic URL-based transformations (trimming, formatting).     |
| **AI Brain**           | Google Gemini 2.0 Flash   | Advanced multimodal inference for high-speed script analysis, semantic matchmaking, and viral hook timestamping. |
| **Authentication**     | AWS Cognito               | Enterprise-grade identity management and secure session handling.                                                |

---

## ✨ Core Pillars

### 1. Repurpose Lab (The Content Engine)

Turn one long video into multiple high-performing shorts — instantly.

> **⚠️ Demo Mode Active:** The full AI pipeline (Gemini 2.0 Flash + Cloudinary) is temporarily paused due to API quota limits during beta. The demo showcases the core client-side trim & crop engine.

- **Coming Soon Gate:** A polished "Coming Soon" banner greets users, explaining the API quota situation in a transparent, human tone. An **"Experience Demo"** CTA button smoothly animates away the banner and reveals the demo workspace.
- **Client-Side Trim & Square Crop (Demo):** Users upload any video → the first 10 seconds are extracted using the browser's native Canvas API + MediaRecorder → the video is intelligently center-cropped to a 1:1 square aspect ratio (720×720) → output is instantly previewable and downloadable.
- **Full Pipeline (Architecture):**
  - **Instant Ingestion:** Upload directly to Cloudinary CDN.
  - **AI Hook Detection:** Gemini 2.0 Flash identifies the most viral segment timestamps.
  - **Edge URL Trimming:** Cloudinary generates downloadable `.mp4` using `so_`/`eo_` URL parameters. Zero rendering time.

### 2. Smart Vault (VVRA Scoring Engine)

Data-driven trend intelligence, powered by math.

_Backend data and AI processing pipeline for the Smart Vault feature. Formatted into a stacked layout._

```mermaid
flowchart LR
    %% Increase diagram visual scale and padding
    classDef client fill:#1E293B,stroke:#3B82F6,stroke-width:2px,color:#fff,font-size:18px,padding:20px
    classDef api fill:#F59E0B,stroke:#B45309,stroke-width:2px,color:#fff,font-size:18px,padding:20px
    classDef ext fill:#EF4444,stroke:#B91C1C,stroke-width:2px,color:#fff,font-size:18px,padding:20px
    classDef math fill:#0EA5E9,stroke:#0369A1,stroke-width:2px,color:#fff,font-size:18px,padding:20px
    classDef ai fill:#8B5CF6,stroke:#5B21B6,stroke-width:2px,color:#fff,font-size:18px,padding:20px
    classDef result fill:#10B981,stroke:#047857,stroke-width:2px,color:#fff,font-size:18px,padding:20px

    %% Style the subgraphs to be bigger and spaced out
    style TOP fill:transparent,stroke:#555,stroke-width:2px,stroke-dasharray: 5 5,font-size:24px
    style BOTTOM fill:transparent,stroke:#555,stroke-width:2px,stroke-dasharray: 5 5,font-size:24px

    subgraph TOP [Phase 1: Ingestion & Parsing]
        direction LR
        A[User Opens<br/>React UI]:::client --> B[API Gateway<br/>VVRA Lambda]:::api
        B --> C[YouTube Data API<br/>Top 50 Trending]:::ext
        C --> D[Parse Metadata<br/>Views, Likes, Date]:::api
    end

    %% Invisible link to trick Mermaid into stacking the subgraphs cleanly
    TOP ~~~ BOTTOM

    subgraph BOTTOM [Phase 2: Math & AI Delivery]
        direction LR
        E[Base VVRA Score<br/>Velocity x Engage]:::math --> F[Filter Clickbait<br/>High View/Low Engage]:::math
        F --> G[Gemini 2.0 Flash<br/>Reproducibility Analysis]:::ai
        G --> H[Final Score<br/>Base x AI Multiplier]:::math
        H --> I[Frontend Renders<br/>Masonry 3D Cards]:::result
    end

    %% Connect the top row to the bottom row
    D -.-> |Data Handoff| E
```

- **Real-Time YouTube Ingestion:** Fetches the top 50 trending videos via YouTube Data API v3, extracting views, likes, comments, and publish timestamps per regional language.
- **VVRA Baseline Score:** Each video is scored using a proprietary formula that combines velocity with engagement density:
  ```
  VVRA_baseline = (views / hoursSincePublished) × ((likes + comments × 1.5) / views)
  ```
  This rewards content that is both fast-growing AND deeply engaging — filtering out clickbait with high views but low interaction.
- **Gemini γ Multiplier (Reproducibility Analysis):** The top 50 baseline results are batched to Gemini 2.0 Flash, which assigns a `reproducibility_multiplier` (0.5× to 2.0×) to each video. Solo-creator-friendly formats (commentary, tutorials, talking-head) receive 2.0×, while high-budget studio productions receive 0.5×.
  ```
  VVRA_final = VVRA_baseline × γ
  ```
- **Glowing VVRA Badge:** Each trend card displays a pulsing gradient badge showing the final VVRA score, with a separate γ chip indicating the Gemini multiplier.

### 3. The Spark

Never lose an idea.

- Distraction-free, brutalist interface for capturing raw thoughts, scripts, and mood boards.

### 4. Matchmaker

Semantic AI talent sync.

- Gemini 2.0 Flash calculates a "Synergy Score" based on a Creator's raw ideas (The Spark) matching against a network of editors, thumbnail artists, and producers.

---

## 🎨 UI/UX Philosophy: Brutalist Physics

Vibe Collab AI employs a strict "Nothing OS / Cyberpunk" design language.

| Philosophy Directive           | Implementation                                                                                                                                                     |
| :----------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Deep-Cycle Frosted Headers** | `<nav>` elements use `backdrop-filter: blur(24px)` mixed with semi-transparent blacks (`rgba(0,0,0,0.85)`). Ensures content legibility without breaking immersion. |
| **Polarized Particle Physics** | Custom `<canvas>` background (`ParticleBackground.tsx`) with highly optimized, slow-drifting nodes matching the application state (e.g., accelerating on load).    |
| **Cinematic Easing**           | Framer Motion handles all route transitions and micro-interactions. Default bezier curve: `[0.22, 1, 0.36, 1]` for aggressive snap, smooth settle.                 |
| **Space Constraints**          | Absolute ban on rounded bubbliness. Borders are sharp (1px solid `rgba(255,255,255,0.08)`), padding is strictly fixed to `--space` CSS variables.                  |

---

## 💎 Business Model (Path to $1M ARR)

| Tier       | Price / Mo | Features                                                | Target               |
| :--------- | :--------- | :------------------------------------------------------ | :------------------- |
| **Entry**  | $0         | Basic Spark notes, 3 Repurpose trims/mo, Public Vault   | New Creators         |
| **Pro**    | $12        | Unlimited AI analysis, Matchmaker access, Private Vault | Regional Influencers |
| **Agency** | $49        | API Access, Batch processing, Team collaboration        | Content Agencies     |

---

_Built originally for the AI for Bharat AWS Hackathon. All backend architecture is currently deployed and hosted serverless on AWS._
