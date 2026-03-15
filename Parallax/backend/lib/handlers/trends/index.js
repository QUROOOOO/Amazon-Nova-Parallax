// backend/lib/handlers/trends/index.js
// =============================================
// VVRA SCORING ENGINE — Viral Video Reproducibility Analysis
// =============================================
const https = require('https');

// ========= HTTPS HELPERS =========
const getJSON = (url) => new Promise((resolve, reject) => {
  https.get(url, (response) => {
    let data = '';
    response.on('data', c => data += c);
    response.on('end', () => {
      try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
    });
  }).on('error', reject);
});

const postJSON = (url, body) => new Promise((resolve, reject) => {
  const urlObj = new URL(url);
  const payload = JSON.stringify(body);
  const options = {
    hostname: urlObj.hostname,
    path: urlObj.pathname + urlObj.search,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
  };
  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
      try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
    });
  });
  req.on('error', reject);
  req.write(payload);
  req.end();
});

// ========= YOUTUBE DATA FETCH (50 results) =========
function fetchYouTubeTrends(apiKey, language, type) {
  return new Promise(async (resolve, reject) => {
    let regionCode = 'US';
    if (['Hindi', 'Telugu', 'Tamil', 'Kannada', 'Malayalam', 'Marathi', 'Bengali', 'Urdu', 'Gujarati', 'Odia (Oriya)', 'Punjabi'].includes(language)) {
      regionCode = 'IN';
    }

    let url = '';

    // Default fallback to mostPopular — now fetches 50 results
    if ((!language || language === 'All' || language === 'English') && (!type || type === 'All')) {
      url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&regionCode=${regionCode}&maxResults=50&key=${apiKey}`;
    } else {
      let q = 'trending';
      if (language && language !== 'All') q += ' ' + language;
      if (type && type !== 'All') {
        if (type === 'Gaming') q += ' gaming';
        else if (type === 'Music') q += ' music';
        else if (type === 'Shorts') q += ' #shorts';
        else if (type === 'Live') q += ' live stream';
      }
      url = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=50&type=video&q=${encodeURIComponent(q)}&key=${apiKey}`;
    }

    try {
      const data = await getJSON(url);

      // Search endpoint returns no statistics — must do a secondary fetch
      if (url.includes('/search')) {
        if (!data.items || data.items.length === 0) return resolve(data);
        const videoIds = data.items.map(i => i.id.videoId).join(',');
        const statsUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoIds}&key=${apiKey}`;
        const statsData = await getJSON(statsUrl);
        return resolve(statsData);
      }

      resolve(data);
    } catch (e) {
      reject(e);
    }
  });
}

// ========= VVRA BASELINE FORMULA =========
// baseline = (views / hoursSincePublished) * ((likes + (comments * 1.5)) / views)
function computeVVRABaseline(viewCount, likeCount, commentCount, publishedAt) {
  const now = new Date();
  const hoursAlive = Math.max((now - new Date(publishedAt)) / (1000 * 60 * 60), 1);
  
  if (viewCount === 0) return 0;

  const velocityPerHour = viewCount / hoursAlive;
  const engagementDensity = (likeCount + (commentCount * 1.5)) / viewCount;
  
  return velocityPerHour * engagementDensity;
}

// ========= GEMINI REPRODUCIBILITY MULTIPLIER =========
async function getGeminiMultipliers(trends, geminiKey) {
  if (!geminiKey || trends.length === 0) return null;

  const batchInput = trends.slice(0, 50).map(t => ({
    id: t.id,
    title: t.title,
    channel: t.category,
    tags: (t.tags || []).join(', ')
  }));

  const prompt = `Analyze these trending YouTube videos. Return ONLY a valid JSON array (no markdown, no backticks) assigning a "reproducibility_multiplier" (0.5 to 2.0) to each ID. 

Rules:
- Give 2.0 to formats easily replicated by a solo creator (e.g., talking head, commentary, reaction, tutorial, list video, vlog)
- Give 1.5 to moderately reproducible formats (e.g., review, interview, cooking)
- Give 1.0 to average difficulty (e.g., short film, mini documentary)
- Give 0.5 to high-budget studio productions (e.g., music videos, movie trailers, professional sports highlights)

Videos to analyze:
${JSON.stringify(batchInput)}

Return format: [{"id":"...","multiplier":1.5},...]`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-8b:generateContent?key=${geminiKey}`;
    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 2048 }
    };

    const response = await postJSON(url, body);

    if (response.candidates && response.candidates[0]?.content?.parts?.[0]?.text) {
      let text = response.candidates[0].content.parts[0].text.trim();
      // Strip markdown code fences if Gemini wraps them
      text = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      const multipliers = JSON.parse(text);
      // Build a lookup map: id -> multiplier
      const map = {};
      for (const entry of multipliers) {
        map[entry.id] = Math.max(0.5, Math.min(2.0, parseFloat(entry.multiplier) || 1.0));
      }
      return map;
    }
  } catch (err) {
    console.error('Gemini multiplier fetch failed (non-fatal):', err.message || err);
  }

  return null; // Fallback: no multiplier applied
}

