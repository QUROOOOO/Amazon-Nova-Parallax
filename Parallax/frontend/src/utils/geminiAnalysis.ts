import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

export interface ClipResult {
  title: string;
  startTime: string;   // "MM:SS"
  endTime: string;     // "MM:SS"
  script: string;
  reason: string;
}

export interface SynergyResult {
  score: number;
  reasoning: string;
}

/**
 * Fetch transcript from a YouTube video.
 * Routes through Vite dev proxy to bypass CORS restrictions.
 * Falls back through multiple strategies for maximum reliability.
 */
export async function fetchYouTubeTranscript(url: string): Promise<string> {
  // Extract video ID — supports watch, youtu.be, embed, shorts formats
  const match = url.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([a-zA-Z0-9_-]{11})/);
  if (!match) throw new Error('Invalid YouTube URL. Please paste a valid youtube.com or youtu.be link.');
  const videoId = match[1];

  // Helper to decode HTML entities in caption XML
  const decodeEntities = (text: string) =>
    text.replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\n/g, ' ');

  // Helper to extract text from caption XML
  const parseXmlCaptions = (xml: string): string => {
    const texts = xml.match(/<text[^>]*>([\s\S]*?)<\/text>/g) || [];
    return texts.map(t => decodeEntities(t)).join(' ').trim();
  };

  // Strategy 1: Lemnoslife caption API (via Vite proxy)
  try {
    const res = await fetch(`/api/transcript-proxy/lemnoslife/noKey/captions?part=snippet&videoId=${videoId}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.items) {
        for (const item of data.items) {
          const baseUrl = item?.snippet?.baseUrl;
          if (baseUrl) {
            // The baseUrl points to youtube.com/api/timedtext — proxy it
            const timedtextPath = baseUrl.replace('https://www.youtube.com', '');
            const capRes = await fetch(`/api/transcript-proxy/timedtext${timedtextPath}`, {
              signal: AbortSignal.timeout(8000),
            });
            if (capRes.ok) {
              const xml = await capRes.text();
              const transcript = parseXmlCaptions(xml);
              if (transcript.length > 50) return transcript;
            }
          }
        }
      }
    }
  } catch {
    // Fall through to next strategy
  }

  // Strategy 2: Fetch YouTube page HTML (via proxy) and extract caption tracks
  try {
    const pageRes = await fetch(`/api/transcript-proxy/youtube/watch?v=${videoId}`, {
      signal: AbortSignal.timeout(12000),
    });
    if (pageRes.ok) {
      const html = await pageRes.text();
      // Extract captionTracks JSON from ytInitialPlayerResponse
      const captionMatch = html.match(/"captionTracks":\s*(\[.*?\])/);
      if (captionMatch) {
        const tracks = JSON.parse(captionMatch[1]);
        if (tracks.length > 0) {
          // Use the first available track (usually auto-generated)
          const trackUrl: string = tracks[0].baseUrl;
          const timedtextPath = trackUrl.replace('https://www.youtube.com', '');
          const capRes = await fetch(`/api/transcript-proxy/timedtext${timedtextPath}`, {
            signal: AbortSignal.timeout(8000),
          });
          if (capRes.ok) {
            const xml = await capRes.text();
            const transcript = parseXmlCaptions(xml);
            if (transcript.length > 50) return transcript;
          }
        }
      }
    }
  } catch {
    // Fall through
  }

  throw new Error('Transcript not available for this video. It may have captions disabled, or the video may be private/age-restricted.');
}

/**
 * Send transcript to Gemini for viral clip analysis.
 */
export async function analyzeWithGemini(transcript: string): Promise<ClipResult> {
  if (!GEMINI_KEY) {
    throw new Error('Gemini API key not configured. Add VITE_GEMINI_API_KEY to your .env file.');
  }

  const genAI = new GoogleGenerativeAI(GEMINI_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const prompt = `You are a viral content analyst for Indian social media creators.
Analyze the following YouTube video transcript and identify THE SINGLE BEST viral clip segment.

For the clip, provide:
1. title — A catchy, viral hook title (max 10 words)
2. startTime — Start timecode in "MM:SS" format
3. endTime — End timecode in "MM:SS" format (clip should be 30-60 seconds)
4. script — The exact transcript text for this segment
5. reason — Why this segment will go viral (1 sentence)

Transcript:
${transcript.slice(0, 8000)}

Respond ONLY with valid JSON, no markdown, no code blocks:
{"title": "...", "startTime": "MM:SS", "endTime": "MM:SS", "script": "...", "reason": "..."}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  // Clean and parse
  const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
  try {
    return JSON.parse(cleaned) as ClipResult;
  } catch {
    throw new Error('AI returned invalid JSON. Please try again.');
  }
}

/**
 * Calculate Synergy Score between a user's ideas and a potential collaborator's profile.
 */
export async function analyzeSynergyWithGemini(targetProfile: any, userNotes: any[]): Promise<SynergyResult> {
  if (!GEMINI_KEY) {
    throw new Error('Gemini API key not configured. Add VITE_GEMINI_API_KEY to your .env file.');
  }

  const genAI = new GoogleGenerativeAI(GEMINI_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  // Extract raw text from HTML notes
  const notesText = userNotes
    .map(n => n.content ? n.content.replace(/<[^>]+>/g, '').trim() : '')
    .filter(Boolean)
    .join('\n---\n');

  const targetDesc = `${targetProfile.name} is a ${targetProfile.industry} with a Vibe Score of ${targetProfile.vibeScore}. Badges: ${targetProfile.badges.join(', ')}.`;

  const prompt = `You are an elite AI Matchmaker for social media creators.
I have a creator looking for a creative collaborator.
Here are the creator's recent ideas/notes ("The Spark"):
${notesText ? notesText.slice(0, 3000) : "No notes yet. They rely on their general vibe and creative intuition."}

Here is the potential collaborator's profile:
${targetDesc}

Task:
Calculate a Synergy Score from 50 to 100 based on how well this collaborator's skills and industry match the creator's raw ideas. 
Also provide a short, professional, human-friendly explanation (maximum 2 sentences) of exactly WHY they are a perfect creative match, mentioning specific synergies if possible.

Respond ONLY with valid JSON exactly like this, no markdown formatting:
{"score": 95, "reasoning": "..."}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
  try {
    return JSON.parse(cleaned) as SynergyResult;
  } catch {
    throw new Error('AI returned invalid JSON for synergy calculation. Please try again.');
  }
}


