const https = require('https');

exports.handler = async (event) => {
  let query;
  try {
    query = JSON.parse(event.body).query;
  } catch(e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Bad request body' }) };
  }

  const key = process.env.ANTHROPIC_KEY;
  console.log('Key present:', !!key);
  console.log('Query:', query);

  const payload = JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: `You are CubSafe, a parental content rating assistant. A parent typed: "${query}". Determine if this is a direct search (specific name) or recommendation request. Return ONLY valid JSON, no markdown, no backticks.

For a direct search return: {"mode":"single","contentType":"youtube or game","name":"exact name","type":"genre","platform":"platforms (games only)","avatar":"2 letters","avatarBg":"#hex","avatarColor":"#hex","officialRating":"ESRB (games only)","officialRatingDesc":"descriptors (games only)","ratings":[{"label":"Language","badge":"phrase","type":"green|amber|red"},{"label":"Violence","badge":"phrase","type":"green|amber|red"},{"label":"Themes","badge":"phrase","type":"green|amber|red"},{"label":"Lifestyle content","badge":"phrase","type":"green|amber|red"}],"parentalControls":"description or null","ageRec":"Recommended age: X+","overall":"All Ages|Family Friendly|Teen|Mature","overallType":"green|amber|red","note":"2-3 sentence summary"}

For a recommendation request return: {"mode":"recommendation","intro":"1-2 warm sentences.","results":[{"contentType":"youtube or game","name":"name","type":"genre","platform":"platforms (games only)","avatar":"letters","avatarBg":"#hex","avatarColor":"#hex","officialRating":"ESRB (games only)","officialRatingDesc":"descriptors","ratings":[{"label":"Violence","badge":"phrase","type":"green|amber|red"},{"label":"Language","badge":"phrase","type":"green|amber|red"},{"label":"Themes","badge":"phrase","type":"green|amber|red"},{"label":"In-app purchases","badge":"phrase","type":"green|amber|red"}],"parentalControls":"description or null","ageRec":"Recommended age: X+","overall":"All Ages|Family Friendly|Teen|Mature","overallType":"green|amber|red","note":"1-2 sentences"}]}`,
    messages: [{ role: 'user', content: query }]
  });

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.anthropic.com',
      port: 443,
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        console.log('Response status:', res.statusCode);
        console.log('Response data:', data.substring(0, 500));
        try {
          const parsed = JSON.parse(data);
          const text = parsed.content && parsed.content[0] ? parsed.content[0].text : '';
          console.log('Extracted text length:', text.length);
          const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
          resolve({
            statusCode: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: clean
          });
        } catch(e) {
          console.log('Parse error:', e.message);
          resolve({ statusCode: 500, body: JSON.stringify({ error: e.message, raw: data.substring(0, 200) }) });
        }
      });
    });

    req.on('error', (e) => {
      console.log('Request error:', e.message);
      resolve({ statusCode: 500, body: JSON.stringify({ error: e.message }) });
    });

    req.write(payload);
    req.end();
  });
};
