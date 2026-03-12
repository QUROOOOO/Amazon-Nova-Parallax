# Design Document: Parallax AI

## Overview

Parallax AI is an AI-powered collaboration platform built to support India's Tier-2 and Tier-3 creators. It serves as an infrastructure layer that addresses operational burnout, monetization challenges, and workflow fragmentation. The platform integrates a creative research vault, a skill matchmaker, a content repurposer, and a monetization engine, all underpinned by a scalable AWS serverless architecture.

## Architecture

### High-Level Architecture

```mermaid
graph TB
    User[Creator / Student] --> Apps[Web / Mobile App (Amplify)]
    Apps --> APIGateway[Amazon API Gateway]
    APIGateway --> Lambda[AWS Lambda Functions]

    subgraph "Core Engines"
        Lambda --> ResearchVault[Smart Research Vault]
        Lambda --> Matchmaker[Skill Matchmaker]
        Lambda --> Repurposer[Trend Repurposer]
        Lambda --> Monetization[Monetization Engine]
    end

    subgraph "AI & ML Layer"
        ResearchVault --> Bedrock[Amazon Bedrock (Claude 3.5 Sonnet)]
        Matchmaker --> Bedrock
        Repurposer --> MediaProc[Media Processing (Lambda/FFmpeg)]
    end

    subgraph "Data Persistence"
        Lambda --> DynamoDB[(Amazon DynamoDB)]
        Lambda --> S3[(Amazon S3)]
    end

    subgraph "Authentication"
        Apps --> Cognito[Amazon Cognito]
    end
```

### System Components

#### 1. Smart Research Vault

**Purpose**: Generates localized content ideas, hooks, and scripts.
**Tech Stack**: AWS Lambda, Amazon Bedrock (Claude 3.5 Sonnet).
**Key Functionality**:

- Trend analysis from public data sources.
- Regional language script generation (Kannada, Tamil, Hindi).
- Context-aware hook generation.

#### 2. Skill Matchmaker

**Purpose**: Connects creators with operational support professionals.
**Tech Stack**: AWS Lambda, DynamoDB, Bedrock (for semantic matching).
**Key Functionality**:

- Semantic analysis of creator needs and provider portfolios.
- Matching based on niche, tone, and style.
- Profile management and portfolio display.

#### 3. Trend Repurposer

**Purpose**: Converts single video assets into multi-platform formats.
**Tech Stack**: AWS Lambda, S3, Media Processing Layer.
**Key Functionality**:

- Aspect ratio adjustment for different platforms (Reels, Shorts).
- Auto-generation of platform-specific captions.
- Hashtag suggestion engine.

#### 4. Monetization Quick-Start Engine

**Purpose**: Facilitates revenue generation for smaller creators.
**Tech Stack**: AWS Lambda, DynamoDB.
**Key Functionality**:

- Template generation for brand pitches.
- Affiliate deal recommendation algorithm.
- Local business outreach script generation.

#### 5. Infrastructure Layer

**Purpose**: Provides scalable, cost-effective backend services.
**Tech Stack**: AWS Serverless (Amplify, Lambda, API Gateway, Cognito, DynamoDB, S3).
**Key Functionality**:

- **Authentication**: Amazon Cognito for secure user management.
- **API Management**: Amazon API Gateway for RESTful endpoints.
- **Compute**: AWS Lambda for business logic execution.
- **Storage**: S3 for media assets, DynamoDB for structured data.
- **Cost Management**: Monitoring ensuring Free Tier compliance where possible.

## Data Models

### Creator Profile

```typescript
interface CreatorProfile {
  userId: string;
  name: string;
  niche: string[];
  languages: string[];
  platforms: string[]; // e.g., Instagram, YouTube, Moj
  goals: string[]; // e.g., Growth, Monetization
  location: {
    state: string;
    tier: string; // Tier-2, Tier-3
  };
}
```

### Content Asset

```typescript
interface ContentAsset {
  assetId: string;
  creatorId: string;
  originalUrl?: string; // S3 path
  variants: {
    platform: string;
    s3Url: string;
    status: "processing" | "ready" | "failed";
  }[];
  generatedScripts: {
    language: string;
    content: string;
    hook: string;
  }[];
}
```

### Match

```typescript
interface Match {
  matchId: string;
  creatorId: string;
  providerId: string; // Editor/Writer
  score: number; // 0-100 match confidence
  reasons: string[]; // Why they matched
  status: "pending" | "accepted" | "rejected";
}
```

## Constraints & Considerations

- **Cost Control**: Strictly monitor Bedrock token usage ($3/1K input, $15/1K output).
- **Scalability**: Design for 0-1000 initial users within AWS Free Tier limits.
- **Regional Focus**: Initial validation with a single language (e.g., Kannada).
- **UX**: Prioritize simple, WhatsApp-like interfaces for ease of use.
