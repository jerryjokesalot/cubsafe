const https = require('https');

exports.handler = async function(event) {
  let query;
  try {
    query = JSON.parse(event.body).query;
  } catch(e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Bad request body' }) };
  }

  const key = process.env.ANTHROPIC_KEY;

  const systemPrompt = `You are CubSafe, a parental content rating assistant.

A parent typed this into the search bar: "${query}"

First, determine if this is:
A) A direct search for a specific YouTube channel or video game by name (e.g. "MrBeast", "Fortnite")
B) A recommendation request (e.g. "good RPGs for my 12 year old", "safe channels for kids who like gaming")

FOR TYPE A — return a single rating object:
{
  "mode": "single",
  "contentType": "youtube" or "game",
  "name": "exact name",
  "type": "short genre/category (YouTube only)",
  "platform": "platforms (games only)",
  "genre": "game genre (games only)",
  "avatar": "2-3 letters",
  "avatarBg": "#hex",
  "avatarColor": "#hex",
  "officialRating": "ESRB rating (games only)",
  "officialRatingDesc": "ESRB descriptors (games only)",
  "ratings": [
    {"label": "Language", "badge": "short phrase", "type": "green|amber|red"},
    {"label": "Violence", "badge": "short phrase", "type": "green|amber|red"},
    {"label": "Themes", "badge": "short phrase", "type": "green|amber|red"},
    {"label": "Lifestyle content", "badge": "short phrase", "type": "green|amber|red"}
  ],
  "parentalControls": "in-game controls description (games only, or null)",
  "ageRec": "Recommended age: X+",
  "overall": "All Ages|Family Friendly|Teen|Mature",
  "overallType": "green|amber|red",
  "note": "2-3 sentence parent summary"
}

FOR TYPE B — return 3 recommendations:
{
  "mode": "recommendation",
  "intro": "Warm 1-2 sentence response summarizing your picks.",
  "results": [
    {
      "contentType": "youtube" or "game",
      "name": "exact name",
      "type": "genre/category",
      "platform": "platforms (games only)",
      "avatar": "2-3 letters",
      "avatarBg": "#hex",
      "avatarColor": "#hex",
      "officialRating": "ESRB (games only)",
      "officialRatingDesc": "ESRB descriptors (games only)",
      "ratings": [
        {"label": "Violence", "badge": "short phrase", "type": "green|amber|red"},
        {"label": "Language", "badge": "short phrase", "type": "green|amber|red"},
        {"label": "Themes", "badge": "short phrase", "type": "green|amber|red"},
        {"label": "In-app purchases", "badge": "short phrase", "type": "green|amber|red"}
      ],
      "parentalControls": "description or null",
      "ageRec": "Recommended age: X+",
      "overall": "All Ages|Family Friendly|Teen|Mature",
      "overallType": "green|amber|red",
      "note": "1-2 sentence reason this is a good pick"
    }
  ]
}

Respond ONLY with valid JSON — no markdown, no backticks, no explanation.`;

  const body = JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{ role: 'user', content: query }]
  });

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const text = parsed.content?.[0]?.text || '';
          const clean = text.replace(/```json|```/g, '').trim();
          resolve({
            statusCode: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: clean
          });
        } catch(e) {
          resolve({ statusCode: 500, body: JSON.stringify({ error: 'Parse error', raw: data.slice(0, 200) }) });
        }
      });
    });
    req.on('error', (e) => {
      resolve({ statusCode: 500, body: JSON.stringify({ error: e.message }) });
    });
    req.write(body);
    req.end();
  });
};
