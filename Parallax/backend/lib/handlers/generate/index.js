// Mock AI Generator — returns templated responses at ZERO cost.
// No Bedrock SDK needed. Swap for real Bedrock when budget allows.

const MOCK_HOOKS = [
  "Wait, you haven't tried this yet?! 🤯",
  "Okay but THIS changes everything for creators...",
  "Nobody talks about this but it's a game changer 🔥",
  "POV: You finally found the collab that clicks.",
  "This is what 99% of creators get wrong about content...",
  "Bro I wish someone told me this when I started 😭",
];

const MOCK_PITCHES = [
  "Hi [Brand],\n\nI'm a regional creator with a highly engaged audience in your target market. I'd love to collaborate on a quick content piece that showcases your product authentically.\n\nMy audience demographic aligns perfectly with your brand — let's connect!\n\nBest,\n[Creator Name]",
];

exports.handler = async (event) => {
  console.log('Mock Generate Handler invoked');

  try {
    const body = JSON.parse(event.body || '{}');
    const { prompt, generateType = 'hook' } = body;

    if (!prompt) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Prompt is required' }),
      };
    }

    // Simulate AI processing delay (500-1500ms)
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

    let generation = '';
    if (generateType === 'hook') {
      // Pick 3 random hooks
      const shuffled = [...MOCK_HOOKS].sort(() => 0.5 - Math.random());
      generation = shuffled.slice(0, 3).map(h => `• ${h}`).join('\n');
    } else if (generateType === 'pitch') {
      generation = MOCK_PITCHES[0].replace('[Brand]', prompt);
    } else {
      generation = `Here are some ideas based on "${prompt}":\n• Idea 1: Create a behind-the-scenes reel\n• Idea 2: Do a challenge with your community\n• Idea 3: Collab with a complementary creator`;
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ generation }),
    };

  } catch (error) {
    console.error('Error in mock generate:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Internal Server Error during processing' }),
    };
  }
};
