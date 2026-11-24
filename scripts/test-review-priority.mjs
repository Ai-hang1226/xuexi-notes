import assert from 'node:assert/strict'
import fs from 'node:fs'
import { countCleanCorrectStreak } from '../retest/review-priority-logic.mjs'

const clean = (finishedAt) => ({ isCorrect: true, isUncertain: false, isSlow: false, finishedAt })
const previous = [clean('2026-11-20T02:00:00Z'), clean('2026-11-21T02:00:00Z')]
assert.equal(countCleanCorrectStreak(previous, '2026-11-23'), 0, '旧答对不能掩盖后来的复盘')
assert.equal(countCleanCorrectStreak(previous), 2, '没有新复盘时保留既有行为')
assert.equal(countCleanCorrectStreak([clean('2026-11-23T15:59:00Z')], '2026-11-23'), 0, '复盘同日无法判断前后')
assert.equal(countCleanCorrectStreak([clean('2026-11-23T16:01:00Z')], '2026-11-23'), 1, '按北京时间进入次日')
assert.equal(countCleanCorrectStreak([...previous, clean('2026-11-24T03:00:00Z'), clean('2026-11-25T03:00:00Z')], '2026-11-23'), 2, '新复盘后连续两次才退出')
assert.equal(countCleanCorrectStreak([clean('2026-11-24T03:00:00Z'), { ...clean('2026-11-25T03:00:00Z'), isUncertain: true }], '2026-11-23'), 0, '不确定不能算连续答对')
assert.equal(countCleanCorrectStreak([clean('2026-11-24T03:00:00Z'), { ...clean('2026-11-25T03:00:00Z'), isSlow: true }], '2026-11-23'), 0, '超时不能算连续答对')
assert.equal(countCleanCorrectStreak([clean('')], '2026-11-23'), 0, '缺少时间不推定先后')
const records = JSON.parse(fs.readFileSync(new URL('../retest/review-priority.json', import.meta.url), 'utf8'))
for (const id of ['q116', 'q119', 'q120', 'review-cd0ff8af0924d40d']) {
  assert.ok((records.questions.find((q) => q.id === id)?.reenteredReviewDate || '') >= '2026-11-23', `${id} 最近复盘日期`)
}
console.log('优先复测检查通过：旧答对不会覆盖新复盘，历史记录与北京时间边界保留。')
