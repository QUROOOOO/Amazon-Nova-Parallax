# Requirements Document: Parallax AI

## Introduction

Parallax AI is an AI-powered collaboration platform designed specifically for India’s Tier-2 and Tier-3 creators, regional language influencers, student creators, and content teams. It aims to solve operational burnout, poor monetization, and fragmented workflows by providing a scalable, cost-efficient infrastructure layer. The platform addresses the needs of over 2.5 million serious creators in India, helping them overcome unstable income and ecosystem exit risks.

## Glossary

- **Vibe_Collab_System**: The complete AI-powered collaboration platform.
- **Smart_Research_Vault**: Component using Amazon Bedrock for trend analysis and script generation.
- **Skill_Matchmaker**: Semantic AI matching engine for connecting creators with professionals.
- **Trend_Repurposer**: Tool for converting single videos into multiple platform variants.
- **Monetization_Engine**: Engine for generating brand pitches and identifying revenue opportunities.
- **Creator_User**: The primary user (influencer, student, content creator).
- **Service_Provider**: Editors, scriptwriters, and artists offering services.
- **AWS_Bedrock**: Amazon's service for generative AI models (Claude 3.5 Sonnet).
- **AWS_Serverless**: The underlying infrastructure (Amplify, Lambda, API Gateway, DynamoDB, S3).

## Requirements

### Requirement 1: Smart Research Vault

**User Story:** As a regional creator, I want to generate localized content ideas and scripts, so that I can stay relevant without spending hours on research.

#### Acceptance Criteria

1. THE Smart_Research_Vault SHALL use Amazon Bedrock (Claude 3.5 Sonnet) to analyze public trends.
2. THE System SHALL generate scripts and hooks in regional languages (Kannada, Tamil, Hindi).
3. THE System SHALL monitor bedrock token usage to stay within budget ($3/1K input, $15/1K output).
4. THE System SHALL allow users to save and organize generated ideas.

### Requirement 2: Skill Matchmaker

**User Story:** As a creator, I want to find editors or scriptwriters who match my specific style and niche, so that I can collaborate effectively.

#### Acceptance Criteria

1. THE Skill_Matchmaker SHALL use semantic AI matching to connect creators with service providers.
2. THE matching algorithm SHALL consider niche, tone, and creative style.
3. THE System SHALL allow users to view profiles and portfolios of matched professionals.
4. THE System SHALL facilitate initial connection between parties (e.g., via WhatsApp integration).

### Requirement 3: Trend Repurposer

**User Story:** As a content creator, I want to easily convert my video into different formats for various platforms, so that I can maximize my reach with minimal effort.

#### Acceptance Criteria

1. THE Trend_Repurposer SHALL accept a single short-form video input.
2. THE System SHALL generate platform-specific variants (Reels, Shorts, Moj) with tailored aspect ratios.
3. THE System SHALL generate platform-specific captions and auto-suggested hashtags.
4. THE System SHALL support bulk download or direct publishing (future scope) of variants.

### Requirement 4: Monetization Quick-Start

**User Story:** As a student creator, I want simplified ways to pitch to brands and find affiliate deals, so that I can start earning even with a smaller following.

#### Acceptance Criteria

1. THE Monetization_Engine SHALL minimize barriers to entry for new creators.
2. THE System SHALL provide pre-written, customizable brand pitch templates.
3. THE System SHALL suggest relevant affiliate deals based on the creator's niche.
4. THE System SHALL generate local business outreach scripts.

### Requirement 5: Bharat-First UX & Accessibility

**User Story:** As a non-English speaking creator, I want an interface that feels native and easy to use, so that I can navigate the platform without language barriers.

#### Acceptance Criteria

1. THE System SHALL provide a mobile-first, WhatsApp-centric user experience.
2. THE UI SHALL support localization in the initial target language (e.g., Kannada).
3. THE System SHALL handle 0–1000 users within AWS Free Tier limits where possible.

### Requirement 6: Infrastructure & Scalability

**User Story:** As a developer, I want a serverless architecture, so that the platform can scale automatically while keeping costs low.

#### Acceptance Criteria

1. THE System SHALL be built on AWS Serverless stack (Amplify, Lambda, API Gateway, Cognito, DynamoDB, S3).
2. THE System SHALL use Amazon Bedrock for all generative AI tasks.
3. THE System SHALL implement monitoring for API usage and costs.
4. Voice-to-text features (optional) SHALL utilize AWS Transcribe if enabled.
