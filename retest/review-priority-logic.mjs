const shanghaiDate = new Intl.DateTimeFormat('en', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
})

function dayInShanghai(value) {
  if (!value) return ''
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  const parts = Object.fromEntries(shanghaiDate.formatToParts(date).map(({ type, value: part }) => [type, part]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

// A repeat review with only a calendar date cannot be ordered against other
// attempts from that day. Keep their records but count clean attempts only
// from the following Shanghai day; old attempts must not hide a new review.
export function countCleanCorrectStreak(history, reenteredReviewDate = '') {
  const resetDate = /^\d{4}-\d{2}-\d{2}$/.test(reenteredReviewDate) ? reenteredReviewDate : ''
  let streak = 0
  for (let index = history.length - 1; index >= 0; index--) {
    const attempt = history[index]
    if (!attempt.isCorrect || attempt.isUncertain || attempt.isSlow) break
    if (resetDate) {
      const attemptDay = dayInShanghai(attempt.finishedAt)
      if (!attemptDay || attemptDay <= resetDate) break
    }
    streak++
  }
  return streak
}