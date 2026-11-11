// 数据一致性守卫：防止看板与原始笔记脱节、进度被手工改回失真值。
// 运行：node scripts/check-data.mjs   （失败时退出码 1，供 CI 使用）
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')
const json = (p) => JSON.parse(read(p))
const d = json('data/dashboard.json')
const updates = json('data/updates.json')
const questions = json('cuotiben/review-catalog.json')
const source = read('data/updates-source.md')
const chapter = read('xingce/言语体系章节导航.md')
const course = read('xingce/大宝小宝言语体系-正文.md')

const failures = []
const ok = []
const eq = (label, a, b) => (a === b ? ok.push(`${label}: ${a}`) : failures.push(`${label}: 期望 ${b}，实际 ${a}`))
const check = (label, cond, detail = '') => (cond ? ok.push(label) : failures.push(`${label} — ${detail}`))

// 1. 更新记录三处同源
const sourceLines = source.split('\n').filter((l) => /^- `\d{4}-\d{2}-\d{2}`/.test(l)).length
eq('更新记录 · 数据源行数 = updates.json 条数', updates.length, sourceLines)
eq('更新记录 · dashboard.updates.total = updates.json 条数', d.updates.total, updates.length)

// 2. 错题目录与看板总数
eq('错题目录 · review-catalog.json = dashboard.questions.total', questions.length, d.questions.total)

// 3. 五模块沉淀之和应等于错题总数（归档映射无遗漏）
const sumDepth = d.modules.reduce((s, m) => s + m.沉淀, 0)
eq('模块沉淀之和 = 错题总数', sumDepth, d.questions.total)

// 4. 进度必须由沉淀量推导，不允许手填失真值
const maxDepth = Math.max(...d.modules.map((m) => m.沉淀))
for (const m of d.modules) {
  const expected = Math.round((m.沉淀 / maxDepth) * 100)
  eq(`沉淀度 · ${m.name}`, m.progress, expected)
}

// 5. 复测状态计数自洽
eq('复测 · 总数 = 已完成 + 待执行 + 需重试', d.retests.total, d.retests.done + d.retests.pending + d.retests.needsRetry)

// 6. 全站通用章节导航与源页面同步（数据来自 section-nav.json，由 gen-section-nav.mjs 生成）
const nav = json('data/section-nav.json')
const chapters = json('data/chapters.json')
const courseChapters = (course.match(/^# 第.+章/gm) || []).length
eq('通用导航 · 言语章数 = 正文章节数', nav.sections.yanyu.chapters.length, courseChapters)
eq('通用导航 · chapters.json 与言语章节一致', chapters.length, nav.sections.yanyu.chapters.length)
check('通用导航 · 言语页使用 ChapterNav 组件', /<ChapterNav\s*\/>/.test(chapter), '言语导航页缺少 <ChapterNav />')
check('通用导航 · 正文已降权出搜索索引', /search: false/.test(course.slice(0, 200)), '正文 frontmatter 缺少 search: false')

for (const [key, sec] of Object.entries(nav.sections)) {
  const label = `通用导航 · ${key}`
  check(`${label} 有章节`, sec.chapters.length > 0, '章节数组为空')
  check(`${label} 每章有标题与链接`, sec.chapters.every((c) => c.title && c.link), '存在缺标题或缺链接的章节')
  check(`${label} 锚点格式合法`, sec.chapters.every((c) => !c.anchor || !/[\s{}]/.test(c.anchor)), '存在含空格或花括号的锚点')
  check(`${label} 导航页存在且含组件`, fs.existsSync(path.join(root, sec.page)) &&
    /<SectionNav\s+section=|<ChapterNav\s*\/>/.test(fs.readFileSync(path.join(root, sec.page), 'utf8')), '导航页缺失或未引用组件')
  if (sec.sourceFile) {
    const src = read(sec.sourceFile)
    check(`${label} 章名来自源页面`, sec.chapters.every((c) => src.includes(c.title)), '存在与源页面对不上的章节标题')
  }
}

// 7. 章节正文页（含多个 h1，h1 即「第X章」）必须在目录配置里把 h1 纳入并打上 pageClass，
//    否则右侧「本页目录」会把重复的页面主标题当第一项、且章级标题不显示。
const SKIP_DIRS = new Set(['node_modules', '.git', '.vitepress', 'public', 'data', 'scripts', 'dist', '.shots'])
const mdFiles = []
;(function walk(dir) {
  for (const name of fs.readdirSync(path.join(root, dir))) {
    const rel = dir ? `${dir}/${name}` : name
    if (fs.statSync(path.join(root, rel)).isDirectory()) {
      if (!SKIP_DIRS.has(name) && !name.startsWith('dist-') && !name.startsWith('.temp')) walk(rel)
    } else if (name.endsWith('.md')) mdFiles.push(rel)
  }
})('')
const chapteredPages = mdFiles.filter((f) => {
  const text = fs.readFileSync(path.join(root, f), 'utf8')
  const body = text.startsWith('---') ? text.split('---').slice(2).join('---') : text
  return (body.match(/^#\s+.+$/gm) || []).length >= 2
})
for (const f of chapteredPages) {
  const text = fs.readFileSync(path.join(root, f), 'utf8')
  check(`章节正文目录 ${f} · outline 含 h1`, /^outline:[ \t]*\[[ \t]*1[ \t]*,/m.test(text), '缺少 outline:[1,x]，章级标题不会进目录')
  check(`章节正文目录 ${f} · 已标记 pageClass`, /^pageClass:\s*chaptered/m.test(text), '缺少 pageClass:chaptered，重复的页面主标题会占目录首项')
}

console.log(`通过 ${ok.length} 项：`)
ok.forEach((x) => console.log('  ✓ ' + x))
if (failures.length) {
  console.log(`\n失败 ${failures.length} 项：`)
  failures.forEach((x) => console.log('  ✗ ' + x))
  process.exit(1)
}
console.log('\n数据一致性校验通过')
