export default async function handler(req, res) {
  try {
    // Vercel environment variable ya da varsayılan Render adresi
    const renderUrl = process.env.VITE_RENDER_API_URL || 'https://matchcut-api-1e38.onrender.com';
    
    console.log("Pinging Render API from Vercel...");
    
    // Render sunucusuna istek atıyoruz
    const response = await fetch(`${renderUrl}/`);
    
    if (response.ok) {
      const data = await response.json();
      return res.status(200).json({ 
          status: 'success', 
          message: 'Sistem durumu başarıyla kontrol edildi',
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
