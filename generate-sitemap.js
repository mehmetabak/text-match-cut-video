import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const toAbsolute = (p) => path.resolve(__dirname, p)

const BASE_URL = process.env.SITE_BASE_URL || 'https://animationmaker.m0s.space'
const urls = [
  '/', 
  '/tools',
  '/pricing',
  '/effects/ken-burns',
  '/effects/vhs-tape',
  '/match-cut'
]

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${BASE_URL}${u}</loc></url>`).join('\n')}
</urlset>`

fs.writeFileSync(toAbsolute('./dist/sitemap.xml'), xml)
console.log('sitemap.xml generated.')
