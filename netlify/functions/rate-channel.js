const https = require('https');

exports.handler = async (event) => {
  const { query } = JSON.parse(event.body);

  const systemPrompt = `You are CubSafe, a parental content rating assistant. When given a YouTube channel name or video game title, return a JSON object rating it for parents. Respond ONLY with valid JSON, no markdown, no backticks, no explanation.

The JSON must follow this exact structure:
{
  "name": "Channel or game name",
  "contentType": "youtube or game",
  "type": "short genre/category description (for YouTube)",
  "platform": "platforms (for games only)",
  "genre": "game genre (for games only)",
  "avatar": "2-3 letter abbreviation",
  "avatarBg": "#hex background color",
  "avatarColor": "#hex text color",
  "officialRating": "ESRB rating like E, E10+, T, M (games only, omit for YouTube)",
  "officialRatingDesc": "ESRB descriptor text (games only)",
  "ratings": [
    {"label": "Language", "badge": "one word or short phrase", "type": "green or amber or red"},
    {"label": "Violence", "badge": "one word or short phrase", "type": "green or amber or red"},
    {"label": "Themes", "badge": "one word or short phrase", "type": "green or amber or red"},
    {"label": "Lifestyle content", "badge": "one word or short phrase", "type": "green or amber or red"}
  ],
  "parentalControls": "description of in-game parental controls (games only, or null)",
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
        'x-api-key': process.env.ANTHROPIC_KEY,
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
          const text = parsed.content[0].text;
          resolve({ statusCode: 200, body: text });
        } catch (e) {
          resolve({ statusCode: 500, body: JSON.stringify({ error: 'Parse error', raw: data }) });
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
