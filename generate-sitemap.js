import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const toAbsolute = (p) => path.resolve(__dirname, p)

const BASE_URL = process.env.SITE_BASE_URL || 'https://animationmaker.m0s.space'
const today = new Date().toISOString().split('T')[0]

const pages = [
  { url: '/', changefreq: 'daily', priority: '1.0' },
  { url: '/tools', changefreq: 'daily', priority: '0.9' },
  { url: '/match-cut', changefreq: 'weekly', priority: '0.9' },
  { url: '/effects/ken-burns', changefreq: 'weekly', priority: '0.9' },
  { url: '/effects/vhs-tape', changefreq: 'weekly', priority: '0.9' },
  { url: '/effects/glitch-master', changefreq: 'weekly', priority: '0.9' },
  { url: '/effects/typewriter', changefreq: 'weekly', priority: '0.9' },
  { url: '/effects/scanline', changefreq: 'weekly', priority: '0.9' },
  { url: '/effects/ascii', changefreq: 'weekly', priority: '0.9' },
  { url: '/effects/echo', changefreq: 'weekly', priority: '0.9' },
  { url: '/effects/gsearch', changefreq: 'weekly', priority: '0.9' },
  { url: '/effects/spotlight', changefreq: 'weekly', priority: '0.9' },
  { url: '/effects/formula', changefreq: 'weekly', priority: '0.9' },
  { url: '/effects/timeline', changefreq: 'weekly', priority: '0.9' },
  { url: '/effects/tree', changefreq: 'weekly', priority: '0.9' },
  { url: '/effects/counter', changefreq: 'weekly', priority: '0.9' },
  { url: '/effects/paper', changefreq: 'weekly', priority: '0.9' },
  { url: '/effects/tracking', changefreq: 'weekly', priority: '0.9' },
  { url: '/pricing', changefreq: 'monthly', priority: '0.8' },
  { url: '/terms', changefreq: 'monthly', priority: '0.4' },
  { url: '/privacy', changefreq: 'monthly', priority: '0.4' },
  { url: '/cookies', changefreq: 'monthly', priority: '0.4' },
  { url: '/refund', changefreq: 'monthly', priority: '0.4' }
]

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${pages.map(p => `  <url>
    <loc>${BASE_URL}${p.url}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
    <image:image>
      <image:loc>${BASE_URL}/og-image.png</image:loc>
      <image:title>AnimationMaker - Kinetic Typography and Video Effects</image:title>
    </image:image>
  </url>`).join('\n')}
</urlset>`

try {
  fs.writeFileSync(toAbsolute('./dist/sitemap.xml'), xml)
} catch(e) {}
try {
  fs.writeFileSync(toAbsolute('./public/sitemap.xml'), xml)
} catch(e) {}

console.log('sitemap.xml generated.')
