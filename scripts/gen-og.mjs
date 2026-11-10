// 生成分享封面 og-cover.png（1200×630），供微信 / 小红书 / 微博抓取。
// 运行：node scripts/gen-og.mjs
import puppeteer from 'puppeteer-core'
import path from 'node:path'

const out = path.resolve('public/og-cover.png')
const chrome = process.env.CHROME_PATH ||
  (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : '/usr/bin/google-chrome')

const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:1200px;height:630px;font-family:"Microsoft YaHei","PingFang SC",sans-serif;
 background:linear-gradient(135deg,#eef0ff 0%,#f7f8ff 48%,#e8ecff 100%);position:relative;overflow:hidden}
.grid{position:absolute;inset:0;background-image:linear-gradient(rgba(79,70,229,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(79,70,229,.05) 1px,transparent 1px);background-size:32px 32px}
.card{position:absolute;left:70px;top:64px;width:1060px;height:502px;background:#fff;border:1px solid #dfe1f5;border-radius:28px;box-shadow:0 24px 60px rgba(60,60,140,.12);padding:52px 58px}
.eyebrow{display:inline-flex;align-items:center;gap:10px;padding:8px 16px;border:1px solid #cfd3f5;border-radius:999px;color:#4f46e5;font-size:17px;font-weight:700;letter-spacing:.04em}
.dot{width:9px;height:9px;border-radius:50%;background:#4f46e5}
h1{font-size:64px;color:#1f2540;letter-spacing:-.02em;margin-top:26px;line-height:1.2}
.sub{font-size:25px;color:#555e77;margin-top:14px}
h2{font-size:34px;color:#4338ca;margin-top:34px;line-height:1.4}
.chips{display:flex;gap:12px;margin-top:30px}
.chip{padding:10px 18px;border:1px solid #dfe1f5;border-radius:12px;background:#f7f8ff;color:#3730a3;font-size:19px;font-weight:700}
.foot{position:absolute;left:58px;bottom:36px;color:#7b8199;font-size:17px}
.badge{position:absolute;right:58px;bottom:36px;color:#4f46e5;font-size:17px;font-weight:700}
</style></head><body>
<div class="grid"></div>
<div class="card">
  <div class="eyebrow"><span class="dot"></span> GONGKAO KNOWLEDGE BASE</div>
  <h1>考公知识库</h1>
  <div class="sub">行测 · 申论 · 每日测验 · 错题复盘</div>
  <h2>把每一次做题，都变成可复用的知识资产</h2>
  <div class="chips"><span class="chip">言语理解</span><span class="chip">数量关系</span><span class="chip">判断推理</span><span class="chip">资料分析</span><span class="chip">常识判断</span></div>
  <div class="foot">个人备考笔记 · 体系化归档 · 逐题复盘</div>
  <div class="badge">ai-hang1226.github.io / xuexi-notes</div>
</div>
</body></html>`

const browser = await puppeteer.launch({ executablePath: chrome, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] })
const page = await browser.newPage()
await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 })
await page.setContent(html, { waitUntil: 'networkidle0' })
await page.screenshot({ path: out })
await browser.close()
console.log('已生成 ' + out)
