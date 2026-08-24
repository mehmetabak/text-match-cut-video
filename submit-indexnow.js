// submit-indexnow.js
// Submits all site URLs to IndexNow (Bing, Yandex, Naver, Seznam) instantly.

const INDEXNOW_KEY = process.env.INDEXNOW_KEY || 'f4a8b72c91e04653b82d49e18c5e37a2';
const HOST = process.env.SITE_HOST || 'animationmaker.m0s.space';
const BASE_URL = process.env.SITE_BASE_URL || `https://${HOST}`;
const KEY_LOCATION = `${BASE_URL}/${INDEXNOW_KEY}.txt`;

const routes = [
  '/',
  '/tools',
  '/pricing',
  '/match-cut',
  '/effects/ken-burns',
  '/effects/vhs-tape',
  '/effects/glitch-master',
  '/effects/typewriter',
  '/effects/scanline',
  '/effects/ascii',
  '/effects/echo',
  '/effects/gsearch',
  '/effects/spotlight',
  '/effects/formula',
  '/effects/timeline',
  '/effects/tree',
  '/effects/counter',
  '/effects/paper',
  '/effects/tracking',
  '/terms',
  '/privacy',
  '/cookies',
  '/refund'
];

const urlList = routes.map(route => `${BASE_URL}${route}`);

const payload = {
  host: HOST,
  key: INDEXNOW_KEY,
  keyLocation: KEY_LOCATION,
  urlList: urlList
};

const endpoints = [
  { name: 'IndexNow Global (IndexNow.org)', url: 'https://api.indexnow.org/indexnow' },
  { name: 'Microsoft Bing', url: 'https://www.bing.com/indexnow' },
  { name: 'Yandex', url: 'https://yandex.com/indexnow' }
];

async function submitIndexNow() {
  console.log(`\n📡 [IndexNow] Submitting ${urlList.length} URLs for host: ${HOST}...`);
  console.log(`🔑 Key Location: ${KEY_LOCATION}\n`);

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8'
        },
        body: JSON.stringify(payload)
      });

      const status = response.status;
      const statusText = response.statusText;
      let bodyText = '';
      try {
        bodyText = await response.text();
      } catch (e) {}

      if (status === 200 || status === 202) {
        console.log(`✅ [${endpoint.name}] Submitted successfully! (HTTP ${status} ${statusText || 'OK/Accepted'})`);
      } else {
        console.warn(`⚠️ [${endpoint.name}] Response: HTTP ${status} ${statusText} - ${bodyText}`);
      }
    } catch (err) {
      console.error(`❌ [${endpoint.name}] Network error:`, err.message);
    }
  }

  console.log('\n✨ IndexNow submission completed.\n');
}

submitIndexNow();
