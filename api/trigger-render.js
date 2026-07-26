export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const renderApiUrl = process.env.RENDER_API_URL;
    const renderApiKey = process.env.RENDER_API_KEY;

    if (!renderApiUrl || !renderApiKey) {
      return res.status(500).json({ error: 'Render API configuration missing in Vercel environment' });
    }

    // Ping the Render worker to wake it up and process the Firestore queue
    const response = await fetch(`${renderApiUrl}/jobs/ping`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${renderApiKey}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Render API responded with ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return res.status(200).json(data);

  } catch (error) {
    console.error('Error triggering Render worker:', error);
    return res.status(500).json({ error: 'Failed to trigger Render worker', details: error.message });
  }
}
