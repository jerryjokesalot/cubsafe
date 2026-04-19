exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { query } = JSON.parse(event.body);
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

  // Step 1: Detect query mode — direct search vs recommendation request
  const modePrompt = `A user typed this into a family content rating app search bar: "${query}"

Is this:
A) A direct search for a specific YouTube channel or video game by name (e.g. "MrBeast", "Fortnite", "Minecraft")
B) A recommendation request or question (e.g. "good games for my 10 year old", "safe YouTube channels for kids who like gaming")

Reply with only the single letter A or B.`;

  const modeRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 5,
      messages: [{ role: 'user', content: modePrompt }]
    })
  });

  const modeData = await modeRes.json();
  const mode = modeData.content?.[0]?.text?.trim().toUpperCase() || 'A';
  const isRecommendation = mode === 'B';

  if (isRecommendation) {
    // RECOMMENDATION MODE — return intro + array of cards
    const recPrompt = `You are CubSafe's content advisor for parents. A parent asked: "${query}"

Generate 3 age-appropriate recommendations. Respond ONLY with valid JSON, no markdown:
{
  "mode": "recommendation",
  "intro": "A warm 1-2 sentence response acknowledging what they're looking for and summarizing your picks.",
  "results": [
    {
      "type": "game|youtube",
      "name": "exact name",
      "platform": "platforms (for games only)",
      "genre": "genre or content type",
      "avatar": "2 letter initials",
      "avatarBg": "soft hex color",
      "avatarColor": "dark contrasting hex",
      "officialRating": "ESRB rating for games only, omit for YouTube",
      "officialRatingDesc": "ESRB descriptors for games only, omit for YouTube",
      "ratings": [
        {"label": "Violence", "badge": "description", "type": "green|amber|red"},
        {"label": "Language", "badge": "description", "type": "green|amber|red"},
        {"label": "Themes", "badge": "description", "type": "green|amber|red"},
        {"label": "In-app purchases", "badge": "description", "type": "green|amber|red"}
      ],
      "parentalControls": "in-game parental controls if game, omit if YouTube",
      "ageRec": "Recommended age: X+",
      "overall": "All Ages|Family Friendly|Teen|Mature",
      "overallType": "green|amber|red",
      "note": "1-2 sentence parent-focused summary of why this is a good pick for their request"
    }
  ]
}`;

    const recRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: recPrompt }]
      })
    });

    const recData = await recRes.json();
    const text = recData.content?.find(b => b.type === 'text')?.text || '';
    const clean = text.replace(/```json|```/g, '').trim();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: clean
    };

  } else {
    // DIRECT SEARCH MODE — detect YouTube vs game, return single card
    const detectPrompt = `A user typed "${query}" into a search box on a family content rating platform. 
Is this most likely: (A) a YouTube channel/creator, or (B) a video game?
Reply with only the single letter A or B.`;

    const detectRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 5,
        messages: [{ role: 'user', content: detectPrompt }]
      })
    });

    const detectData = await detectRes.json();
    const isGame = detectData.content?.[0]?.text?.trim().toUpperCase() === 'B';

    const prompt = isGame ? `You are CubSafe's content rating engine. A parent searched for the video game "${query}".

Generate a parent-focused content rating. Respond ONLY with valid JSON, no markdown:
{
  "mode": "single",
  "type": "game",
  "name": "exact game title",
  "platform": "platforms it's on",
  "genre": "game genre",
  "avatar": "2 letter initials",
  "avatarBg": "soft hex color",
  "avatarColor": "dark contrasting hex",
  "officialRating": "ESRB rating e.g. E, E10+, T, M",
  "officialRatingDesc": "ESRB content descriptors",
  "ratings": [
    {"label": "Violence", "badge": "description", "type": "green|amber|red"},
    {"label": "Language", "badge": "description", "type": "green|amber|red"},
    {"label": "Adult themes", "badge": "description", "type": "green|amber|red"},
    {"label": "In-app purchases", "badge": "description", "type": "green|amber|red"},
    {"label": "Online interaction", "badge": "description", "type": "green|amber|red"}
  ],
  "parentalControls": "What parental controls exist in the game",
  "ageRec": "Recommended age: X+",
  "overall": "All Ages|Family Friendly|Teen|Mature",
  "overallType": "green|amber|red",
  "note": "2 sentence honest parent-focused summary"
}`
    : `You are CubSafe's content rating engine. A parent searched for the YouTube channel "${query}".

Generate a parent-focused content rating. Respond ONLY with valid JSON, no markdown:
{
  "mode": "single",
  "type": "youtube",
  "name": "exact channel name",
  "genre": "content category",
  "avatar": "2 letter initials",
  "avatarBg": "soft hex color",
  "avatarColor": "dark contrasting hex",
  "ratings": [
    {"label": "Language", "badge": "description", "type": "green|amber|red"},
    {"label": "Violence", "badge": "description", "type": "green|amber|red"},
    {"label": "Themes", "badge": "description", "type": "green|amber|red"},
    {"label": "Lifestyle content", "badge": "description", "type": "green|amber|red"}
  ],
  "ageRec": "Recommended age: X+",
  "overall": "All Ages|Family Friendly|Teen|Mature",
  "overallType": "green|amber|red",
  "note": "2 sentence honest parent-focused summary"
}`;

    const ratingRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const ratingData = await ratingRes.json();
    const text = ratingData.content?.find(b => b.type === 'text')?.text || '';
    const clean = text.replace(/```json|```/g, '').trim();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: clean
    };
  }
};
