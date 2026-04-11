const https = require('https');

exports.handler = async (event) => {
  let query;
  try {
    query = JSON.parse(event.body).query;
  } catch(e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Bad request body' }) };
  }

  const key = process.env.ANTHROPIC_KEY;

  const systemPrompt = `You are CubSafe, a parental content rating assistant. When given a YouTube channel name or video game title, return a JSON object rating it for parents. Respond ONLY with valid JSON, no markdown, no backticks, no explanation.

CRITICAL RULES:
- If it is a VIDEO GAME, set "contentType" to exactly "game"
- If it is a YOUTUBE CHANNEL or VIDEO, set "contentType" to exactly "youtube"
- Always include "officialRating" and "officialRatingDesc" for games (ESRB ratings)
- Always include "platform" and "genre" for games

The JSON must follow this exact structure:
{
  "name": "Channel or game name",
  "contentType": "youtube or game",
  "type": "short genre/category description (for YouTube only)",
  "platform": "PC, Console, Mobile etc (for games only)",
  "genre": "game genre (for games only)",
  "avatar": "2-3 letter abbreviation",
  "avatarBg": "#hex background color",
  "avatarColor": "#hex text color",
  "officialRating": "ESRB rating like E, E10+, T, M (games only)",
  "officialRatingDesc": "ESRB descriptor text (games only)",
  "ratings": [
    {"label": "Language", "badge": "one word or short phrase", "type": "green or amber or red"},
    {"label": "Violence", "badge": "one word or short phrase", "type": "green or amber or red"},
    {"label": "Themes", "badge": "one word or short phrase", "type": "green or amber or red"},
    {"label": "Lifestyle content", "badge": "one word or short phrase", "type": "green or amber or red"}
  ],
  "parentalControls": "description of in-game parental controls (games only)",
  "ageRec": "Recommended age: X+",
  "overall": "All Ages or Family Friendly or Teen or Mature",
  "overallType": "green or amber or red",
  "note": "2-3 sentence plain-English summary for parents"
}`;

  const payload = JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    system: systemPrompt,
    messages: [{ role: 'user', content: `Rate this for parents: "${query}"` }]
  });

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.content && parsed.content[0]) {
            resolve({ statusCode: 200, body: parsed.content[0].text });
          } else {
            resolve({ statusCode: 500, body: JSON.stringify({ error: 'Unexpected API response', detail: parsed }) });
          }
        } catch (e) {
          resolve({ statusCode: 500, body: JSON.stringify({ error: 'Parse error', raw: data.substring(0, 300) }) });
        }
      });
    });

    req.on('error', (e) => {
      resolve({ statusCode: 500, body: JSON.stringify({ error: e.message }) });
    });

    req.write(payload);
    req.end();
  });
};
