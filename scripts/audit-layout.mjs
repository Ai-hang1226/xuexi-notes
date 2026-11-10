// 用真实浏览器测量页面排版：溢出、重叠、卡片等高、步骤条对齐。
// 运行：node scripts/audit-layout.mjs
import puppeteer from 'puppeteer-core'

const BASE = process.env.SITE_BASE || 'http://localhost:5174/xuexi-notes'
const CHROME = process.env.CHROME_PATH ||
  (process.platform === 'win32'
    ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
    : '/usr/bin/google-chrome')
// 从构建产物自动枚举全部页面，确保「全部检测」而非只抽几页
import fs from 'node:fs'
import path from 'node:path'
const dist = path.resolve('.vitepress/dist')
const pages = []
const walk = (dir) => {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    if (fs.statSync(p).isDirectory()) walk(p)
    else if (name.endsWith('.html') && name !== '404.html') {
      let u = '/' + path.relative(dist, p).replace(/\\/g, '/').replace(/\.html$/, '')
      if (u.endsWith('/index')) u = u.slice(0, -6) || '/'
      pages.push(u)
    }
  }
}
walk(dist)
pages.sort()

// 通过环境变量控制视口：node scripts/audit-layout.mjs mobile
const mobile = process.argv.includes('mobile')
const VIEWPORT = mobile ? { width: 390, height: 844 } : { width: 1400, height: 1000 }
console.log(`视口 ${VIEWPORT.width}×${VIEWPORT.height}，共 ${pages.length} 个页面`)

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
})

