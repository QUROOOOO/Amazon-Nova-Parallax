# Parallax | Powered by Amazon Nova

> **An AI-driven video cropping engine built exclusively for the Amazon Nova AI Hackathon.**

Parallax helps creators instantly identify the most engaging "hook" in their videos and automatically trims/crops them into perfect 1:1 squares or vertical formats for platforms like TikTok, YouTube Shorts, and Instagram Reels. 

## Features

- **Smart Hook Extraction:** Uses **Amazon Nova** (via Amazon Bedrock) to analyze your video and find the most captivating 10-second hook.
- **Client-Side Processing:** Trims and center-crops the video directly in the browser using the HTML5 Canvas API and MediaRecorder, ensuring fast and private processing.
- **Serverless Backend:** Built purely on AWS Lambda and API Gateway for maximum scalability and zero idle costs.

## Tech Stack

- **Frontend:** React, Vite, Framer Motion, Lucide Icons
- **Backend:** AWS CDK, AWS Lambda, Node.js
- **AI Engine:** Amazon Nova (Bedrock)

## Setup & Deployment

### 1. Backend (AWS CDK)
Ensure you have the AWS CLI configured with appropriate credentials.
```bash
cd backend
npm install
npx cdk bootstrap
npx cdk deploy
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```

## Hackathon Goal
This project was born today completely and strictly for the **Amazon Nova AI Hackathon** to demonstrate how accessible and powerful Amazon's new foundational models are when integrated with standard web technologies.