// ========= HOOK GENERATOR =========
function generateHook(title) {
  const prefixes = [
    "Here's why everyone is talking about",
    "The truth behind",
    "You won't believe what happened in",
    "Breaking down the virality of",
    "Is this the end of"
  ];
  const randomPrefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  return `${randomPrefix} "${title.substring(0, 40)}..."`;
}

// ========= MOCK FALLBACK DATA (with VVRA scores) =========
function getMockTrends(lang, t) {
  let mockData = [
    {
      id: "m1", title: "I Survived 50 Hours In Antarctica!", category: "MrBeast",
      engagementRate: "8.5", velocity: 450000, vvra_score: 892, vvra_baseline: 446, gemini_multiplier: 2.0,
      searchVolume: "High", hook: generateHook("I Survived 50 Hours In Antarctica!"),
      sentiment: "Trending", tags: ["English", "MrBeast"], platform: "YouTube", genre: "Entertainment"
    },
    {
      id: "m2", title: "10 CSS Tricks You Should Know", category: "Web Dev Simplified",
      engagementRate: "6.2", velocity: 25000, vvra_score: 620, vvra_baseline: 310, gemini_multiplier: 2.0,
      searchVolume: "Medium", hook: generateHook("10 CSS Tricks You Should Know"),
      sentiment: "Trending", tags: ["English", "Web Dev Simplified"], platform: "YouTube", genre: "Education"
    },
    {
      id: "m3", title: "GTA 6 Trailer Breakdown", category: "IGN",
      engagementRate: "9.1", velocity: 1200000, vvra_score: 455, vvra_baseline: 910, gemini_multiplier: 0.5,
      searchVolume: "High", hook: generateHook("GTA 6 Trailer Breakdown"),
      sentiment: "Trending", tags: ["English", "IGN"], platform: "YouTube", genre: "Gaming"
    },
    {
      id: "m4", title: "New Taylor Swift Song Leaked?!", category: "PopCrave",
      engagementRate: "12.4", velocity: 850000, vvra_score: 372, vvra_baseline: 744, gemini_multiplier: 0.5,
      searchVolume: "High", hook: generateHook("New Taylor Swift Song Leaked?!"),
      sentiment: "Trending", tags: ["English", "PopCrave"], platform: "YouTube", genre: "Music"
    },
    {
      id: "m5", title: "The Truth About AI Video Generators", category: "Marques Brownlee",
      engagementRate: "7.8", velocity: 650000, vvra_score: 780, vvra_baseline: 520, gemini_multiplier: 1.5,
      searchVolume: "High", hook: generateHook("The Truth About AI Video Generators"),
      sentiment: "Trending", tags: ["English", "Tech"], platform: "YouTube", genre: "Tech"
    }
  ];

  if (t && t !== 'All') {
    mockData = mockData.filter(item => {
      if (t === 'Gaming') return item.genre === 'Gaming';
      if (t === 'Music') return item.genre === 'Music';
      return true;
    });
  }

  // Sort by VVRA score
  mockData.sort((a, b) => b.vvra_score - a.vvra_score);
  return mockData;
}

