exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { query } = JSON.parse(event.body);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `You are CubSafe's content rating engine. A parent has searched for a YouTube channel called "${query}".

Based on your knowledge of this channel, generate a content rating for parents.

Respond ONLY with a valid JSON object, no markdown, no explanation:
{
  "name": "exact channel name",
  "type": "content category",
  "avatar": "2 letter initials",
  "avatarBg": "a soft hex color",
  "avatarColor": "a dark contrasting hex color",
  "ratings": [
    {"label": "Language", "badge": "Clean|Mild|Moderate|Strong", "type": "green|amber|red"},
    {"label": "Violence", "badge": "None|Mild (cartoon)|Moderate|Strong", "type": "green|amber|red"},
    {"label": "Themes", "badge": "short description", "type": "green|amber|red"},
    {"label": "Lifestyle content", "badge": "short description", "type": "green|amber|red"}
  ],
  "ageRec": "Recommended age: X+",
  "overall": "All Ages|Family Friendly|Teen|Mature",
  "overallType": "green|amber|red",
  "note": "2 sentence honest parent-focused summary"
}`
      }]
    })
  });

  const data = await response.json();
  const text = data.content?.find(b => b.type === 'text')?.text || '';
  const clean = text.replace(/```json|```/g, '').trim();

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: clean
  };
};
