import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const fullCatalog = JSON.parse(fs.readFileSync(path.join(root, 'retest', 'full-catalog.json'), 'utf8'))
const output = path.join(root, 'retest', 'essay-review.json')

// Only include questions with an existing first-answer record. This list is
// explicit so that merely appearing in the catalog never implies completion.
const completed = [
  { id: 'essay-day5-city-greening', answerUrl: '/shenlun/day5-city-greening', analysisUrl: '/shenlun/day5-city-greening', evidence: 'shenlun/day5-city-greening.md' },
  { id: 'essay-day6-business-environment', answerUrl: '/shenlun/day6-business-environment', analysisUrl: '/shenlun/day6-business-environment', evidence: 'shenlun/day6-business-environment.md' },
  { id: 'essay-day7-backpack-bank', answerUrl: '/shenlun/day7-backpack-bank', analysisUrl: '/shenlun/day7-backpack-bank', evidence: 'shenlun/day7-backpack-bank.md' },
  { id: 'essay-day8-public-services', answerUrl: '/shenlun/day8-public-services', analysisUrl: '/shenlun/day8-public-services', evidence: 'shenlun/day8-public-services.md' },
  { id: 'essay-day9-digital-city', answerUrl: '/shenlun/day9-digital-city', analysisUrl: '/shenlun/day9-digital-city', evidence: 'shenlun/day9-digital-city.md' },
  { id: 'site-74d48b9a2707edb0', answerUrl: '/daily-quizzes/2026-10-24-answer', analysisUrl: '/daily-quizzes/2026-10-24-review', evidence: 'daily-quizzes/2026-10-24-answer.md' },
  { id: 'site-0dcf7aab4abbcf12', answerUrl: '/daily-quizzes/2026-10-26-answer', analysisUrl: '/daily-quizzes/2026-10-26-review', evidence: 'daily-quizzes/2026-10-26-answer.md' },
  { id: 'site-70b59278f9a758ec', answerUrl: '/daily-quizzes/2026-10-28-answer', analysisUrl: '/daily-quizzes/2026-10-28-review', evidence: 'daily-quizzes/2026-10-28-answer.md' },
  { id: 'site-c61f5642b0718717', answerUrl: '/daily-quizzes/2026-11-02-answer', analysisUrl: '/daily-quizzes/2026-11-02-review', evidence: 'daily-quizzes/2026-11-02-answer.md' },
  { id: 'site-26b969300e77b03f', answerUrl: '/daily-quizzes/2026-11-04-jiangsu-a-assessment-answer', analysisUrl: '/daily-quizzes/2026-11-04-jiangsu-a-assessment-review', evidence: 'daily-quizzes/2026-11-04-jiangsu-a-assessment-answer.md' },
  { id: 'site-c5d19538c318473e', answerUrl: '/daily-quizzes/2026-11-06-answer', analysisUrl: '/daily-quizzes/2026-11-06-review', evidence: 'daily-quizzes/2026-11-06-answer.md' },
]

function pageFile(url) {
  const pathname = url.split('#')[0].replace(/^\//, '')
  if (!pathname || pathname.includes('..') || pathname.includes('\\')) throw new Error(`页面路径不安全：${url}`)
  return path.join(root, pathname.endsWith('.md') ? pathname : pathname + '.md')
}

const byId = new Map(fullCatalog.entries.map((entry) => [entry.id, entry]))
const essays = completed.map((record) => {
  const source = byId.get(record.id)
  if (!source || source.subject !== '申论' || !source.stemHtml?.trim()) {
    throw new Error(`已完成申论记录缺少完整题目内容：${record.id}`)
  }
  for (const url of [record.answerUrl, record.analysisUrl]) {
    if (!fs.existsSync(pageFile(url))) throw new Error(`申论复测引用页面不存在：${url}`)
  }
  if (!fs.existsSync(path.join(root, record.evidence))) throw new Error(`首答依据文件不存在：${record.evidence}`)
  return {
    id: source.id,
    title: source.title,
    source: source.source,
    sourceUrl: source.sourceUrl,
    excerpt: source.excerpt,
    stemHtml: source.stemHtml,
    options: [],
    category: source.id.startsWith('essay-day') ? '课程练习' : '已做测验',
    sourceKind: /自编/.test(source.source || '') ? '历史自编题' : '原卷/课程题',
    answerUrl: record.answerUrl,
    analysisUrl: record.analysisUrl,
    evidence: record.evidence,
  }
})

fs.writeFileSync(output, JSON.stringify({
  completedCount: essays.length,
  essays,
}, null, 2) + '\n', 'utf8')
console.log(`已生成 ${essays.length} 道有首答依据的申论复测题`)
console.log(path.relative(root, output))
