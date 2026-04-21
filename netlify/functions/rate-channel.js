const https = require('https');

exports.handler = async (event) => {
  let query;
  try {
    query = JSON.parse(event.body).query;
  } catch(e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Bad request body' }) };
  }

  const key = process.env.ANTHROPIC_KEY;

  const systemPrompt = `You are CubSafe, a parental content rating assistant. When given a YouTube channel name, video game title, or recommendation request, return ONLY valid JSON with no markdown and no backticks.

If the input is a specific channel or game name, return:
{"mode":"single","contentType":"youtube or game","name":"exact name","type":"genre/category","platform":"platforms (games only)","avatar":"2 letters","avatarBg":"#hex","avatarColor":"#hex","officialRating":"ESRB (games only)","officialRatingDesc":"descriptors (games only)","ratings":[{"label":"Language","badge":"phrase","type":"green|amber|red"},{"label":"Violence","badge":"phrase","type":"green|amber|red"},{"label":"Themes","badge":"phrase","type":"green|amber|red"},{"label":"Lifestyle content","badge":"phrase","type":"green|amber|red"}],"parentalControls":"description or null","ageRec":"Recommended age: X+","overall":"All Ages|Family Friendly|Teen|Mature","overallType":"green|amber|red","note":"2-3 sentence parent summary"}

If the input is a recommendation request, return:
{"mode":"recommendation","intro":"1-2 warm sentences.","results":[{"contentType":"youtube or game","name":"name","type":"genre","platform":"platforms (games only)","avatar":"letters","avatarBg":"#hex","avatarColor":"#hex","officialRating":"ESRB (games only)","officialRatingDesc":"descriptors (games only)","ratings":[{"label":"Violence","badge":"phrase","type":"green|amber|red"},{"label":"Language","badge":"phrase","type":"green|amber|red"},{"label":"Themes","badge":"phrase","type":"green|amber|red"},{"label":"In-app purchases","badge":"phrase","type":"green|amber|red"}],"parentalControls":"description or null","ageRec":"Recommended age: X+","overall":"All Ages|Family Friendly|Teen|Mature","overallType":"green|amber|red","note":"1-2 sentence reason"}]}`;

  const payload = JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: systemPrompt,
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
        console.log('Status:', res.statusCode);
        console.log('Raw (first 500):', data.substring(0, 500));
        
        // Always return raw data so we can debug
        if (res.statusCode !== 200) {
          resolve({ statusCode: 500, headers: { 'Access-Control-Allow-Origin': '*' }, body: data });
          return;
        }

        try {
          const parsed = JSON.parse(data);
          console.log('Parsed keys:', Object.keys(parsed));
          console.log('Content array:', JSON.stringify(parsed.content));
          
          const textBlock = parsed.content && parsed.content[0];
          const text = textBlock ? textBlock.text : '';
          console.log('Text:', text.substring(0, 200));
          
          const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
          resolve({
            statusCode: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: clean || JSON.stringify({ error: 'Empty text', parsed: parsed })
          });
        } catch(e) {
          console.log('Parse error:', e.message);
          resolve({ 
            statusCode: 200, 
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: e.message, raw: data.substring(0, 500) }) 
          });
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
