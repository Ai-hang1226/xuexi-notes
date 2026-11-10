// 核对侧栏链接与页面文件：找出失效链接与未进侧栏的页面。
// 运行：node scripts/check-links.mjs
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const cfg = fs.readFileSync(path.join(root, '.vitepress/config.mjs'), 'utf8')
const quizSidebar = fs.readFileSync(path.join(root, 'daily-quizzes/sidebar.json'), 'utf8')
const linkRe = /\blink\s*:\s*['"]([^'"]+)['"]/g
const jsonLinkRe = /"link"\s*:\s*"([^"]+)"/g
// 识别 config 里用变量拼接的链接，例如 const kiwi='/shenlun/kiwi-framework' + `${kiwi}#锚点`
const varDefs = new Map()
for (const m of cfg.matchAll(/const\s+(\w+)\s*=\s*['"]([^'"]+)['"]/g)) varDefs.set(m[1], m[2])
const resolveVars = (u) => u.replace(/\$\{(\w+)\}/g, (_, k) => varDefs.get(k) || '')

const links = [
  ...[...cfg.matchAll(linkRe)].map((m) => m[1]),
  ...[...quizSidebar.matchAll(jsonLinkRe)].map((m) => m[1]),
].map(resolveVars).filter((u) => /^\//.test(u)) // 只校验站内链接，外链交给构建与人工

// 统一用「相对 root 的正斜杠路径」作为页面 URL
const pages = new Set()
const walk = (rel, skip = []) => {
  const abs = path.join(root, rel)
  if (!fs.existsSync(abs)) return
  for (const name of fs.readdirSync(abs)) {
    const relChild = rel === '.' ? name : `${rel}/${name}`
    const absChild = path.join(root, relChild)
    if (fs.statSync(absChild).isDirectory()) {
      if (!skip.includes(name)) walk(relChild, skip)
    } else {
      const url = '/' + relChild.replace(/\\/g, '/')
      if (name.endsWith('.md')) {
        const bare = url.replace(/\.md$/, '')
        pages.add(bare.endsWith('/index') ? bare.slice(0, -6) || '/' : bare)
      } else if (rel.startsWith('public')) {
        pages.add(url.replace(/^\/public/, ''))
      }
    }
  }
}
walk('public')
walk('.', ['node_modules', '.git', '.vitepress', 'public', 'data', 'scripts', 'memory'])

const normalized = (u) => u.split('#')[0].split('?')[0].replace(/\/$/, '') || '/'
const exists = (u) => pages.has(u) || pages.has(u + '/index') || pages.has(u + '.html')

const bad = [...new Set(links)].filter((u) => !exists(normalized(u)))
console.log(`侧栏链接 ${links.length} 条，去重 ${new Set(links).size} 条`)
console.log(`失效链接 ${bad.length} 条：`)
bad.forEach((u) => console.log('  ' + u))

const mdPages = [...pages].filter((p) => !p.endsWith('.html') && !p.endsWith('.svg') && !p.endsWith('.png'))
const missing = mdPages
  .filter((p) => !links.some((l) => normalized(l) === p))
  .filter((p) => !/^\/(AGENTS|CLAUDE|MEMORY|扩展演示-)/.test(p) && p !== '/')
  .sort()
console.log(`\n未进侧栏的 md 页面（${missing.length} 条）：`)
missing.forEach((p) => console.log('  ' + p))
