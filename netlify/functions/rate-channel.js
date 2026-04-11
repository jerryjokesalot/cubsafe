const https = require('https');

exports.handler = async (event) => {
  console.log('Function called with body:', event.body);
  
  let query;
  try {
    query = JSON.parse(event.body).query;
    console.log('Query:', query);
  } catch(e) {
    console.log('Body parse error:', e.message);
    return { statusCode: 400, body: JSON.stringify({ error: 'Bad request body' }) };
  }

  const key = process.env.ANTHROPIC_KEY;
  console.log('Key present:', !!key, 'Key starts with:', key ? key.substring(0, 10) : 'none');

  const payload = JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    system: `You are CubSafe. Return ONLY valid JSON rating this content for parents. No markdown, no backticks. Use this structure: {"name":"...","contentType":"youtube or game","type":"...","avatar":"2 letters","avatarBg":"#hex","avatarColor":"#hex","ratings":[{"label":"Language","badge":"Clean","type":"green"},{"label":"Violence","badge":"None","type":"green"},{"label":"Themes","badge":"Positive","type":"green"},{"label":"Lifestyle content","badge":"None","type":"green"}],"ageRec":"Recommended age: 8+","overall":"Family Friendly","overallType":"green","note":"Brief parent summary."}`,
    messages: [{ role: 'user', content: `Rate for parents: "${query}"` }]
  });

  console.log('Calling Anthropic API...');

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
      console.log('API status code:', res.statusCode);
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        console.log('Raw API response:', data.substring(0, 500));
        try {
          const parsed = JSON.parse(data);
          if (parsed.content && parsed.content[0]) {
            const text = parsed.content[0].text;
            console.log('Extracted text:', text.substring(0, 200));
            resolve({ statusCode: 200, body: text });
          } else {
            console.log('Unexpected response structure:', JSON.stringify(parsed).substring(0, 300));
            resolve({ statusCode: 500, body: JSON.stringify({ error: 'Unexpected API response', detail: parsed }) });
          }
        } catch (e) {
          console.log('JSON parse error:', e.message, 'Raw:', data.substring(0, 300));
          resolve({ statusCode: 500, body: JSON.stringify({ error: 'Parse error', raw: data.substring(0, 300) }) });
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
