import puppeteer from 'puppeteer-core'
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'] })
const base = 'http://localhost:5174/xuexi-notes'
const out = 'C:/Users/Administrator/WorkBuddy/2026-11-10-21-07-43/xuexi-notes-redesign/.shots/'
const shots = [
  ['look-cover', '/', 1400, 1000, null],
  ['look-cover-mobile', '/', 390, 844, null],
  ['look-quickbar', '/', 1400, 1000, '.db-quickbar'],
  ['look-links', '/share/data-analysis-7-mistakes', 1400, 1000, '.lc'],
  ['look-links-mobile', '/share/data-analysis-7-mistakes', 390, 844, '.lc'],
  ['look-article-top', '/share/data-analysis-7-mistakes', 1400, 1000, null],
  ['look-chapters', '/xingce/言语体系章节导航', 1400, 1000, '.cn__list'],
  ['look-chapters-top', '/xingce/言语体系章节导航', 1400, 1000, null],
  ['look-chapters-mobile', '/xingce/言语体系章节导航', 390, 844, '.cn__list'],
  ['nav-yanyu', '/xingce/言语体系章节导航', 1400, 1000, null],
  ['nav-shuliang', '/xingce/数量关系章节导航', 1400, 1000, null],
  ['nav-panduan', '/xingce/判断推理章节导航', 1400, 1000, null],
  ['nav-ziliao', '/xingce/资料分析章节导航', 1400, 1000, null],
  ['nav-changshi', '/xingce/常识判断章节导航', 1400, 1000, null],
  ['nav-shenlun', '/shenlun/五大题型导航', 1400, 1000, null],
  ['nav-mobile', '/xingce/数量关系章节导航', 390, 844, '.cn__list'],
  ['look-share-index', '/share/', 1400, 1000, null],
  ['look-help', '/guide/help', 1400, 1000, null],
  ['final-cards', '/daily-quizzes/2026-11-07-xingce-135-review', 1400, 1000, '.vc__grid'],
]
for (const [name, path, w, h, sel] of shots) {
  const p = await b.newPage()
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 1 })
  await p.goto(base + path, { waitUntil: 'networkidle0', timeout: 30000 })
  if (sel) {
    const el = await p.$(sel)
    if (el) { await el.evaluate((e) => e.scrollIntoView({ block: 'center' })); await new Promise((r) => setTimeout(r, 300)) }
  }
  await p.screenshot({ path: out + name + '.png' })
  console.log(name, 'OK')
  await p.close()
}
await b.close()
