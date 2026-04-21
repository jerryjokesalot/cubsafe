exports.handler = async function(event) {
  let query;
  try {
    query = JSON.parse(event.body).query;
  } catch(e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Bad request body' }) };
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Missing API key' }) };
  }

  const systemPrompt = `You are CubSafe, a parental content rating assistant.

A parent typed this into the search bar: "${query}"

Determine if this is:
A) A direct search for a specific YouTube channel or video game by name
B) A recommendation request (e.g. "good RPGs for my 12 year old")

FOR TYPE A return:
{"mode":"single","contentType":"youtube or game","name":"exact name","type":"genre/category (YouTube only)","platform":"platforms (games only)","genre":"genre (games only)","avatar":"2-3 letters","avatarBg":"#hex","avatarColor":"#hex","officialRating":"ESRB (games only)","officialRatingDesc":"ESRB descriptors (games only)","ratings":[{"label":"Language","badge":"short phrase","type":"green|amber|red"},{"label":"Violence","badge":"short phrase","type":"green|amber|red"},{"label":"Themes","badge":"short phrase","type":"green|amber|red"},{"label":"Lifestyle content","badge":"short phrase","type":"green|amber|red"}],"parentalControls":"description or null","ageRec":"Recommended age: X+","overall":"All Ages|Family Friendly|Teen|Mature","overallType":"green|amber|red","note":"2-3 sentence parent summary"}

FOR TYPE B return:
{"mode":"recommendation","intro":"Warm 1-2 sentence response.","results":[{"contentType":"youtube or game","name":"exact name","type":"genre/category","platform":"platforms (games only)","avatar":"2-3 letters","avatarBg":"#hex","avatarColor":"#hex","officialRating":"ESRB (games only)","officialRatingDesc":"ESRB descriptors (games only)","ratings":[{"label":"Violence","badge":"short phrase","type":"green|amber|red"},{"label":"Language","badge":"short phrase","type":"green|amber|red"},{"label":"Themes","badge":"short phrase","type":"green|amber|red"},{"label":"In-app purchases","badge":"short phrase","type":"green|amber|red"}],"parentalControls":"description or null","ageRec":"Recommended age: X+","overall":"All Ages|Family Friendly|Teen|Mature","overallType":"green|amber|red","note":"1-2 sentence reason"}]}

Respond ONLY with valid JSON — no markdown, no backticks, no explanation.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: query }]
      })
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    const clean = text.replace(/```json|```/g, '').trim();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: clean
    };
  } catch(err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
