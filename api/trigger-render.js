export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const renderApiUrl = process.env.RENDER_API_URL || process.env.VITE_RENDER_API_URL || 'https://matchcut-api-1e38.onrender.com';
    const renderApiKey = process.env.RENDER_API_KEY;

    if (!renderApiUrl) {
      return res.status(500).json({ error: 'Render API URL is not configured' });
    }

    const headers = {
      'Content-Type': 'application/json'
    };
    if (renderApiKey) {
      headers['Authorization'] = `Bearer ${renderApiKey}`;
    }

    // Ping the Render worker to wake it up on-demand and process the Firestore queue
    const endpoint = `${renderApiUrl}/jobs/ping`;
    const response = await fetch(endpoint, {
      method: renderApiKey ? 'POST' : 'GET',
      headers: headers
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`Render API ping responded with ${response.status}: ${errorText}`);
    }

    let data = {};
    try {
      data = await response.json();
    } catch (e) {
      data = { status: 'pinged' };
    }

    return res.status(200).json({
      status: 'triggered',
      message: 'Render sunucusu istek üzerine uyandırıldı ve kuyruğu işlemeye başladı.',
      worker_response: data
    });

  } catch (error) {
    console.error('Error triggering Render worker:', error);
    return res.status(500).json({ error: 'Failed to trigger Render worker', details: error.message });
  }
}