const report = []
for (const path of pages) {
  const page = await browser.newPage()
  await page.setViewport({ ...VIEWPORT, deviceScaleFactor: 1 })
  await page.goto(BASE + path, { waitUntil: 'networkidle0', timeout: 30000 })
  const issues = await page.evaluate(() => {
    const out = []
    // 1. 真正造成「页面横向滚动」的元素：自身溢出，且没有可横向滚动的祖先容器
    //    （表格 .table-scroll、公式卡、可横滑 SVG 图属于设计内横滑，不算缺陷）
    const vw = document.documentElement.clientWidth
    const hasScrollableAncestor = (el) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const st = getComputedStyle(p)
        if ((st.overflowX === 'auto' || st.overflowX === 'scroll') && p.scrollWidth > p.clientWidth) return true
      }
      return false
    }
    for (const el of document.querySelectorAll('.vp-doc *, .vc *, .db *')) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      if ((r.right > vw + 2 || r.left < -2) && !hasScrollableAncestor(el)) {
        const name = typeof el.className === 'string' ? el.className : el.tagName
        out.push(`页面级横向溢出: ${name || el.tagName} left=${Math.round(r.left)} right=${Math.round(r.right)} vw=${vw}`)
      }
    }
    // 1b. 文档根是否真的出现横向滚动条（最终判据）
    if (document.documentElement.scrollWidth > vw + 2) {
      out.push(`⚠ 页面出现横向滚动: scrollWidth=${document.documentElement.scrollWidth} vw=${vw}`)
    }
    // 2. 文本被截断，或列宽过窄导致中文逐字竖排
    for (const el of document.querySelectorAll('.vc *, .db *')) {
      if (el.children.length) continue
      const st = getComputedStyle(el)
      const text = (el.textContent || '').trim()
      const r = el.getBoundingClientRect()
      if (st.textOverflow === 'ellipsis' || st.overflow === 'hidden') continue
      if (el.scrollWidth > el.clientWidth + 3 && el.clientWidth > 0) {
        out.push(`文本可能被截断: ${el.className || el.tagName} scrollW=${el.scrollWidth} clientW=${el.clientWidth} "${text.slice(0,30)}"`)
      }
      const lh = parseFloat(st.lineHeight) || parseFloat(st.fontSize) * 1.5
      if (text.length >= 4 && r.width > 0 && r.width < 60 && r.height > lh * 2.5) {
        out.push(`窄列文字挤压（疑似逐字换行）: ${el.className || el.tagName} w=${Math.round(r.width)} h=${Math.round(r.height)} "${text.slice(0,24)}"`)
      }
    }
    // 3. 卡片行等高检查
    const grids = document.querySelectorAll('.vc__grid, .db-today, .db-modules, .db-insights, .db-quad, .db-flow__steps')
    for (const g of grids) {
      const cards = [...g.children]
      if (cards.length < 2) continue
      // 只比较同一行（top 相同）的卡片，跨行高度不同是正常的
      const rows = new Map()
      cards.forEach((c) => {
        const top = Math.round(c.getBoundingClientRect().top)
        if (!rows.has(top)) rows.set(top, [])
        rows.get(top).push(c)
      })
      for (const [top, rowCards] of rows) {
        if (rowCards.length < 2) continue
        const label = rowCards[0]?.querySelector('.vc-card__title')?.textContent?.slice(0, 14) || g.className
        const heights = rowCards.map((c) => Math.round(c.getBoundingClientRect().height))
        if (Math.max(...heights) - Math.min(...heights) > 3) {
          out.push(`同行卡片不等高: [${label}] top=${top} 高度=[${heights.join(',')}]`)
        }
        // 同一行卡片的链接底部必须对齐
        const links = rowCards.map((c) => c.querySelector('.vc-card__link')).filter(Boolean)
        if (links.length > 1) {
          const bottoms = links.map((l) => Math.round(l.getBoundingClientRect().bottom))
          if (Math.max(...bottoms) - Math.min(...bottoms) > 3) {
            out.push(`同行卡片链接底部未对齐: [${label}] bottoms=[${bottoms.join(',')}]`)
          }
        }
      }
    }
    // 4. 步骤条：序号圆点左边缘、文字列左边缘必须逐项一致（真正的「对齐」检测）
    for (const ol of document.querySelectorAll('.vc-steps')) {
      const lis = [...ol.querySelectorAll('li')]
      if (lis.length < 2) continue
      const noLefts = lis.map((li) => Math.round(li.querySelector('.vc-steps__no')?.getBoundingClientRect().left ?? -1))
      const textLefts = lis.map((li) => Math.round(li.querySelector('.vc-steps__text')?.getBoundingClientRect().left ?? -1))
      if (Math.max(...noLefts) - Math.min(...noLefts) > 2) out.push(`步骤序号未左对齐: lefts=[${noLefts.join(',')}]`)
      if (Math.max(...textLefts) - Math.min(...textLefts) > 2) out.push(`步骤文字未左对齐: lefts=[${textLefts.join(',')}]`)
      // 步骤里若仍有 ::after 箭头，说明旧样式残留
      const arrows = lis.filter((li) => {
        const c = getComputedStyle(li, '::after').content
        return c && c !== 'none' && c !== 'normal'
      }).length
      if (arrows) out.push(`步骤条仍有 ${arrows} 个悬挂箭头`)
    }

    // 4b. 原/改框：徽章列左边缘必须一致，文字列左边缘必须一致
    for (const box of document.querySelectorAll('.vc-change')) {
      const rows = [...box.querySelectorAll('.vc-change__row')]
      if (rows.length < 2) continue
      const labelLefts = rows.map((r) => Math.round(r.querySelector('.vc-change__label')?.getBoundingClientRect().left ?? -1))
      const textLefts = rows.map((r) => Math.round(r.querySelector('.vc-change__text')?.getBoundingClientRect().left ?? -1))
      if (Math.max(...labelLefts) - Math.min(...labelLefts) > 2) out.push(`原/改徽章未对齐: [${labelLefts.join(',')}]`)
      if (Math.max(...textLefts) - Math.min(...textLefts) > 2) out.push(`原/改文字未对齐: [${textLefts.join(',')}]`)
    }
    // 5. 重叠检测：相邻卡片是否重叠
    const allCards = [...document.querySelectorAll('.vc-card, .db-module, .db-task, .db-card')]
    for (let i = 0; i < allCards.length; i++) {
      for (let j = i + 1; j < allCards.length; j++) {
        const a = allCards[i].getBoundingClientRect(), b = allCards[j].getBoundingClientRect()
        const overlap = Math.max(0, Math.min(a.right,b.right) - Math.max(a.left,b.left)) * Math.max(0, Math.min(a.bottom,b.bottom) - Math.max(a.top,b.top))
        if (overlap > 40) out.push(`卡片重叠: ${allCards[i].className} 与 ${allCards[j].className} 面积≈${Math.round(overlap)}`)
      }
    }
    return out
  })
  report.push({ path, issues })
  await page.close()
}

let totalIssues = 0
const badPages = []
for (const { path, issues } of report) {
  const real = issues.filter((i) => !i.startsWith('步骤条行'))
  if (!real.length) continue
  badPages.push(path)
  totalIssues += real.length
  console.log(`\n=== ${path} ===`)
  real.forEach((i) => console.log('  ⚠ ' + i))
}
console.log(`\n扫描 ${pages.length} 页，异常 ${totalIssues} 条，涉及 ${badPages.length} 页`)
await browser.close()
