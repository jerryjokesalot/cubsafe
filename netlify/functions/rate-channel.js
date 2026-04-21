const https = require('https');

exports.handler = async function(event) {
  let query;
  try {
    query = JSON.parse(event.body).query;
  } catch(e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Bad request body' }) };
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { statusCode: 500, body: JSON.stringify({ error: 'Missing API key' }) };

  const systemPrompt = `You are CubSafe, a parental content rating assistant.

A parent typed: "${query}"

If this is a direct search for a specific channel/game name, return:
{"mode":"single","contentType":"youtube or game","name":"exact name","type":"genre (YouTube only)","platform":"platforms (games only)","genre":"genre (games only)","avatar":"2-3 letters","avatarBg":"#hex","avatarColor":"#hex","officialRating":"ESRB (games only)","officialRatingDesc":"descriptors (games only)","ratings":[{"label":"Language","badge":"phrase","type":"green|amber|red"},{"label":"Violence","badge":"phrase","type":"green|amber|red"},{"label":"Themes","badge":"phrase","type":"green|amber|red"},{"label":"Lifestyle content","badge":"phrase","type":"green|amber|red"}],"parentalControls":"description or null","ageRec":"Recommended age: X+","overall":"All Ages|Family Friendly|Teen|Mature","overallType":"green|amber|red","note":"2-3 sentence summary"}

If this is a recommendation request, return:
{"mode":"recommendation","intro":"1-2 warm sentences.","results":[{"contentType":"youtube or game","name":"name","type":"genre","platform":"platforms (games only)","avatar":"letters","avatarBg":"#hex","avatarColor":"#hex","officialRating":"ESRB (games only)","officialRatingDesc":"descriptors (games only)","ratings":[{"label":"Violence","badge":"phrase","type":"green|amber|red"},{"label":"Language","badge":"phrase","type":"green|amber|red"},{"label":"Themes","badge":"phrase","type":"green|amber|red"},{"label":"In-app purchases","badge":"phrase","type":"green|amber|red"}],"parentalControls":"description or null","ageRec":"Recommended age: X+","overall":"All Ages|Family Friendly|Teen|Mature","overallType":"green|amber|red","note":"1-2 sentences"}]}

Return ONLY valid JSON. No markdown, no backticks.`;

  const postData = JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{ role: 'user', content: query }]
  });

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.anthropic.com',
      port: 443,
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const text = (parsed.content && parsed.content[0] && parsed.content[0].text) ? parsed.content[0].text : '';
          const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
          resolve({
            statusCode: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: clean
          });
        } catch(e) {
          resolve({ statusCode: 500, body: JSON.stringify({ error: 'Parse failed', detail: data.substring(0, 300) }) });
        }
      });
    });

    req.on('error', (e) => {
      resolve({ statusCode: 500, body: JSON.stringify({ error: e.message }) });
    });

    req.write(postData);
    req.end();
  });
};
