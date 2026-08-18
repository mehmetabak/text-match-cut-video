import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const toAbsolute = (p) => path.resolve(__dirname, p)

async function build() {
  const template = fs.readFileSync(toAbsolute('dist/index.html'), 'utf-8')
  const { render } = await import('./dist-server/entry-server.js')

  const routesToPrerender = [
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
    '/terms',
    '/privacy',
    '/cookies',
    '/refund'
  ]

  for (const url of routesToPrerender) {
    try {
      const { appHtml, helmetContext } = render(url)
      
      let html = template.replace('<!--app-html-->', appHtml)
      
      if (helmetContext && helmetContext.helmet) {
        const headHtml = `
          ${helmetContext.helmet.title.toString()}
          ${helmetContext.helmet.meta.toString()}
          ${helmetContext.helmet.link.toString()}
          ${helmetContext.helmet.script.toString()}
        `
        html = html.replace('<!--app-head-->', headHtml)
      }
      
      const filePath = url === '/' ? 'dist/index.html' : `dist${url}/index.html`
      fs.mkdirSync(path.dirname(toAbsolute(filePath)), { recursive: true })
      fs.writeFileSync(toAbsolute(filePath), html)
      console.log(`pre-rendered: ${url}`)
    } catch (err) {
      console.error(`Error pre-rendering ${url}:`, err)
    }
  }
}

build().then(() => {
  console.log('Prerendering completed.')
  try {
    fs.rmSync(toAbsolute('dist-server'), { recursive: true, force: true })
  } catch(e) {}
}).catch(err => {
  console.error('Prerendering failed:', err)
  process.exit(1)
})
