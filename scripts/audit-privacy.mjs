// 私人记录清单：列出含本人作答、真实用时、自述状态等不适合直接对外传播的页面。
// 只生成报告，不修改、不隐藏任何页面（可见性策略由站主决定）。
// 运行：node scripts/audit-privacy.mjs
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const markers = ['本人首答', '真实用时', '本人自述', '学习性评分', '原卷成绩', '蒙选', '走神', '首次提交']
const dirs = ['daily-quizzes', 'cuotiben', 'shenlun', 'guide', 'share']

const hits = []
for (const dir of dirs) {
  const abs = path.join(root, dir)
  if (!fs.existsSync(abs)) continue
  for (const name of fs.readdirSync(abs)) {
    if (!name.endsWith('.md')) continue
    const p = path.join(abs, name)
    const text = fs.readFileSync(p, 'utf8')
    const found = markers.filter((m) => text.includes(m))
    if (!found.length) continue
    hits.push({
      path: '/' + (dir + '/' + name.replace(/\.md$/, '')).replace(/\/index$/, ''),
      markers: found,
      searchable: !/search: false/.test(text.slice(0, 300)),
    })
  }
}

const report = {
  generatedAt: new Date().toISOString().slice(0, 10),
  total: hits.length,
  searchable: hits.filter((h) => h.searchable).length,
  note: '仅清单，未改动任何页面；可见性策略（visibility / 构建时排除）由站主决定',
  pages: hits.sort((a, b) => a.path.localeCompare(b.path)),
}
const out = path.join(root, 'data/privacy-report.json')
fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n')
console.log(`私人记录页 ${report.total} 个，其中仍可被站内搜索 ${report.searchable} 个`)
console.log('报告：' + path.relative(root, out))
