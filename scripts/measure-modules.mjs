import puppeteer from 'puppeteer-core'
const chrome = process.env.CHROME_PATH ||
  (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : '/usr/bin/google-chrome')
const b = await puppeteer.launch({ executablePath: chrome, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] })
const p = await b.newPage()
await p.setViewport({ width: 1400, height: 1000 })
await p.goto('http://localhost:5174/xuexi-notes/', { waitUntil: 'networkidle0' })
const r = await p.evaluate(() => {
  const card = document.querySelector('.db-module')
  const pick = (el) => el ? { w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height), sw: el.scrollWidth, cw: el.clientWidth } : null
  const meta = card.querySelector('.db-module__meta')
  const first = meta.querySelector('div')
  const small = meta.querySelector('small')
  const cs = (el) => { const s = getComputedStyle(el); return { display: s.display, flex: s.flex, minWidth: s.minWidth, width: s.width, fontSize: s.fontSize } }
  return {
    card: pick(card), mid: pick(card.querySelector('.db-module__mid')),
    ring: pick(card.querySelector('.db-ring')), meta: pick(meta),
    metaStyle: cs(meta), first: pick(first), firstStyle: cs(first),
    firstB: pick(first.querySelector('b')), firstSpan: pick(first.querySelector('span')),
    small: pick(small), smallText: small?.textContent,
    mini: pick(meta.querySelector('.db-module__mini')),
  }
})
console.log(JSON.stringify(r, null, 2))
await b.close()
