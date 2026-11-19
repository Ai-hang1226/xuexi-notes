export function createQuestionClock(isActive = () => true) {
  let accumulatedMs = {}
  let firstStartedAt = {}
  let activeQuestionId = ''
  let activeSince = 0

  function flush() {
    if (!activeQuestionId || !activeSince) return
    const elapsed = Math.max(0, Date.now() - activeSince)
    accumulatedMs[activeQuestionId] = (accumulatedMs[activeQuestionId] || 0) + elapsed
    activeSince = 0
  }

  function resume() {
    if (activeQuestionId && !activeSince && isActive()) activeSince = Date.now()
  }

  return {
    reset() {
      flush()
      accumulatedMs = {}
      firstStartedAt = {}
      activeQuestionId = ''
      activeSince = 0
    },
    select(questionId) {
      flush()
      activeQuestionId = questionId || ''
      if (activeQuestionId && !firstStartedAt[activeQuestionId]) firstStartedAt[activeQuestionId] = Date.now()
      resume()
    },
    pause() {
      flush()
    },
    resume,
    elapsedMs(questionId, now = Date.now()) {
      const activeElapsed = activeQuestionId === questionId && activeSince
        ? Math.max(0, now - activeSince)
        : 0
      return (accumulatedMs[questionId] || 0) + activeElapsed
    },
    snapshot() {
      flush()
      return { ...accumulatedMs }
    },
    startedAt(questionId) {
      return firstStartedAt[questionId] || 0
    },
  }
}
