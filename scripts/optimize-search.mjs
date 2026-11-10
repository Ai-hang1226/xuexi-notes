// 搜索索引瘦身：给「低检索价值的大页」加 frontmatter search: false。
// 依据 VitePress 源码：md.render 后判断 env.frontmatter?.search === false 则跳过索引。
// 运行：node scripts/optimize-search.mjs           （应用）
//       node scripts/optimize-search.mjs --restore （还原，移除本脚本加的标记）
// 规则只排除原卷/首答/原材料/归档；方法库、复盘、速查、索引一律保留可搜。
// 兼容 CRLF / LF 换行与 BOM；不改动原 frontmatter 的任何字段。
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const restore = process.argv.includes('--restore')
const MARK = 'search: false # 由 scripts/optimize-search.mjs 管理'

const rules = [
  /^daily-quizzes\/.*-answer\.md$/,
  /^daily-quizzes\/2026-11-07-xingce-135\.md$/,
  /^daily-quizzes\/2026-10-24-trial\.md$/,
  /^shenlun\/sources\/.*\.md$/,
  /^cuotiben\/xingce-cuoti\.md$/,
  /^cuotiben\/归档历史\.md$/,
  /^xingce\/大宝小宝言语体系-正文\.md$/, // 519KB 正文，改由「言语体系章节导航」承载检索
]
const shouldExclude = (rel) => rules.some((r) => r.test(rel))

const files = []
const walk = (dir) => {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    if (fs.statSync(p).isDirectory()) {
      if (!['node_modules', '.git', '.vitepress', 'public', 'data', 'scripts', 'memory'].includes(name)) walk(p)
    } else if (name.endsWith('.md')) files.push(p)
  }
}
walk(root)

let changed = 0
for (const file of files) {
  const rel = path.relative(root, file).replace(/\\/g, '/')
  const raw = fs.readFileSync(file, 'utf8')
  const bom = raw.charCodeAt(0) === 0xfeff ? '\ufeff' : ''
  let src = bom ? raw.slice(1) : raw
  const eol = src.includes('\r\n') ? '\r\n' : '\n'

  if (restore) {
    const lines = src.split(eol)
    const idx = lines.findIndex((l) => l.trimEnd() === MARK)
    if (idx === -1) continue
    lines.splice(idx, 1)
    let out = lines.join(eol)
    // 若 frontmatter 块已空，移除整个空块
    out = out.replace(new RegExp(`^---${eol}---${eol}(${eol})?`), '')
    fs.writeFileSync(file, bom + out)
    changed++
    continue
  }

  if (!shouldExclude(rel) || src.includes('search: false')) continue

  const fm = src.match(/^---\r?\n([\s\S]*?)(\r?\n---(?:\r?\n|$))/)
  if (fm) {
    // fm[0] = 起始 --- + 内容 + 结束(\r?\n---\r?\n)；在内容末尾插入标记
    const insertAt = fm[0].length - fm[2].length
    src = src.slice(0, insertAt) + eol + MARK + src.slice(insertAt)
  } else {
    src = `---${eol}${MARK}${eol}---${eol}${eol}` + src
  }
  fs.writeFileSync(file, bom + src)
  changed++
}
console.log(`${restore ? '还原' : '应用'} search: false：${changed} 个文件`)
