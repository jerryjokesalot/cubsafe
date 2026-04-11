exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { email } = JSON.parse(event.body);

  if (!email || !email.includes('@')) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid email' }) };
  }

  const API_KEY = process.env.MAILCHIMP_API_KEY;
  const LIST_ID = '56ee447b6f';
  const SERVER = 'us6';

  console.log('Subscribing:', email);
  console.log('API Key present:', !!API_KEY);

  const response = await fetch(`https://${SERVER}.api.mailchimp.com/3.0/lists/${LIST_ID}/members`, {
    method: 'POST',
    headers: {
      'Authorization': `apikey ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email_address: email,
      status: 'pending'
    })
  });

  const data = await response.json();
  console.log('Mailchimp response:', JSON.stringify(data));

  if (response.ok || data.title === 'Member Exists') {
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: true })
    };
  } else {
    console.log('Error:', data.detail, data.title);
    return {
      statusCode: 400,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: data.detail || 'Subscription failed' })
    };
  }
};
