// 从原始笔记生成首页看板数据，避免手填进度与实际内容脱节。
// 运行：node scripts/build-dashboard.mjs
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')
const write = (p, data) => {
  const full = path.join(root, p)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, JSON.stringify(data, null, 2) + '\n')
}

const questions = JSON.parse(read('cuotiben/review-catalog.json'))
const generatedAt = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date())

// ---------- 更新记录：从首页原文抽取，供首页与更新日志共用 ----------
const updateSource = read('data/updates-source.md')
const updateLines = updateSource.split('\n').filter((l) => /^- `\d{4}-\d{2}-\d{2}`/.test(l))
const moduleOf = (text) => {
  if (/申论/.test(text)) return { tag: '申论', tone: 'shenlun' }
  if (/测验|试卷|每日/.test(text)) return { tag: '每日测验', tone: 'quiz' }
  if (/图解|全站大字|打印讲义/.test(text)) return { tag: '工具', tone: 'tool' }
  if (/图形推理|图推/.test(text)) return { tag: '图形推理', tone: 'judge' }
  if (/类比/.test(text)) return { tag: '类比推理', tone: 'judge' }
  if (/定义判断/.test(text)) return { tag: '定义判断', tone: 'judge' }
  if (/逻辑判断/.test(text)) return { tag: '逻辑判断', tone: 'judge' }
  if (/判断推理/.test(text)) return { tag: '判断推理', tone: 'judge' }
  if (/言语/.test(text)) return { tag: '言语理解', tone: 'verbal' }
  if (/数量/.test(text)) return { tag: '数量关系', tone: 'math' }
  if (/资料/.test(text)) return { tag: '资料分析', tone: 'data' }
  if (/政治理论|党的创新理论|时政|二十届三中全会|十五五/.test(text)) return { tag: '政治理论', tone: 'common' }
  if (/常识/.test(text)) return { tag: '常识判断', tone: 'common' }
  return { tag: '综合', tone: 'tool' }
}
const updates = updateLines.map((line) => {
  const date = line.match(/^- `(\d{4}-\d{2}-\d{2})`/)[1]
  const links = [...line.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)].map((m) => ({ text: m[1], url: m[2] }))
  const plain = line
    .replace(/^- `\d{4}-\d{2}-\d{2}`\s*/, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[`*_]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  const tagSource = links[0]?.text || plain
  return { date, title: links[0]?.text || plain.slice(0, 18), links, summary: plain, ...moduleOf(tagSource) }
})

// ---------- 测验与复测 ----------
const quizArchive = JSON.parse(read('daily-quizzes/archive-data.json'))
const quizzes = quizArchive.months.flatMap((month) => month.records.map((record) => ({
  date: record.date,
  status: record.detail ? `${record.status} · ${record.detail}` : record.status,
  testUrl: record.links.find(([label]) => label === '试卷')?.[1] || '',
  reviewUrl: record.links.find(([label]) => label === '结果与解析')?.[1] || '',
}))).sort((a, b) => b.date.localeCompare(a.date))
const quizMd = read('daily-quizzes/index.md')
const section = (name, next) => quizMd.split(`## ${name}`)[1]?.split(`## ${next}`)[0] || ''
const retestRows = section('复测安排', '交流体验').split('\n').filter((l) => /^\| \d{4}-\d{2}-\d{2} \|/.test(l))
const retests = retestRows.map((l) => {
  const c = l.split('|').map((s) => s.trim())
  return { date: c[1], task: c[2], status: c[3] }
}).sort((a, b) => a.date.localeCompare(b.date))
const isDone = (s) => /已验证/.test(s)
const isPending = (s) => /待作答|待复测/.test(s)
const needsRetry = (s) => /未通过|不稳/.test(s)

// ---------- 申论首答基线 ----------
const slMd = read('shenlun/scores.md')
const slRows = slMd.split('## 我的申论进步记录')[1]?.split('###')[0]?.split('\n').filter((l) => /^\| \[DAY\d/.test(l)) || []
const shenlun = slRows.map((l) => {
  const c = l.split('|').map((s) => s.trim())
  const name = c[1].replace(/\[([^\]]+)\]\([^)]+\)/, '$1')
  const score = c[2].match(/([\d.]+)／(\d+)/)
  return { name, score: Number(score?.[1] || 0), max: Number(score?.[2] || 0) }
})

// ---------- 模块：进度不再手填，全部由错题目录的沉淀量推导 ----------
// 口径：沉淀度 = 本模块归档复盘条数 ÷ 全模块最大值；分档与颜色按同一规则生成。
// 它表示「内容沉淀量」，不代表掌握程度或考试得分率。
const moduleMeta = [
  { name: '言语理解', link: '/xingce/yanyu-lijie', icon: '🗣️' },
  { name: '数量关系', link: '/xingce/shuliang-guanxi', icon: '🔢' },
  { name: '判断推理', link: '/xingce/panduan-tuili', icon: '🧩' },
  { name: '资料分析', link: '/xingce/ziliao-fenxi', icon: '📊' },
  { name: '政治理论', link: '/xingce/zhengzhi-lilun', icon: '🚩' },
  { name: '常识判断', link: '/xingce/changshi-panduan', icon: '🌍' },
]
const moduleNames = ['言语理解', '数量关系', '图形推理', '定义判断', '类比推理', '逻辑判断', '资料分析', '常识判断', '政治理论']
const byModule = Object.fromEntries(moduleNames.map((n) => [n, questions.filter((q) => q.module === n).length]))
const moduleGroups = {
  言语理解: ['言语理解'],
  数量关系: ['数量关系'],
  判断推理: ['图形推理', '定义判断', '类比推理', '逻辑判断'],
  资料分析: ['资料分析'],
  // 政治理论自 2025 年起从常识判断中单列，两块分开统计
  政治理论: ['政治理论'],
  常识判断: ['常识判断'],
}
const modules = moduleMeta.map((m) => ({
  ...m,
  沉淀: moduleGroups[m.name].reduce((s, n) => s + byModule[n], 0),
}))
const maxDepth = Math.max(...modules.map((m) => m.沉淀))
const statusOf = { done: '沉淀最多', mid: '持续沉淀', start: '已有积累', todo: '待积累' }
for (const m of modules) {
  m.progress = Math.round((m.沉淀 / maxDepth) * 100)
  m.tone = m.progress >= 90 ? 'done' : m.progress >= 50 ? 'mid' : m.progress >= 25 ? 'start' : 'todo'
  m.status = statusOf[m.tone]
}

const byType = {}
for (const q of questions) for (const t of q.types) byType[t] = (byType[t] || 0) + 1

const dashboard = {
  generatedAt,
  streak: { since: '2026-06-05', days: Math.round((new Date('2026-11-10') - new Date('2026-06-05')) / 86400000) },
  questions: {
    total: questions.length,
    byType,
    byModule,
    pendingVerification: questions.filter((q) => /待验证|未验证|独立迁移/.test(q.note || '')).length,
    awaitingReview: byType['待复盘'] || 0,
  },
  quizzes: {
    total: quizzes.length,
    latest: quizzes[0] || null,
    reviewed: quizzes.filter((q) => /已批改/.test(q.status)).length,
    pending: quizzes.filter((q) => /待作答/.test(q.status)).length,
    rest: quizzes.filter((q) => /休息|未作答/.test(q.status)).length,
    assessments: 2,
  },
  retests: {
    total: retests.length,
    done: retests.filter((r) => isDone(r.status)).length,
    pending: retests.filter((r) => isPending(r.status)).length,
    needsRetry: retests.filter((r) => needsRetry(r.status)).length,
    list: retests.slice(0, 8),
  },
  shenlun: { baselines: shenlun, rewrites: 0, transfers: 0 },
  updates: { total: updates.length },
  modules,
}

write('data/dashboard.json', dashboard)
write('data/updates.json', updates)
console.log(`已生成 data/dashboard.json（${updates.length} 条更新 / ${questions.length} 条错题 / ${retests.length} 条复测）`)
console.log(`测验 ${quizzes.length} 份：已批改 ${dashboard.quizzes.reviewed}，待作答 ${dashboard.quizzes.pending}`)
console.log('模块沉淀：', modules.map((m) => `${m.name} ${m.沉淀}`).join(' · '))