// ========= MAIN HANDLER =========
exports.handler = async (event) => {

  try {
    const apiKey = process.env.YOUTUBE_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    // Sanitize inputs
    const sanitize = (str) => {
      if (!str || typeof str !== 'string') return '';
      return str.replace(/[{}$\\<>]/g, '').trim().slice(0, 100);
    };

    const queryParams = event.queryStringParameters || {};
    const language = sanitize(queryParams.lang) || 'All';
    const searchQuery = sanitize(queryParams.q) || '';
    const type = sanitize(queryParams.type) || 'All';

    const CORS_HEADERS = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json'
    };

    // === FALLBACK: No YouTube API key ===
    if (!apiKey) {
      console.warn('Missing YouTube API Key - Falling back to mock VVRA data');
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ data: getMockTrends(language, type) }) };
    }

    // === FETCH FROM YOUTUBE ===
    let ytResponse;
    try {
      ytResponse = await fetchYouTubeTrends(apiKey, language, type);
    } catch (apiErr) {
      console.error('YouTube API Fetch Error:', apiErr);
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ data: getMockTrends(language, type) }) };
    }

    if (!ytResponse || !ytResponse.items || ytResponse.items.length === 0) {
      console.warn('No video items returned from YT API. Possible quota limit.');
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ data: getMockTrends(language, type) }) };
    }

    // === STEP 1: Compute VVRA Baseline for each video ===
    let liveTrends = ytResponse.items.map(item => {
      const viewCount = parseInt(item.statistics?.viewCount || '0', 10);
      const likeCount = parseInt(item.statistics?.likeCount || '0', 10);
      const commentCount = parseInt(item.statistics?.commentCount || '0', 10);
      const publishedAt = item.snippet.publishedAt;

      // VVRA Baseline = (views / hours) * ((likes + comments*1.5) / views)
      const vvra_baseline = computeVVRABaseline(viewCount, likeCount, commentCount, publishedAt);

      // Legacy metrics (still useful for display)
      const engagementRate = viewCount > 0 ? ((likeCount / viewCount) * 100).toFixed(1) : '0.0';
      const now = new Date();
      const daysAlive = Math.max((now - new Date(publishedAt)) / (1000 * 60 * 60 * 24), 1);
      const velocity = Math.round(viewCount / daysAlive);

      let genre = '';
      if (item.snippet.categoryId === '10') genre = 'Music';
      else if (item.snippet.categoryId === '20') genre = 'Gaming';

      return {
        id: item.id,
        title: item.snippet.title,
        category: item.snippet.channelTitle,
        engagementRate,
        velocity,
        vvra_baseline: Math.round(vvra_baseline * 100) / 100,
        vvra_score: 0, // Will be set after Gemini
        gemini_multiplier: 1.0, // Default
        searchVolume: viewCount > 2000000 ? 'High' : (viewCount > 500000 ? 'Medium' : 'Low'),
        hook: generateHook(item.snippet.title),
        sentiment: 'Trending',
        tags: [language, item.snippet.channelTitle],
        platform: 'YouTube',
        genre
      };
    });

    // === STEP 2: Gemini Reproducibility Multiplier (γ) ===
    const multiplierMap = await getGeminiMultipliers(liveTrends, geminiKey);

    liveTrends = liveTrends.map(trend => {
      const gamma = multiplierMap ? (multiplierMap[trend.id] || 1.0) : 1.0;
      trend.gemini_multiplier = gamma;
      trend.vvra_score = Math.round(trend.vvra_baseline * gamma * 100) / 100;
      return trend;
    });

    // === STEP 3: Filter by search query ===
    if (searchQuery && liveTrends.length > 0) {
      const q = searchQuery.toLowerCase();
      liveTrends = liveTrends.filter(t =>
        t.title.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    }

    // === STEP 4: Sort by VVRA Score (Descending) ===
    liveTrends.sort((a, b) => b.vvra_score - a.vvra_score);

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ data: liveTrends }),
    };

  } catch (error) {
    console.error('Error in VVRA engine:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'VVRA engine failure' }),
    };
  }
};
