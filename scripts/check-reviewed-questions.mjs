import fs from 'node:fs'
import path from 'node:path'

// Every newly archived review must either be usable for practice or have an
// explicit, evidence-based reason for deferral. This check runs after both banks
// are built and never fabricates missing questions or answers.
const root = process.cwd()
const read = (name) => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'))
const records = read('retest/reviewed-questions.json')
const reviews = read('cuotiben/review-catalog.json')
const bank = read('retest/questions.json').questions
const catalogue = read('retest/full-catalog.json').entries
const priority = read('retest/review-priority.json')
const problems = []
const expected = [...records.questions.map((q) => ({ ...q, questionId: q.id })), ...records.existingLinks]
const deferred = new Map((records.deferred || []).map((item) => [item.reviewUrl, item.reason]))
const priorityTypes = new Set(['错题', '猜题', '不确定', '耗时较长'])
const recent = reviews.filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.date || '')
  && row.date >= '2026-11-23' && !row.types?.includes('未作答') && !row.types?.includes('待复盘'))
for (const item of recent) {
  const matches = catalogue.filter((entry) => entry.sources?.some((source) => source.url === item.url))
  const usable = matches.filter((entry) => entry.status === '可自动判分' && bank.some((q) => q.id === entry.quizId))
  if (usable.length !== 1 && !String(deferred.get(item.url) || '').trim()) {
    problems.push(`${item.id}: 需接入一个可判分题目，或明确记录待核原因`)
  }
  if (usable.length === 1 && item.types?.some((type) => priorityTypes.has(type))
      && !priority.questions.some((q) => q.id === usable[0].quizId && q.reviewUrls.includes(item.url))) {
    problems.push(`${item.id}: 未进入对应的优先复测关联`)
  }
}
for (const item of expected) {
  const q = bank.find((row) => row.id === item.questionId)
  const matches = catalogue.filter((entry) => entry.quizId === item.questionId
    && entry.sources?.some((source) => source.url === item.reviewUrl))
  if (!q || q.correct !== item.correct || q.options?.map((o) => o.label).join('') !== 'ABCD'
      || q.options.some((o) => !String(o.html || '').trim()) || !String(q.stemHtml || '').trim()) {
    problems.push(`${item.questionId}: 题干、选项或答案不完整`)
  }
  if (item.materialKey && (!q?.materialTitle || !String(q?.materialHtml || '').trim())) {
    problems.push(`${item.questionId}: 原题材料缺失`)
  }
  if (matches.length !== 1) problems.push(`${item.questionId}: 复盘关联不唯一`)
}
for (const [url, reason] of deferred) {
  if (!reviews.some((row) => row.url === url) || !String(reason || '').trim()) problems.push(`${url}: 待核记录缺少有效来源或原因`)
}
if (problems.length) throw new Error('复盘题库检查未通过：\n' + problems.join('\n'))
console.log(`复盘题库检查通过：${recent.length} 条近期复盘已接入或有明确待核原因；${expected.length} 条新题及旧题关联完整。`)