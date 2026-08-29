export default async function handler(req, res) {
  try {
    // 24/7 Keep-Alive Motoru ON/OFF Kontrolü
    // Varsayılan: OFF (Sunucuyu 7/24 uyanık tutan ping motoru durdurulur; sunucu uykuya geçer ve sadece gerçek render isteğinde uyanır)
    const isKeepAliveEnabled = 
      process.env.ENABLE_RENDER_KEEPALIVE === 'true' || 
      req.query?.force === 'true' || 
      req.query?.keepalive === 'on';

    if (!isKeepAliveEnabled) {
      return res.status(200).json({ 
          status: 'standby', 
          mode: 'on_demand',
          keep_alive_24_7: false,
          message: 'Render sunucusu 7/24 uyanık tutma motoru DURDURULDU (Standby/İstek Üzerine Mod). Sunucu uyur, gerçek render isteklerinde anında uyanır.' 
      });
    }

    // Vercel environment variable ya da varsayılan Render adresi
    const renderUrl = process.env.VITE_RENDER_API_URL || process.env.RENDER_API_URL || 'https://matchcut-api-1e38.onrender.com';
    
    console.log("Pinging Render API from Vercel (Keep-Alive is ON)...");
    
    // Render sunucusuna istek atıyoruz
    const response = await fetch(`${renderUrl}/`);
    
    if (response.ok) {
      const data = await response.json();
      return res.status(200).json({ 
          status: 'success', 
          mode: 'always_on',
          keep_alive_24_7: true,
          message: 'Render sunucusu uyanık ve aktif',
          system_status: data 
      });
    } else {
      return res.status(response.status).json({ 
          status: 'error', 
          message: `Render sunucusu hata döndürdü: ${response.status}` 
      });
    }
  } catch (error) {
    return res.status(500).json({ 
        status: 'error', 
        message: `Vercel üzerinden istek atılırken hata oluştu: ${error.message}` 
    });
  }
}
