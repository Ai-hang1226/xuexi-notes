<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { withBase } from 'vitepress'
import skillPool from './xingcezhenti-pool.json'
import RecordBackup from './components/RecordBackup.vue'
import { getAnswerEvidence } from './question-evidence.js'
import { createQuestionClock } from './question-clock.js'
import { saveStudyAttempt, syncCurrentDeviceInBackground } from './sync/study-records.js'
import { fetchSkillQuestions, normalizeQuestionText } from '../scripts/xingcezhenti-runtime.mjs'

const questionCount = 20
const storageKey = 'xuexi-notes:retest-prototype:v1'
const historicalReviewById = new Map()
const questions = ref([])
const localQuestionCount = ref(0)
const questionDataLoaded = ref(false)
const unscoredReviewCount = ref(0)
const pendingOriginalQuestions = computed(() => questions.value.filter((question) => transferPendingUrls.has(question.reviewUrl)))
const transferPendingUrls = new Set()
const mode = ref('intro')
const questionArchive = ref({})
const selectedQuestions = ref([])
const answers = ref({})
const uncertainAnswers = ref({})
const currentIndex = ref(0)
const startedAt = ref(0)
const submittedAt = ref(0)
const now = ref(Date.now())
const currentRunScope = ref('mixed')
const attempts = ref([])
const mistakeCounts = ref({})
const questionHistory = ref({})
const mistakeFilter = ref('')
const mistakeResult = ref(null)
const confirmSubmit = ref(false)
const storageWarning = ref(false)
const loadingQuiz = ref(false)
const poolNotice = ref('')
let timer = null
let recordSyncTimer = null
let skillIndexPromise = null
let localQuestionPromise = null

async function loadLocalQuestionData() {
  if (!localQuestionPromise) {
    localQuestionPromise = Promise.all([
      import('./questions.json'),
      import('../cuotiben/review-catalog.json'),
      import('./review-priority.json'),
    ]).then(([bankModule, catalogModule, priorityModule]) => {
      const bank = bankModule.default
      questions.value = bank.questions
      localQuestionCount.value = bank.imported
      for (const item of priorityModule.default.questions) historicalReviewById.set(item.id, item)
      unscoredReviewCount.value = priorityModule.default.unavailableReviews.length
      for (const item of catalogModule.default) {
        if (/独立运用待验证/.test(item.note || '') && item.url) transferPendingUrls.add(item.url)
      }
      questionDataLoaded.value = true
      return questions.value
    }).catch((error) => {
      localQuestionPromise = null
      throw error
    })
  }
  return localQuestionPromise
}

function browserIsActive() {
  return typeof document !== 'undefined'
    && document.visibilityState === 'visible'
    && document.hasFocus()
}

const questionClock = createQuestionClock(browserIsActive)

function plainQuestionText(value = '') {
  const element = document.createElement('div')
  element.innerHTML = String(value)
  return (element.textContent || '').replace(/\s+/g, ' ').trim()
}

function reviewableArchivedQuestion(question) {
  const escapeHtml = (value = '') => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
  return {
    ...question,
    stemHtml: question.stemHtml || `<p>${escapeHtml(question.stem || question.title || '')}</p>`,
    materialHtml: question.materialHtml || (question.material ? `<p>${escapeHtml(question.material)}</p>` : ''),
    options: (question.options || []).map((option) => ({
      ...option,
      html: option.html || `<p>${escapeHtml(option.text || '')}</p>`,
    })),
  }
}

function snapshotQuestion(item) {
  return {
    id: item.id,
    number: item.number,
    module: item.module,
    type: item.type,
    title: item.title || '',
    source: item.source || '',
    sourceSystem: item.sourceSystem || '',
    reviewUrl: item.reviewUrl || '',
    year: item.year || '',
    stem: plainQuestionText(item.stemHtml || item.stem || item.title || ''),
    materialTitle: item.materialTitle || '',
    material: plainQuestionText(item.materialHtml || ''),
    options: (item.options || []).map((option) => ({ label: option.label, text: plainQuestionText(option.html || option.text || '') })),
    correct: item.correct,
    gradingNote: item.gradingNote || '',
  }
}

const currentQuestion = computed(() => selectedQuestions.value[currentIndex.value])
const activeQuestionCount = computed(() => mode.value === 'mistake-answer' ? 1 : questionCount)
const answeredCount = computed(() => Object.keys(answers.value).filter((id) => answers.value[id]).length)
const unansweredCount = computed(() => Math.max(0, activeQuestionCount.value - answeredCount.value))
const elapsedSeconds = computed(() => startedAt.value
  ? Math.max(0, Math.floor(((submittedAt.value || now.value) - startedAt.value) / 1000))
  : 0)
const progress = computed(() => Math.round((answeredCount.value / activeQuestionCount.value) * 100))
const availableQuestions = computed(() => [
  ...questions.value,
  ...Object.values(questionArchive.value).filter((question) => !questions.value.some((item) => item.id === question.id)),
])
const reviewPriorityCount = computed(() => availableQuestions.value.filter(isReviewPriority).length)
const mistakeRecords = computed(() => availableQuestions.value
  .filter((question) => mistakeCounts.value[question.id] || questionHistory.value[question.id]?.some((item) => !item.isCorrect))
  .map((question) => {
    const history = questionHistory.value[question.id] || []
    const wrongCount = Math.max(mistakeCounts.value[question.id] || 0, history.filter((item) => !item.isCorrect).length)
    return { question, history, wrongCount, lastAttempt: history.at(-1) || null }
  })
  .sort((a, b) => Number(b.lastAttempt?.isCorrect === false) - Number(a.lastAttempt?.isCorrect === false)
    || b.wrongCount - a.wrongCount
    || (b.lastAttempt?.finishedAt || '').localeCompare(a.lastAttempt?.finishedAt || '')))
const mistakeDateGroups = computed(() => {
  const query = mistakeFilter.value.trim().toLocaleLowerCase()
  const questionById = new Map(availableQuestions.value.map((question) => [question.id, question]))
  const grouped = new Map()
  const getGroup = (date) => {
    if (!grouped.has(date)) grouped.set(date, { date, byQuestion: new Map(), attemptCount: 0 })
    return grouped.get(date)
  }
  const matchesSearch = (question) => {
    if (!query) return true
    return [question.module, question.type, question.title, question.source, question.number, question.id,
      question.stem, question.stemHtml ? plainQuestionText(question.stemHtml) : '']
      .filter(Boolean).join(' ').toLocaleLowerCase().includes(query)
  }

  const ids = new Set([...Object.keys(questionHistory.value), ...Object.keys(mistakeCounts.value)])
  for (const id of ids) {
    const history = questionHistory.value[id] || []
    const archived = history.find((item) => item.question)?.question
    const question = questionById.get(id) || (archived ? reviewableArchivedQuestion(archived) : { id })
    if (!matchesSearch(question)) continue
    const wrongAttempts = history.filter((item) => item.isCorrect === false)
    for (const attempt of wrongAttempts) {
      const date = attempt.finishedAt ? shanghaiDayKey(attempt.finishedAt) : 'unknown'
      const group = getGroup(date)
      const entry = group.byQuestion.get(id) || { question, attempts: [], legacyCount: 0 }
      entry.attempts.push(attempt)
      group.byQuestion.set(id, entry)
      group.attemptCount++
    }

    const untrackedWrongCount = Math.max(0, (Number(mistakeCounts.value[id]) || 0) - wrongAttempts.length)
    if (untrackedWrongCount) {
      const group = getGroup('unknown')
      const entry = group.byQuestion.get(id) || { question, attempts: [], legacyCount: 0 }
      entry.legacyCount += untrackedWrongCount
      group.byQuestion.set(id, entry)
      group.attemptCount += untrackedWrongCount
    }
  }

  return [...grouped.values()].map((group) => ({
    date: group.date,
    attemptCount: group.attemptCount,
    questions: [...group.byQuestion.values()]
      .map((entry) => ({
        ...entry,
        attempts: entry.attempts.sort((a, b) => (b.finishedAt || '').localeCompare(a.finishedAt || '')),
      }))
      .sort((a, b) => (b.attempts[0]?.finishedAt || '').localeCompare(a.attempts[0]?.finishedAt || '')),
  })).sort((a, b) => a.date === 'unknown' ? 1 : b.date === 'unknown' ? -1 : b.date.localeCompare(a.date))
})
const flaggedReviewRecords = computed(() => availableQuestions.value
  .map((question) => {
    const history = questionHistory.value[question.id] || []
    const markedAttempts = history.filter((item) => item.isUncertain || item.isSlow)
    return markedAttempts.length ? { question, history, markedAttempts, lastAttempt: history.at(-1) || null } : null
  })
  .filter(Boolean)
  .sort((a, b) => (b.lastAttempt?.finishedAt || '').localeCompare(a.lastAttempt?.finishedAt || '')))
const visibleFlaggedRecords = computed(() => {
  const query = mistakeFilter.value.trim().toLocaleLowerCase()
  if (!query) return flaggedReviewRecords.value
  return flaggedReviewRecords.value.filter(({ question }) => [question.module, question.type, question.source, question.title, question.number]
    .filter(Boolean).join(' ').toLocaleLowerCase().includes(query))
})
const pendingMistakeCount = computed(() => mistakeRecords.value.filter((record) => record.lastAttempt?.isCorrect === false).length)
const results = computed(() => selectedQuestions.value.map((question) => {
  const durationMs = questionClock.elapsedMs(question.id, now.value)
  return {
    ...question,
    answer: answers.value[question.id] || '',
    isCorrect: answers.value[question.id] === question.correct,
    isUncertain: Boolean(uncertainAnswers.value[question.id]),
    durationSeconds: Math.floor(durationMs / 1000),
    isSlow: isSlowQuestion(question, durationMs),
    answerEvidence: getAnswerEvidence(question, skillPool.repository),
  }
}))
const correctCount = computed(() => results.value.filter((item) => item.isCorrect).length)
const evidenceNeedsAttentionCount = computed(() => results.value.filter((item) => item.answerEvidence.key !== 'fenbi').length)
const reviewFlagCount = computed(() => results.value.filter((item) => !item.isCorrect || item.isUncertain || item.isSlow).length)
const moduleStats = computed(() => {
  const grouped = new Map()
  for (const item of results.value) {
    const row = grouped.get(item.module) || { name: item.module, total: 0, correct: 0 }
    row.total += 1
    if (item.isCorrect) row.correct += 1
    grouped.set(item.module, row)
  }
  return [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
})

function shuffle(items) {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index--) {
    const swap = Math.floor(Math.random() * (index + 1))
    ;[copy[index], copy[swap]] = [copy[swap], copy[index]]
  }
  return copy
}

function isSkillQuestion(question) {
  return question.sourceSystem === skillPool.repository
    || question.sourceUrl?.includes(`/${skillPool.repository}/`)
}

function isSlowQuestion(question, durationMs) {
  const kind = `${question.module || ''} ${question.type || ''}`
  if (/图形推理|图形判断/.test(kind)) return durationMs > 90_000
  if (/类比推理|逻辑判断/.test(kind)) return durationMs > 60_000
  return false
}

function cleanCorrectStreak(question) {
  const history = questionHistory.value[question.id] || []
  let streak = 0
  for (let index = history.length - 1; index >= 0; index--) {
    const attempt = history[index]
    if (!attempt.isCorrect || attempt.isUncertain || attempt.isSlow) break
    streak++
  }
  return streak
}

function isReviewPriority(question) {
  if (cleanCorrectStreak(question) >= 2) return false
  const historicalReview = historicalReviewById.get(question.id)
  return Boolean(historicalReview)
    || Boolean(mistakeCounts.value[question.id])
    || questionHistory.value[question.id]?.some((item) => !item.isCorrect || item.isUncertain || item.isSlow)
}

function reviewPriorityRank(question) {
  const history = questionHistory.value[question.id] || []
  const latest = history.at(-1)
  if (latest && !latest.isCorrect) return 0
  if (latest?.isUncertain) return 1
  if (latest?.isSlow) return 2

  const types = historicalReviewById.get(question.id)?.types || []
  const rank = types.includes('错题') || mistakeCounts.value[question.id]
    ? 0
    : types.includes('不确定')
      ? 1
      : types.includes('猜题')
        ? 2
        : 3
  return rank + (cleanCorrectStreak(question) > 0 ? 4 : 0)
}

function compareReviewPriority(a, b) {
  const rank = reviewPriorityRank(a) - reviewPriorityRank(b)
  if (rank) return rank
  const aLast = questionHistory.value[a.id]?.at(-1)?.finishedAt || historicalReviewById.get(a.id)?.date || ''
  const bLast = questionHistory.value[b.id]?.at(-1)?.finishedAt || historicalReviewById.get(b.id)?.date || ''
  return aLast.localeCompare(bLast)
    || (mistakeCounts.value[b.id] || 0) - (mistakeCounts.value[a.id] || 0)
}

function questionSeconds(questionId) {
  return Math.floor(questionClock.elapsedMs(questionId, now.value) / 1000)
}

function allocateModuleTargets(count) {
  const total = skillPool.modules.reduce((sum, module) => sum + module.questionCount, 0)
  const rows = skillPool.modules.map((module) => {
    const exact = count * module.questionCount / total
    return { key: module.key, value: Math.floor(exact), remainder: exact - Math.floor(exact) }
  })
  let unassigned = count - rows.reduce((sum, row) => sum + row.value, 0)
  for (const row of [...rows].sort((a, b) => b.remainder - a.remainder).slice(0, unassigned)) row.value++
  return Object.fromEntries(rows.map((row) => [row.key, row.value]))
}

function questionFingerprint(question) {
  return normalizeQuestionText(question.stemHtml + question.options.map((option) => option.html).join(''))
}

async function loadSkillIndex(signal) {
  if (!skillIndexPromise) {
    skillIndexPromise = fetch(withBase('/retest/xingcezhenti-index.json'), { cache: 'force-cache', signal })
      .then((response) => {
        if (!response.ok) throw new Error(`技能题库目录暂不可用（HTTP ${response.status}）`)
        return response.json()
      })
      .catch((error) => {
        skillIndexPromise = null
        throw error
      })
  }
  return skillIndexPromise
}

async function drawQuestions(signal, scope = 'mixed') {
  if (scope === 'pending-originals') {
      const priority = pendingOriginalQuestions.value
      .filter(isReviewPriority)
      .sort(compareReviewPriority)
      .slice(0, questionCount)
    const chosen = new Set(priority.map((question) => question.id))
    const rest = shuffle(pendingOriginalQuestions.value.filter((question) => !chosen.has(question.id)))
    const selected = [...priority, ...rest.slice(0, questionCount - priority.length)]
    if (selected.length !== questionCount) throw new Error(`待验证原题目前只有 ${selected.length} 道可抽，无法组成20题。`)
    poolNotice.value = `本轮从 ${pendingOriginalQuestions.value.length} 道待验证记录对应的原题中抽取20道。此模式用于复做原题；答对不会自动清除“独立运用待验证”状态。`
    return shuffle(selected)
  }

  const previousMistakes = availableQuestions.value
    .filter(isReviewPriority)
    .sort(compareReviewPriority)
  const priority = previousMistakes.slice(0, questionCount)
  const chosen = new Set(priority.map((question) => question.id))
  const attemptedIds = new Set(Object.keys(questionHistory.value))
  const previouslyDone = shuffle(availableQuestions.value.filter((question) =>
    attemptedIds.has(question.id) && !chosen.has(question.id)))
    .slice(0, Math.min(5, questionCount - priority.length))
  for (const question of previouslyDone) chosen.add(question.id)

  const remainingLocalSlots = questionCount - priority.length - previouslyDone.length
  const localPool = shuffle(questions.value.filter((question) => !chosen.has(question.id)
    && !isReviewPriority(question)
    && (previousMistakes.length === 0 || attemptedIds.has(question.id))))
  const localLimit = previousMistakes.length > 0
    ? remainingLocalSlots
    : Math.min(5, remainingLocalSlots)
  const localQuestions = localPool.slice(0, localLimit)
  for (const question of localQuestions) chosen.add(question.id)

  const skillCount = previousMistakes.length === 0
    ? questionCount - priority.length - previouslyDone.length - localQuestions.length
    : 0
  let remote = { questions: [], failures: [] }
  if (skillCount > 0) {
    const knownSkillQuestions = questions.value.filter(isSkillQuestion)
    const excludedIds = new Set([
      ...Object.keys(questionHistory.value),
      ...Object.keys(mistakeCounts.value),
      ...chosen,
    ])
    const excludedTexts = new Set(knownSkillQuestions.map(questionFingerprint).filter(Boolean))
    try {
      const index = await loadSkillIndex(signal)
      remote = await fetchSkillQuestions({
        index,
        pool: skillPool,
        targetCounts: allocateModuleTargets(skillCount),
        excludedIds,
        excludedTexts,
        signal,
      })
    } catch (error) {
      remote.failures.push(error.message || '技能真题源连接失败')
    }
  }

  const remoteIds = new Set(remote.questions.map((question) => question.id))
  for (const id of remoteIds) chosen.add(id)
  const fallback = shuffle(availableQuestions.value.filter((question) => !chosen.has(question.id)))
  const selected = [...priority, ...previouslyDone, ...localQuestions, ...remote.questions]
  const complete = [...selected, ...fallback.slice(0, questionCount - selected.length)]
  if (complete.length !== questionCount) throw new Error('当前可用题目不足20道，暂时无法开始。')

  const localFill = questionCount - priority.length - previouslyDone.length - remote.questions.length
  const sourceFailures = remote.failures.length
  const triedCount = previouslyDone.length
  poolNotice.value = previousMistakes.length > 0
    ? `本轮优先复测 ${priority.length} 道旧错题、不确定题、猜题或偏慢题；待熟悉旧题共 ${previousMistakes.length} 道。其余题目从本站题库补齐，旧题优先池清空前不加入新技能真题。`
    : sourceFailures && remote.questions.length === 0
      ? `历史优先池已清空；技能真题源暂不可用，本轮已从已做题和本站题库补足20题。`
      : remote.questions.length === skillCount
        ? `历史优先池已清空。本轮包含 ${triedCount} 道已做题、${localQuestions.length} 道本站题和 ${remote.questions.length} 道2020年及以后新真题。`
        : `历史优先池已清空；技能题源本轮载入 ${remote.questions.length} 道，已从已做题和本站题库补足其余 ${localFill} 道。${sourceFailures ? '未能读取的来源已自动跳过。' : ''}`
  return shuffle(complete)
}

async function startQuiz(scope = 'mixed') {
  if (loadingQuiz.value) return
  loadingQuiz.value = true
  currentRunScope.value = scope
  poolNotice.value = ''
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 9000)
  try {
    await loadLocalQuestionData()
    selectedQuestions.value = await drawQuestions(controller.signal, scope)
    answers.value = {}
    uncertainAnswers.value = {}
    currentIndex.value = 0
    startedAt.value = Date.now()
    submittedAt.value = 0
    confirmSubmit.value = false
    questionClock.reset()
    mode.value = 'answer'
    questionClock.select(selectedQuestions.value[0]?.id)
    scrollToTop()
  } catch (error) {
    poolNotice.value = `${error.message} 本轮未开始；可以重试，网络不可用时请稍后再试。`
  } finally {
    window.clearTimeout(timeout)
    loadingQuiz.value = false
  }
}

function startMistakeReview(question) {
  selectedQuestions.value = [question]
  answers.value = {}
  uncertainAnswers.value = {}
  currentIndex.value = 0
  startedAt.value = Date.now()
  submittedAt.value = 0
  mistakeResult.value = null
  confirmSubmit.value = false
  currentRunScope.value = 'mixed'
  questionClock.reset()
  mode.value = 'mistake-answer'
  questionClock.select(question.id)
  scrollToTop()
}

function selectAnswer(label) {
  if (!currentQuestion.value) return
  answers.value[currentQuestion.value.id] = label
}

function toggleUncertain() {
  const id = currentQuestion.value?.id
  if (!id) return
  uncertainAnswers.value = { ...uncertainAnswers.value, [id]: !uncertainAnswers.value[id] }
}

function goTo(index) {
  if (index < 0 || index >= selectedQuestions.value.length) return
  if (index === currentIndex.value) return
  questionClock.pause()
  currentIndex.value = index
  questionClock.select(selectedQuestions.value[index]?.id)
  confirmSubmit.value = false
  scrollToTop()
}

function requestSubmit() {
  confirmSubmit.value = true
}

function submitQuiz() {
  questionClock.pause()
  now.value = Date.now()
  submittedAt.value = Date.now()
  const nextMistakes = { ...mistakeCounts.value }
  const attempt = {
    id: `${submittedAt.value}-${Math.random().toString(36).slice(2, 8)}`,
    startedAt: new Date(startedAt.value).toISOString(),
    finishedAt: new Date(submittedAt.value).toISOString(),
    durationSeconds: elapsedSeconds.value,
    correct: correctCount.value,
    total: questionCount,
    answers: results.value.map((item) => ({
      id: item.id,
      answer: item.answer,
      correct: item.correct,
      isCorrect: item.isCorrect,
      isUncertain: item.isUncertain,
      durationSeconds: item.durationSeconds,
      isSlow: item.isSlow,
      question: snapshotQuestion(item),
    })),
  }

  for (const item of results.value) {
    if (!item.isCorrect) nextMistakes[item.id] = (nextMistakes[item.id] || 0) + 1
    recordQuestionAttempt(item, attempt.id, '20题复测', item.durationSeconds)
  }
  const nextArchive = { ...questionArchive.value }
  for (const item of results.value) {
    if (isSkillQuestion(item)) nextArchive[item.id] = item
  }
  attempts.value = [attempt, ...attempts.value]
  mistakeCounts.value = nextMistakes
  questionArchive.value = nextArchive
  persistLocalRecords()
  saveStudyAttempt({
    id: `xingce-round:${attempt.id}`,
    kind: 'xingce_round',
    startedAt: attempt.startedAt,
    finishedAt: attempt.finishedAt,
    durationSeconds: attempt.durationSeconds,
    score: attempt.correct * 5,
    total: attempt.total,
    payload: { attempt },
  })
  confirmSubmit.value = false
  mode.value = 'result'
  scrollToTop()
}

function submitMistakeReview() {
  const question = currentQuestion.value
  if (!question || !answers.value[question.id]) return
  questionClock.pause()
  now.value = Date.now()
  submittedAt.value = Date.now()
  const answer = answers.value[question.id]
  const durationMs = questionClock.elapsedMs(question.id, now.value)
  const durationSeconds = Math.floor(durationMs / 1000)
  const result = {
    ...question,
    answer,
    isCorrect: answer === question.correct,
    isUncertain: Boolean(uncertainAnswers.value[question.id]),
    durationSeconds,
    isSlow: isSlowQuestion(question, durationMs),
    answerEvidence: getAnswerEvidence(question, skillPool.repository),
    startedAt: questionClock.startedAt(question.id) ? new Date(questionClock.startedAt(question.id)).toISOString() : '',
    finishedAt: new Date(submittedAt.value).toISOString(),
  }
  const id = `${submittedAt.value}-${Math.random().toString(36).slice(2, 8)}`
  recordQuestionAttempt(result, id, '单题复测', result.durationSeconds)
  if (!result.isCorrect) mistakeCounts.value = { ...mistakeCounts.value, [question.id]: (mistakeCounts.value[question.id] || 0) + 1 }
  mistakeResult.value = result
  persistLocalRecords()
  saveStudyAttempt({
    id: `xingce-single:${id}`,
    kind: 'xingce_single',
    startedAt: result.startedAt,
    finishedAt: result.finishedAt,
    durationSeconds: result.durationSeconds,
    total: 1,
    payload: {
      questionId: result.id,
      question: snapshotQuestion(result),
      answer: questionHistory.value[result.id]?.at(-1),
    },
  })
  mode.value = 'mistake-result'
  scrollToTop()
}

function recordQuestionAttempt(item, sessionId, kind, durationSeconds) {
  const record = {
    sessionId,
    startedAt: item.startedAt || (questionClock.startedAt(item.id) ? new Date(questionClock.startedAt(item.id)).toISOString() : ''),
    finishedAt: new Date(submittedAt.value).toISOString(),
    kind,
    answer: item.answer || '',
    correct: item.correct,
    isCorrect: Boolean(item.isCorrect),
    durationSeconds,
    durationScope: 'question',
    isUncertain: Boolean(item.isUncertain),
    isSlow: Boolean(item.isSlow),
    question: snapshotQuestion(item),
  }
  questionHistory.value = {
    ...questionHistory.value,
    [item.id]: [...(questionHistory.value[item.id] || []), record],
  }
}

function persistLocalRecords() {
  try {
    localStorage.setItem(storageKey, JSON.stringify({
      schemaVersion: 3,
      attempts: attempts.value,
      mistakeCounts: mistakeCounts.value,
      questionHistory: questionHistory.value,
      questionArchive: questionArchive.value,
    }))
  } catch {
    storageWarning.value = true
  }
}

function readLocalRecords() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '{}')
    if (Array.isArray(saved.attempts)) attempts.value = saved.attempts
    if (saved.mistakeCounts && typeof saved.mistakeCounts === 'object') mistakeCounts.value = saved.mistakeCounts
    if (saved.questionHistory && typeof saved.questionHistory === 'object') {
      questionHistory.value = Object.fromEntries(Object.entries(saved.questionHistory).map(([id, rows]) => [
        id,
        Array.isArray(rows) ? rows.map((row) => ({
          ...row,
          durationScope: row.durationScope || (row.kind === '单题复测' ? 'question' : 'round'),
          isUncertain: Boolean(row.isUncertain),
          isSlow: Boolean(row.isSlow),
        })) : [],
      ]))
    } else {
      // Upgrade the earlier prototype's retained session rows without discarding them.
      const migrated = {}
      for (const attempt of [...attempts.value].reverse()) {
        for (const answer of attempt.answers || []) {
          if (!answer.id) continue
          migrated[answer.id] ||= []
          migrated[answer.id].push({
            sessionId: attempt.id || attempt.finishedAt,
            finishedAt: attempt.finishedAt,
            kind: '20题复测',
            answer: answer.answer || '',
            correct: answer.correct || '',
            isCorrect: Boolean(answer.isCorrect),
            durationSeconds: attempt.durationSeconds || 0,
            durationScope: 'round',
            isUncertain: Boolean(answer.isUncertain),
            isSlow: Boolean(answer.isSlow),
          })
        }
      }
      questionHistory.value = migrated
      if (attempts.value.length) persistLocalRecords()
    }
    if (saved.questionArchive && typeof saved.questionArchive === 'object') questionArchive.value = saved.questionArchive
  } catch {
    storageWarning.value = true
  }
}

function scrollToTop() {
  if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
}

function baseInHtmlUrl(url) {
  if (/^(?:[a-z]+:|\/\/|#)/i.test(url)) return url
  if (!url.startsWith('/')) return url
  const sitePath = url.replace(/^\/xuexi-notes(?=\/)/, '')
  return withBase(sitePath)
}

function pageHref(url) {
  if (!url || /^(?:[a-z]+:|\/\/|#)/i.test(url)) return url || '#'
  const hashIndex = url.indexOf('#')
  const pathname = hashIndex < 0 ? url : url.slice(0, hashIndex)
  const hash = hashIndex < 0 ? '' : url.slice(hashIndex)
  const sitePath = pathname.replace(/^\/xuexi-notes(?=\/)/, '')
  const htmlPath = sitePath.endsWith('/') || /\.[a-z0-9]+$/i.test(sitePath) ? sitePath : sitePath + '.html'
  return withBase(htmlPath) + hash
}

function formatHtml(html = '') {
  return html.replace(/\b(src|href|srcset)=(['"])(.*?)\2/gi, (_, attribute, quote, url) => {
    const cleanUrl = url.split(',')[0].trim().split(/\s+/)[0]
    return `${attribute}=${quote}${baseInHtmlUrl(cleanUrl)}${quote}`
  })
}

function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}

function formatDate(value) {
  if (!value) return '时间未记录'
  return new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function formatClock(value) {
  if (!value) return '时间未记录'
  return new Date(value).toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false })
}

function shanghaiDayKey(value) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(value))
  const fields = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]))
  return `${fields.year}-${fields.month}-${fields.day}`
}

function mistakeDateLabel(value) {
  if (value === 'unknown') return '日期未记录'
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  }).format(new Date(`${value}T12:00:00+08:00`))
}

function formatAttemptDuration(seconds) {
  if (seconds === null || seconds === undefined || !Number.isFinite(Number(seconds))) return '用时未记录'
  return formatDuration(Number(seconds))
}

function answerText(item) {
  return item.answer ? item.answer : '未作答'
}

function questionLabel(number) {
  return typeof number === 'number' ? '第 ' + number + ' 题' : number
}

function syncQuestionClock() {
  if (browserIsActive()) questionClock.resume()
  else questionClock.pause()
}

function syncAccountOnFocus() {
  if (document.visibilityState !== 'visible') return
  window.clearTimeout(recordSyncTimer)
  recordSyncTimer = window.setTimeout(() => {
    void syncCurrentDeviceInBackground().then(readLocalRecords)
  }, 180)
}

onMounted(() => {
  readLocalRecords()
  void syncCurrentDeviceInBackground().then(readLocalRecords)
  void loadLocalQuestionData().catch(() => {
    poolNotice.value = '本地题库暂时未能载入；点击开始时会重试，题库恢复后才能显示完整题目。'
  })
  timer = window.setInterval(() => {
    now.value = Date.now()
    syncQuestionClock()
  }, 1000)
  window.addEventListener('focus', syncQuestionClock)
  window.addEventListener('focus', syncAccountOnFocus)
  window.addEventListener('blur', syncQuestionClock)
  document.addEventListener('visibilitychange', syncQuestionClock)
  document.addEventListener('visibilitychange', syncAccountOnFocus)
  const params = new URLSearchParams(window.location.search)
  const scope = params.get('scope') === 'pending-originals' ? 'pending-originals' : 'mixed'
  if (params.get('start') === '1') {
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.hash}`)
    void startQuiz(scope)
  }
})

onBeforeUnmount(() => {
  if (timer) window.clearInterval(timer)
  window.clearTimeout(recordSyncTimer)
  questionClock.pause()
  window.removeEventListener('focus', syncQuestionClock)
  window.removeEventListener('focus', syncAccountOnFocus)
  window.removeEventListener('blur', syncQuestionClock)
  document.removeEventListener('visibilitychange', syncQuestionClock)
  document.removeEventListener('visibilitychange', syncAccountOnFocus)
})
</script>

<template>
  <main class="retest-shell">
    <template v-if="mode === 'intro'">
      <header class="intro-card">
        <div class="intro-copy">
          <span class="eyebrow">行测复测 · 全站错题持续积累</span>
          <h1>错题再练，交卷即看结果</h1>
          <p>每轮先复测你以前做错、猜测、不确定或超时偏慢的题。旧题连续两次答对、未标不确定且没有超过题型用时线后，才退出优先池；旧题优先池清空后才加入2020年及以后的技能真题。</p>
          <button class="button button--primary" type="button" :disabled="loadingQuiz" @click="startQuiz('mixed')">{{ loadingQuiz ? '正在组 20 题…' : '开始20题复测' }} <span v-if="!loadingQuiz" aria-hidden="true">→</span></button>
          <button class="button button--outline pending-scope-button" type="button" :disabled="loadingQuiz || (questionDataLoaded && pendingOriginalQuestions.length < questionCount)" @click="startQuiz('pending-originals')">{{ questionDataLoaded ? `复做待验证原题（${pendingOriginalQuestions.length} 道）` : '读取题库后复做待验证原题' }}</button>
          <small class="pending-scope-note">复做原题用于回忆和检查，不会自动清除“独立运用待验证”状态。</small>
          <a class="button button--quiet library-entry" :href="withBase('/retest/library/')">查看全站题库 →</a>
          <a class="button button--quiet library-entry" :href="withBase('/retest/essay.html')">申论复测 →</a>
          <small class="priority-note">每次仍为20题；旧题不足时先用已做过的本站题补足。记录先保存在本机；登录同一邮箱后可跨设备同步，不改写原有成绩和复测台账。</small>
          <small v-if="unscoredReviewCount" class="pending-scope-note">另有 {{ unscoredReviewCount }} 条历史记录因自编或题源、答案未达到自动判分要求，仍可从错题本查看，但不会误当成可判分真题。</small>
        </div>
        <div class="intro-metrics" aria-label="复测题库信息">
          <div><strong>{{ skillPool.indexedQuestions.toLocaleString('zh-CN') }}</strong><span>道技能真题（2020+）</span></div>
          <div><strong>20</strong><span>题 / 每次</span></div>
          <div><strong>{{ questionDataLoaded ? reviewPriorityCount.toLocaleString('zh-CN') : '…' }}</strong><span>道旧题待熟悉</span></div>
        </div>
      </header>
      <p v-if="poolNotice" class="pool-notice" role="status">{{ poolNotice }}</p>

      <section class="how-it-works" aria-label="测验流程">
        <div><span>01</span><b>抽题</b><small>先抽历史错题、猜题、不确定题和偏慢题；优先池清空后才加入新的技能真题。</small></div>
        <div><span>02</span><b>作答</b><small>可跳题、改答案，也可返回检查；可以标记“猜测 / 不确定”。</small></div>
        <div><span>03</span><b>复习</b><small>旧题连续两次答对、信心稳定且没有超时，才退出优先池；其他作答仍留在历次记录中。</small></div>
      </section>

      <RecordBackup />

      <section class="record-section" v-if="attempts.length">
        <div class="section-title"><div><span class="eyebrow">逐次保留</span><h2>最近复测记录</h2></div><span>{{ attempts.length }} 次</span></div>
        <div class="history-list">
          <div v-for="attempt in attempts.slice(0, 5)" :key="attempt.id || attempt.finishedAt" class="history-row">
            <span>{{ formatDate(attempt.finishedAt) }}</span>
            <strong>{{ attempt.correct }}/{{ attempt.total }} 题</strong>
            <span>{{ attempt.correct * 5 }} 分</span>
            <span>{{ formatDuration(attempt.durationSeconds) }}</span>
          </div>
        </div>
        <details v-if="attempts.length > 5" class="all-history">
          <summary>查看更早的 {{ attempts.length - 5 }} 次整卷记录</summary>
          <div class="history-list">
            <div v-for="attempt in attempts.slice(5)" :key="attempt.id || attempt.finishedAt" class="history-row">
              <span>{{ formatDate(attempt.finishedAt) }}</span>
              <strong>{{ attempt.correct }}/{{ attempt.total }} 题</strong>
              <span>{{ attempt.correct * 5 }} 分</span>
              <span>{{ formatDuration(attempt.durationSeconds) }}</span>
            </div>
          </div>
        </details>
      </section>

      <section class="record-section mistake-bank">
        <div class="section-title">
          <div><span class="eyebrow">逐题历史</span><h2>我的行测错题复测库</h2></div>
          <span>{{ mistakeRecords.length }} 道曾错 · {{ pendingMistakeCount }} 道最近仍错</span>
        </div>
        <p class="mistake-intro">按错题发生日期归档。点开日期即可查看当天答错的题、你的答案和参考答案；同一道题反复答错会逐次保留。登录同一邮箱后，其他浏览器和设备的错题也会合并进来。</p>
        <div v-if="mistakeRecords.length" class="mistake-tools">
          <label><span class="sr-only">筛选错题</span><input v-model="mistakeFilter" type="search" placeholder="按模块、题目或来源搜索"></label>
          <span>按北京时间从新到旧 · 点日期展开</span>
        </div>
        <div v-if="mistakeDateGroups.length" class="mistake-date-list">
          <details v-for="group in mistakeDateGroups" :key="group.date" class="mistake-date-group">
            <summary>
              <span class="mistake-date-summary__copy">
                <strong>{{ mistakeDateLabel(group.date) }}</strong>
                <small>{{ group.questions.length }} 道错题 · {{ group.attemptCount }} 次错答 / 未答</small>
              </span>
              <span class="mistake-date-chevron" aria-hidden="true">⌄</span>
            </summary>
            <div class="mistake-date-questions">
              <article v-for="record in group.questions" :key="record.question.id" class="mistake-date-question">
                <div class="mistake-date-question__head">
                  <div class="mistake-row__tags">
                    <span>{{ record.question.module || '行测' }}</span>
                    <span v-if="record.question.number">{{ questionLabel(record.question.number) }}</span>
                    <span v-if="record.attempts.length > 1">当天错答 {{ record.attempts.length }} 次</span>
                    <span v-if="record.legacyCount">另有 {{ record.legacyCount }} 次旧记录</span>
                  </div>
                  <button class="button button--outline mistake-review-button" type="button" @click="startMistakeReview(record.question)">单独再做</button>
                </div>
                <strong class="mistake-date-question__title">{{ record.question.title || record.question.source || '行测错题' }}</strong>
                <p v-if="record.question.stem || record.question.stemHtml" class="mistake-date-question__stem">{{ record.question.stem || plainQuestionText(record.question.stemHtml) }}</p>
                <p v-if="record.question.options?.length" class="mistake-date-question__options">
                  选项：<span v-for="option in record.question.options" :key="option.label">{{ option.label }} {{ option.text || plainQuestionText(option.html) }}； </span>
                </p>
                <div v-if="record.attempts.length" class="mistake-date-attempts">
                  <p v-for="(attempt, index) in record.attempts" :key="attempt.sessionId || index">
                    <time>{{ formatClock(attempt.finishedAt) }}</time>
                    <span>你的答案：{{ answerText(attempt) }}</span>
                    <span>参考答案：{{ attempt.correct || '未记录' }}</span>
                    <span>{{ formatAttemptDuration(attempt.durationSeconds) }}</span>
                  </p>
                </div>
                <p v-if="record.legacyCount" class="mistake-date-question__legacy">这部分旧记录没有保存具体日期、作答选择或用时。</p>
                <a v-if="record.question.reviewUrl || record.question.sourceUrl" class="review-link" :href="pageHref(record.question.reviewUrl || record.question.sourceUrl)">查看原题与解析 ↗</a>
              </article>
            </div>
          </details>
        </div>
        <div v-else-if="mistakeRecords.length" class="empty-state">没有找到匹配题目，换个模块名或关键词试试。</div>
        <div v-else class="empty-state">还没有行测错题记录。完成第一组复测后，错题会自动出现在这里。</div>
      </section>

      <section v-if="flaggedReviewRecords.length" class="record-section mistake-bank">
        <div class="section-title">
          <div><span class="eyebrow">答对也值得回看</span><h2>不确定与耗时题</h2></div>
          <span>{{ flaggedReviewRecords.length }} 道带复盘标记</span>
        </div>
        <div class="mistake-tools">
          <label><span class="sr-only">筛选不确定或耗时题</span><input v-model="mistakeFilter" type="search" placeholder="按模块、题目或来源搜索"></label>
          <span>保留猜测标记与题型阈值耗时记录</span>
        </div>
        <div v-if="visibleFlaggedRecords.length" class="mistake-list">
          <article v-for="record in visibleFlaggedRecords" :key="record.question.id" class="mistake-row">
            <div class="mistake-row__copy">
              <div class="mistake-row__tags">
                <span>{{ record.question.module }}</span><span>{{ questionLabel(record.question.number) }}</span>
                <span v-if="record.markedAttempts.some((item) => item.isUncertain)" class="review-flag review-flag--uncertain">不确定 / 猜题</span>
                <span v-if="record.markedAttempts.some((item) => item.isSlow)" class="review-flag review-flag--slow">耗时较长</span>
              </div>
              <strong>{{ record.question.title || record.question.source }}</strong>
              <small>最近一次 {{ record.lastAttempt?.isCorrect ? '答对' : '答错 / 未答' }} · <template v-if="record.lastAttempt?.durationScope === 'round'">旧记录整卷用时 {{ formatDuration(record.lastAttempt?.durationSeconds || 0) }}</template><template v-else>本题用时 {{ formatDuration(record.lastAttempt?.durationSeconds || 0) }}</template></small>
            </div>
            <button class="button button--outline mistake-review-button" type="button" @click="startMistakeReview(record.question)">单独再做</button>
          </article>
        </div>
        <div v-else class="empty-state">没有找到匹配题目，换个模块名或关键词试试。</div>
      </section>

      <aside class="source-note">
        <b>题库从哪里来</b>
        <p>技能题源覆盖2020—2026年六个模块，共 {{ skillPool.indexedQuestions.toLocaleString('zh-CN') }} 道、{{ skillPool.eligibleSourceFiles.toLocaleString('zh-CN') }} 份原题文件，题目在点击开始后从固定版本按需读取并校验；这样不用把约百兆原始资料一次塞进网页。网站本身另有 {{ questionDataLoaded ? localQuestionCount : '正在载入' }} 道已整理题，包括综合真题、历史错题和知识点例题。<a :href="skillPool.questionCountSources[0]" target="_blank" rel="noopener">查看上游模块索引 ↗</a></p>
        <p>技能题的参考答案取自对应固定版原卷，尚未逐题与粉笔核对；遇到题面或答案疑问时，需按同题版本到粉笔核对。只有完整四选项且答案明确为A—D的题进入自动判分。浏览器保存每题历次作答；熟题得分不代表陌生题水平。</p>
        <p><a :href="pageHref('/retest/answer-evidence')">查看答案核对记录（含答案）↗</a></p>
      </aside>
      <p v-if="storageWarning" class="storage-warning">当前浏览器没有保存本地记录；关闭页面后，本次记录可能无法保留。</p>
    </template>

    <template v-else-if="(mode === 'answer' || mode === 'mistake-answer') && currentQuestion">
      <header class="quiz-topbar">
        <div><span class="eyebrow">{{ mode === 'mistake-answer' ? '行测单题复测' : '行测20题复测' }} · 第 {{ currentIndex + 1 }} / {{ activeQuestionCount }} 题</span><h1>按自己的节奏完成</h1></div>
        <div class="timer-pills">
          <div class="timer-pill"><span class="timer-dot"></span><span>整卷</span><strong>{{ formatDuration(elapsedSeconds) }}</strong></div>
          <div class="timer-pill timer-pill--question"><span>本题</span><strong>{{ formatDuration(questionSeconds(currentQuestion.id)) }}</strong></div>
        </div>
      </header>
      <p v-if="poolNotice" class="pool-notice" role="status">{{ poolNotice }}</p>
      <div class="progress-track" role="progressbar" :aria-valuenow="answeredCount" :aria-valuemin="0" :aria-valuemax="activeQuestionCount">
        <span :style="{ width: `${progress}%` }"></span>
      </div>
      <div class="progress-caption"><span>已答 {{ answeredCount }} 题</span><span>未答 {{ unansweredCount }} 题</span></div>

      <div class="exam-layout">
        <section class="question-card" aria-live="polite">
          <div class="question-meta"><span>{{ currentQuestion.module }}</span><span>{{ currentQuestion.type }}</span><span>{{ questionLabel(currentQuestion.number) }}</span></div>
          <details v-if="currentQuestion.materialHtml" class="shared-material" open>
            <summary>{{ currentQuestion.materialTitle }} <small>本题需要结合材料作答</small></summary>
            <div class="material-content" v-html="formatHtml(currentQuestion.materialHtml)"></div>
          </details>
          <div class="question-content" v-html="formatHtml(currentQuestion.stemHtml)"></div>
          <fieldset class="answer-options">
            <legend>选择一个答案</legend>
            <label v-for="option in currentQuestion.options" :key="option.label" class="answer-option" :class="{ 'is-selected': answers[currentQuestion.id] === option.label }">
              <input type="radio" :name="`answer-${currentQuestion.id}`" :value="option.label" :checked="answers[currentQuestion.id] === option.label" @change="selectAnswer(option.label)">
              <span class="answer-letter">{{ option.label }}</span>
              <span v-if="option.html" class="answer-option__content" v-html="formatHtml(option.html)"></span>
              <span v-else class="answer-option__content">按题干原图选择 {{ option.label }}</span>
            </label>
          </fieldset>
          <div class="source-line"><span>{{ currentQuestion.source }}</span></div>
          <div class="question-review-tools">
            <button class="uncertainty-button" :class="{ active: uncertainAnswers[currentQuestion.id] }" type="button" :aria-pressed="Boolean(uncertainAnswers[currentQuestion.id])" @click="toggleUncertain">
              {{ uncertainAnswers[currentQuestion.id] ? '已标记：不确定 / 猜题' : '标记不确定 / 猜题' }}
            </button>
            <small>本题用时按当前题目页面可见时间累计。</small>
          </div>

          <div v-if="mode === 'answer'" class="question-actions">
            <button class="button button--quiet" type="button" :disabled="currentIndex === 0" @click="goTo(currentIndex - 1)">← 上一题</button>
            <button v-if="currentIndex < questionCount - 1" class="button button--primary" type="button" @click="goTo(currentIndex + 1)">下一题 →</button>
            <button v-else class="button button--primary" type="button" @click="requestSubmit">交卷并看结果</button>
          </div>
          <div v-if="mode === 'mistake-answer'" class="submit-confirm">
            <div><strong>选好答案后提交本题</strong><p>本次结果会追加到这道题的历史记录中。</p></div>
            <button class="button button--primary" type="button" :disabled="!answers[currentQuestion.id]" @click="submitMistakeReview">提交本题</button>
          </div>
          <div v-if="mode === 'answer' && confirmSubmit" class="submit-confirm" role="alertdialog" aria-label="确认交卷">
            <div><strong>{{ unansweredCount ? `还有 ${unansweredCount} 题未作答` : '20题已全部作答' }}</strong><p>交卷后会显示答案、得分并记录本轮错题。</p></div>
            <div><button class="button button--quiet" type="button" @click="confirmSubmit = false">返回检查</button><button class="button button--primary" type="button" @click="submitQuiz">确认交卷</button></div>
          </div>
        </section>

        <aside class="question-nav">
          <div class="question-nav__heading"><strong>{{ mode === 'mistake-answer' ? '单题复测' : '答题卡' }}</strong><span>{{ answeredCount }}/{{ activeQuestionCount }}</span></div>
          <div class="number-grid">
            <button v-for="(question, index) in selectedQuestions" :key="question.id" type="button" :class="{ 'is-current': index === currentIndex, 'is-answered': answers[question.id], 'is-uncertain': uncertainAnswers[question.id] }" :aria-label="`第${index + 1}题${answers[question.id] ? '已作答' : '未作答'}${uncertainAnswers[question.id] ? '，已标记不确定' : ''}`" @click="goTo(index)">{{ index + 1 }}</button>
          </div>
          <div class="nav-legend"><span><i class="legend-dot legend-dot--current"></i>当前题</span><span><i class="legend-dot legend-dot--answered"></i>已作答</span></div>
          <button v-if="mode === 'answer'" class="button button--outline" type="button" @click="requestSubmit">交卷并看结果</button>
          <button v-else class="button button--outline" type="button" :disabled="!answers[currentQuestion.id]" @click="submitMistakeReview">提交本题</button>
          <p>{{ mode === 'mistake-answer' ? '答后立即判分，并保存到本题的历次复测记录。' : '交卷前可以修改任何答案；只有确认交卷后才显示判分。' }}</p>
        </aside>
      </div>
    </template>

    <template v-else-if="mode === 'mistake-result' && mistakeResult">
      <header class="result-hero">
        <span class="eyebrow">单题复测已记录 · {{ formatDate(mistakeResult.finishedAt) }}</span>
        <div class="score-line"><strong>{{ mistakeResult.isCorrect ? '答对' : '再看' }}</strong><b>你的答案 {{ answerText(mistakeResult) }} · 参考答案 {{ mistakeResult.correct }}</b></div>
        <p>本题用时 {{ formatDuration(mistakeResult.durationSeconds) }}<template v-if="mistakeResult.isUncertain"> · 你标记了不确定 / 猜题</template><template v-if="mistakeResult.isSlow"> · 超过该题型复盘阈值</template>。这次结果已追加保存；过去记录仍保留。</p>
        <div class="result-actions">
          <button class="button button--primary" type="button" @click="startMistakeReview(mistakeResult)">再复测一次 →</button>
          <button class="button button--quiet" type="button" @click="mode = 'intro'">回到错题复测库</button>
        </div>
      </header>
      <section class="review-section">
        <div class="section-title"><div><span class="eyebrow">原题与答案</span><h2>{{ mistakeResult.module }} · {{ questionLabel(mistakeResult.number) }}</h2></div></div>
        <article class="result-item result-item--open">
          <div class="result-detail">
            <div v-if="mistakeResult.materialHtml" class="result-material"><b>{{ mistakeResult.materialTitle }}</b><div class="material-content" v-html="formatHtml(mistakeResult.materialHtml)"></div></div>
            <div class="question-content" v-html="formatHtml(mistakeResult.stemHtml)"></div>
            <div class="review-options">
              <div v-for="option in mistakeResult.options" :key="option.label" class="review-option" :class="{ 'review-option--correct': option.label === mistakeResult.correct, 'review-option--wrong': option.label === mistakeResult.answer && !mistakeResult.isCorrect }">
                <span class="answer-letter">{{ option.label }}</span><span v-if="option.html" v-html="formatHtml(option.html)"></span><span v-else>按题干原图选择 {{ option.label }}</span>
              </div>
            </div>
            <p class="source-line">{{ mistakeResult.source }}</p>
            <div class="answer-evidence" :class="`answer-evidence--${mistakeResult.answerEvidence.key}`"><strong>答案依据：{{ mistakeResult.answerEvidence.label }}</strong><span>{{ mistakeResult.answerEvidence.explanation }}</span></div>
            <p v-if="mistakeResult.gradingNote" class="grading-note">{{ mistakeResult.gradingNote }}</p>
            <a v-if="mistakeResult.reviewUrl" class="review-link" :href="pageHref(mistakeResult.reviewUrl)" target="_blank" rel="noopener">打开原题解析 ↗</a>
            <a v-if="mistakeResult.fenbiQuestionUrl" class="review-link review-link--source" :href="mistakeResult.fenbiQuestionUrl" target="_blank" rel="noopener">粉笔题目与答案 ↗</a>
            <a v-if="mistakeResult.sourceUrl" class="review-link review-link--source" :href="mistakeResult.sourceUrl" target="_blank" rel="noopener">查看题库来源 ↗</a>
          </div>
        </article>
        <section class="record-section">
          <div class="section-title"><div><span class="eyebrow">本题档案</span><h2>历次作答</h2></div><span>{{ (questionHistory[mistakeResult.id] || []).length }} 次</span></div>
          <div class="history-list">
            <div v-for="(item, index) in [...(questionHistory[mistakeResult.id] || [])].reverse()" :key="item.sessionId + '-' + index" class="history-row question-history-row">
              <span>{{ formatDate(item.finishedAt) }} · {{ item.kind }}</span><strong>你的答案 {{ item.answer || '未作答' }}</strong><span>参考 {{ item.correct }}</span><span>{{ item.durationScope === 'round' ? '整卷' : '本题' }} {{ formatDuration(item.durationSeconds || 0) }}</span><span :class="item.isCorrect ? 'status-good' : 'status-bad'">{{ item.isCorrect ? '答对' : '答错' }}<template v-if="item.isUncertain"> · 不确定</template><template v-if="item.isSlow"> · 慢题</template></span>
            </div>
          </div>
        </section>
      </section>
      <p v-if="storageWarning" class="storage-warning">当前浏览器没有保存本地记录；关闭页面后，本次记录可能无法保留。</p>
    </template>

    <template v-else>
      <header class="result-hero">
        <span class="eyebrow">本轮复测完成</span>
        <div class="score-line"><strong>{{ correctCount * 5 }}</strong><span>/ 100 分</span><i></i><b>答对 {{ correctCount }} / {{ questionCount }} 题</b></div>
        <p v-if="currentRunScope === 'pending-originals'">本轮用时 {{ formatDuration(elapsedSeconds) }}。这是对已收录原题的复做；即使答对，也不会自动清除“独立运用待验证”状态。</p>
        <p v-else>本轮用时 {{ formatDuration(elapsedSeconds) }}。错题、不确定题和超过既定题型阈值的题会进入本机优先复习；正确答案仍需看题目依据，得分不自动等于掌握。</p>
        <p v-if="evidenceNeedsAttentionCount" class="score-evidence-note">本轮 {{ evidenceNeedsAttentionCount }} 道题的答案依据不是“粉笔题库核对”状态；请逐题查看答案标识和来源说明。</p>
        <div class="result-actions"><button class="button button--primary" type="button" @click="startQuiz(currentRunScope)">再抽20题 →</button><button class="button button--quiet" type="button" @click="mode = 'intro'">回到复测首页</button></div>
      </header>

      <section class="module-results">
        <div class="section-title"><div><span class="eyebrow">按行测模块</span><h2>本轮表现</h2></div><span>仅反映这20题</span></div>
        <div class="module-grid">
          <div v-for="item in moduleStats" :key="item.name" class="module-row">
            <div><strong>{{ item.name }}</strong><span>{{ item.correct }}/{{ item.total }}</span></div>
            <div class="module-track"><span :style="{ width: `${item.total ? (item.correct / item.total) * 100 : 0}%` }"></span></div>
          </div>
        </div>
      </section>

      <section class="review-section">
        <div class="section-title"><div><span class="eyebrow">逐题核对</span><h2>答案与原题</h2></div><span>{{ reviewFlagCount }} 道带复盘标记</span></div>
        <details v-for="(item, index) in results" :key="item.id" class="result-item" :open="!item.isCorrect || item.isUncertain || item.isSlow">
          <summary>
            <span class="result-index" :class="item.isCorrect ? 'result-index--correct' : 'result-index--wrong'">{{ index + 1 }}</span>
            <span class="result-summary-copy"><strong>{{ item.module }} · {{ questionLabel(item.number) }}</strong><small>你的答案：{{ answerText(item) }}　参考答案：{{ item.correct }}　·　本题 {{ formatDuration(item.durationSeconds) }}</small></span>
            <span class="result-status" :class="item.isCorrect ? 'result-status--correct' : 'result-status--wrong'">{{ !item.answer ? '未作答' : item.isCorrect ? '答对' : '答错' }}<template v-if="item.isUncertain"> · 不确定</template><template v-if="item.isSlow"> · 耗时长</template></span>
          </summary>
          <div class="result-detail">
            <div v-if="item.materialHtml" class="result-material"><b>{{ item.materialTitle }}</b><div class="material-content" v-html="formatHtml(item.materialHtml)"></div></div>
            <div class="question-content" v-html="formatHtml(item.stemHtml)"></div>
            <div class="review-options">
              <div v-for="option in item.options" :key="option.label" class="review-option" :class="{ 'review-option--correct': option.label === item.correct, 'review-option--wrong': option.label === item.answer && !item.isCorrect }">
                <span class="answer-letter">{{ option.label }}</span><span v-if="option.html" v-html="formatHtml(option.html)"></span><span v-else>按题干原图选择 {{ option.label }}</span>
              </div>
            </div>
            <p class="source-line">{{ item.source }}</p>
            <div class="answer-evidence" :class="`answer-evidence--${item.answerEvidence.key}`"><strong>答案依据：{{ item.answerEvidence.label }}</strong><span>{{ item.answerEvidence.explanation }}</span></div>
            <p v-if="item.gradingNote" class="grading-note">{{ item.gradingNote }}</p>
            <a v-if="item.reviewUrl" class="review-link" :href="pageHref(item.reviewUrl)" target="_blank" rel="noopener">打开原复盘与解析 ↗</a>
            <a v-if="item.fenbiQuestionUrl" class="review-link review-link--source" :href="item.fenbiQuestionUrl" target="_blank" rel="noopener">粉笔题目与答案 ↗</a>
            <a v-if="item.sourceUrl" class="review-link review-link--source" :href="item.sourceUrl" target="_blank" rel="noopener">查看题库来源 ↗</a>
          </div>
        </details>
      </section>
      <p v-if="storageWarning" class="storage-warning">当前浏览器没有保存本地记录；关闭页面后，本次记录可能无法保留。</p>
    </template>
  </main>
</template>

<style scoped>
.retest-shell { --quiz-accent: var(--vp-c-brand-1); --quiz-accent-soft: var(--vp-c-brand-soft); --quiz-action: var(--vp-c-brand-1); width: min(1180px, 100%); margin: 0 auto; padding: 26px clamp(12px, 2.5vw, 28px) 52px; color: var(--vp-c-text-1); font-family: var(--vp-font-family-base); }
.retest-shell h1, .retest-shell h2, .retest-shell p { margin-top: 0; }
.eyebrow { color: var(--quiz-accent); font-size: 12px; font-weight: 750; letter-spacing: .08em; }
.intro-card { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(220px, .8fr); align-items: center; gap: 28px; padding: clamp(24px, 4vw, 44px); border: 1px solid color-mix(in srgb, var(--quiz-accent) 20%, var(--vp-c-divider)); border-radius: 22px; background: radial-gradient(circle at 90% 10%, color-mix(in srgb, var(--quiz-accent) 12%, transparent), transparent 34%), linear-gradient(140deg, var(--vp-c-bg), var(--vp-c-bg-soft)); }
.intro-copy h1 { margin: 9px 0 10px; border: 0; padding: 0; font-size: clamp(29px, 4vw, 43px); line-height: 1.2; letter-spacing: -.03em; }
.intro-copy p { max-width: 700px; margin-bottom: 21px; color: var(--vp-c-text-2); font-size: 16px; line-height: 1.75; }
.button { display: inline-flex; align-items: center; justify-content: center; gap: 10px; min-height: 44px; padding: 0 17px; border: 1px solid transparent; border-radius: 11px; font: inherit; font-size: 14px; font-weight: 720; cursor: pointer; transition: transform .16s, background .16s, border-color .16s; }
.button:hover:not(:disabled) { transform: translateY(-1px); }
.button:focus-visible { outline: 3px solid color-mix(in srgb, var(--quiz-accent) 40%, transparent); outline-offset: 2px; }
.button:disabled { cursor: not-allowed; opacity: .45; }
.button--primary { color: #fff; background: var(--quiz-action); box-shadow: 0 7px 18px color-mix(in srgb, var(--quiz-action) 20%, transparent); }
.button--primary:hover { background: #274eae; }
.button--quiet { border-color: var(--vp-c-divider); color: var(--vp-c-text-1); background: var(--vp-c-bg); }
.button--quiet:hover, .button--outline:hover { border-color: var(--quiz-accent); color: var(--quiz-accent); }
.library-entry { margin-left: 8px; text-decoration: none; }
.button--outline { width: 100%; border-color: color-mix(in srgb, var(--quiz-accent) 32%, var(--vp-c-divider)); color: var(--quiz-accent); background: var(--vp-c-bg); }
.pending-scope-button { margin-top: 10px; }
.pending-scope-note { display: block; margin-top: 6px; color: var(--vp-c-text-2); font-size: 11px; line-height: 1.55; }
.privacy-note { display: block; margin-top: 11px; color: var(--vp-c-text-2); font-size: 12px; line-height: 1.55; }
.priority-note { display: block; margin-top: 11px; color: var(--vp-c-text-2); font-size: 12px; line-height: 1.6; }
.pool-notice { margin: 12px 0 0; padding: 11px 14px; border: 1px solid var(--vp-c-divider); border-left: 3px solid var(--quiz-accent); border-radius: 10px; color: var(--vp-c-text-2); background: var(--vp-c-bg-soft); font-size: 12px; line-height: 1.6; }
.intro-metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 9px; }
.intro-metrics > div { display: grid; gap: 5px; align-content: center; min-height: 92px; padding: 14px 9px; border: 1px solid var(--vp-c-divider); border-radius: 13px; background: color-mix(in srgb, var(--vp-c-bg) 88%, transparent); text-align: center; }
.intro-metrics strong { color: var(--quiz-accent); font-size: clamp(23px, 3vw, 32px); line-height: 1.1; font-variant-numeric: tabular-nums; }
.intro-metrics span { color: var(--vp-c-text-2); font-size: 11px; line-height: 1.4; }
.how-it-works { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 16px 0; }
.how-it-works > div { display: grid; grid-template-columns: 32px 1fr; gap: 2px 10px; padding: 17px; border: 1px solid var(--vp-c-divider); border-radius: 14px; background: var(--vp-c-bg); }
.how-it-works > div > span { grid-row: span 2; display: grid; place-items: center; width: 30px; height: 30px; border-radius: 9px; color: var(--quiz-accent); background: var(--quiz-accent-soft); font-size: 12px; font-weight: 800; }
.how-it-works b { font-size: 14px; }
.how-it-works small { color: var(--vp-c-text-2); font-size: 12px; line-height: 1.55; }
.record-section, .module-results, .review-section { margin-top: 24px; }
.section-title { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-bottom: 12px; }
.section-title h2 { margin: 3px 0 0; font-size: 21px; }
.section-title > span { color: var(--vp-c-text-2); font-size: 12px; }
.history-list { overflow: hidden; border: 1px solid var(--vp-c-divider); border-radius: 13px; background: var(--vp-c-bg); }
.history-row { display: grid; grid-template-columns: 1.3fr 1fr .7fr .7fr; gap: 10px; align-items: center; padding: 12px 15px; font-size: 13px; }
.history-row + .history-row { border-top: 1px solid var(--vp-c-divider); }
.history-row > span { color: var(--vp-c-text-2); }
.history-row strong { font-variant-numeric: tabular-nums; }
.all-history { margin-top: 10px; border-top: 1px solid var(--vp-c-divider); }
.all-history > summary { padding: 11px 4px 0; color: var(--quiz-accent); font-size: 12px; font-weight: 700; cursor: pointer; }
.mistake-intro { margin: -7px 0 14px; color: var(--vp-c-text-2); font-size: 12px; line-height: 1.7; }
.mistake-tools { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; color: var(--vp-c-text-2); font-size: 11px; }
.mistake-tools input { width: min(100%, 330px); min-height: 40px; padding: 0 12px; border: 1px solid var(--vp-c-divider); border-radius: 10px; color: var(--vp-c-text-1); background: var(--vp-c-bg); font: inherit; font-size: 13px; }
.mistake-tools input:focus-visible { outline: 3px solid color-mix(in srgb, var(--quiz-accent) 32%, transparent); outline-offset: 1px; }
.mistake-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 13px 14px; border: 1px solid var(--vp-c-divider); border-radius: 12px; background: var(--vp-c-bg); }
.mistake-row__copy { display: grid; gap: 5px; min-width: 0; }
.mistake-row__copy > strong { overflow: hidden; color: var(--vp-c-text-1); font-size: 13px; font-weight: 700; text-overflow: ellipsis; }
.mistake-row__copy > small { color: var(--vp-c-text-2); font-size: 11px; line-height: 1.5; }
.mistake-row__tags { display: flex; flex-wrap: wrap; gap: 6px; }
.mistake-row__tags span { padding: 3px 7px; border-radius: 99px; color: var(--quiz-accent); background: var(--quiz-accent-soft); font-size: 10px; font-weight: 700; }
.mistake-date-list { display: grid; gap: 9px; }
.mistake-date-group { overflow: hidden; border: 1px solid var(--vp-c-divider); border-radius: 12px; background: var(--vp-c-bg); }
.mistake-date-group > summary { display: flex; align-items: center; justify-content: space-between; gap: 14px; min-height: 64px; padding: 11px 16px; cursor: pointer; list-style: none; touch-action: manipulation; }
.mistake-date-group > summary::-webkit-details-marker { display: none; }
.mistake-date-group > summary:hover { background: var(--vp-c-bg-soft); }
.mistake-date-group[open] > summary { border-bottom: 1px solid var(--vp-c-divider); background: var(--vp-c-bg-soft); }
.mistake-date-summary__copy { display: grid; gap: 3px; }
.mistake-date-summary__copy strong { color: var(--vp-c-text-1); font-size: 14px; }
.mistake-date-summary__copy small { color: var(--vp-c-text-2); font-size: 11px; }
.mistake-date-chevron { color: var(--quiz-accent); font-size: 19px; line-height: 1; transition: transform .15s ease; }
.mistake-date-group[open] .mistake-date-chevron { transform: rotate(180deg); }
.mistake-date-questions { display: grid; gap: 9px; padding: 10px; }
.mistake-date-question { min-width: 0; padding: 13px 14px; border: 1px solid var(--vp-c-divider); border-radius: 10px; background: var(--vp-c-bg); }
.mistake-date-question__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.mistake-date-question__head .mistake-row__tags { flex: 1; }
.mistake-date-question__title { display: block; margin-top: 8px; color: var(--vp-c-text-1); font-size: 14px; line-height: 1.55; }
.mistake-date-question__stem { overflow-wrap: anywhere; margin: 7px 0 0; color: var(--vp-c-text-1); font-size: 13px; line-height: 1.75; white-space: pre-wrap; }
.mistake-date-question__options { overflow-wrap: anywhere; margin: 6px 0 0; color: var(--vp-c-text-2); font-size: 11px; line-height: 1.7; }
.mistake-date-attempts { display: grid; gap: 4px; margin-top: 9px; padding: 8px 10px; border-radius: 8px; background: var(--vp-c-bg-soft); }
.mistake-date-attempts p { display: flex; flex-wrap: wrap; gap: 3px 12px; margin: 0; color: var(--vp-c-text-2); font-size: 11px; line-height: 1.55; }
.mistake-date-attempts time { color: var(--vp-c-text-1); font-weight: 700; font-variant-numeric: tabular-nums; }
.mistake-date-question__legacy { margin: 8px 0 0; color: var(--vp-c-text-2); font-size: 11px; line-height: 1.6; }
.mistake-review-button { flex: 0 0 auto; width: auto; }
.empty-state { padding: 24px 15px; border: 1px dashed var(--vp-c-divider); border-radius: 12px; color: var(--vp-c-text-2); text-align: center; font-size: 13px; }
.sr-only { position: absolute; overflow: hidden; width: 1px; height: 1px; padding: 0; clip: rect(0, 0, 0, 0); white-space: nowrap; clip-path: inset(50%); }
.status-good { color: #147a50 !important; font-weight: 750; }
.status-bad { color: #b42318 !important; font-weight: 750; }
.result-item--open { padding-top: 14px; }
.question-history-row { grid-template-columns: 1.5fr 1fr .7fr .5fr; }
.source-note { margin-top: 24px; padding: 17px 19px; border: 1px solid var(--vp-c-divider); border-left: 4px solid var(--quiz-accent); border-radius: 12px; background: var(--vp-c-bg-soft); }
.source-note b { font-size: 13px; }
.source-note p { margin: 6px 0 0; color: var(--vp-c-text-2); font-size: 12px; line-height: 1.7; }
.storage-warning { margin: 14px 0 0; color: #b45309; font-size: 13px; }
.quiz-topbar { display: flex; align-items: center; justify-content: space-between; gap: 18px; margin-bottom: 13px; }
.quiz-topbar h1 { margin: 4px 0 0; border: 0; font-size: clamp(23px, 3vw, 30px); }
.timer-pills { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
.timer-pill { display: flex; align-items: center; gap: 8px; padding: 9px 13px; border: 1px solid var(--vp-c-divider); border-radius: 999px; color: var(--vp-c-text-2); background: var(--vp-c-bg); font-size: 12px; }
.timer-pill strong { color: var(--vp-c-text-1); font-size: 14px; font-variant-numeric: tabular-nums; }
.timer-pill--question { border-color: color-mix(in srgb, var(--quiz-accent) 25%, var(--vp-c-divider)); }
.timer-pill--question strong { color: var(--quiz-accent); }
.timer-dot { width: 7px; height: 7px; border-radius: 50%; background: #22a06b; }
.progress-track, .module-track { overflow: hidden; height: 8px; border-radius: 99px; background: var(--vp-c-bg-soft); }
.progress-track > span, .module-track > span { display: block; height: 100%; border-radius: inherit; background: var(--quiz-accent); transition: width .2s; }
.progress-caption { display: flex; justify-content: space-between; margin-top: 6px; color: var(--vp-c-text-2); font-size: 11px; }
.exam-layout { display: grid; grid-template-columns: minmax(0, 1fr) 238px; align-items: start; gap: 18px; margin-top: 16px; }
.question-card, .question-nav, .module-results { border: 1px solid var(--vp-c-divider); border-radius: 16px; background: var(--vp-c-bg); }
.question-card { min-width: 0; padding: clamp(17px, 3vw, 29px); }
.question-meta { display: flex; flex-wrap: wrap; gap: 7px; margin-bottom: 18px; }
.question-meta span { padding: 5px 9px; border-radius: 999px; color: var(--quiz-accent); background: var(--quiz-accent-soft); font-size: 11px; font-weight: 650; }
.shared-material { margin: 0 0 18px; padding: 13px 15px; border: 1px solid var(--vp-c-divider); border-radius: 12px; background: var(--vp-c-bg-soft); }
.shared-material summary { color: var(--vp-c-text-1); font-size: 13px; font-weight: 750; cursor: pointer; }
.shared-material summary small { margin-left: 8px; color: var(--vp-c-text-2); font-size: 11px; font-weight: 450; }
.material-content { padding-top: 12px; color: var(--vp-c-text-2); font-size: 14px; line-height: 1.75; }
.question-content { margin: 0 0 18px; font-size: 17px; line-height: 1.9; }
.question-content :deep(p) { margin: 0 0 12px; }
.question-content :deep(img), .material-content :deep(img), .answer-option__content :deep(img), .review-option :deep(img) { display: block; max-width: 100%; height: auto; margin: 10px auto; border-radius: 7px; }
.question-content :deep(a), .material-content :deep(a) { color: var(--quiz-accent); }
.answer-options { display: grid; gap: 9px; min-width: 0; margin: 0; padding: 0; border: 0; }
.answer-options legend { margin-bottom: 8px; color: var(--vp-c-text-2); font-size: 12px; }
.answer-option { display: grid; grid-template-columns: 1px 30px minmax(0, 1fr); align-items: start; gap: 11px; min-width: 0; padding: 12px 13px; border: 1px solid var(--vp-c-divider); border-radius: 12px; background: var(--vp-c-bg); cursor: pointer; transition: border-color .15s, background .15s; }
.answer-option:hover, .answer-option.is-selected { border-color: var(--quiz-accent); background: var(--quiz-accent-soft); }
.answer-option input { width: 1px; height: 1px; margin: 0; opacity: .01; }
.answer-option input:focus-visible + .answer-letter { outline: 3px solid color-mix(in srgb, var(--quiz-accent) 40%, transparent); outline-offset: 2px; }
.answer-letter { display: inline-grid; place-items: center; width: 29px; height: 29px; border: 1px solid var(--vp-c-divider); border-radius: 9px; color: var(--vp-c-text-2); background: var(--vp-c-bg-soft); font-size: 12px; font-weight: 800; }
.answer-option.is-selected .answer-letter { border-color: var(--quiz-action); color: #fff; background: var(--quiz-action); }
.answer-option__content { min-width: 0; padding-top: 3px; font-size: 14px; line-height: 1.65; }
.answer-option__content :deep(p) { margin: 0; }
.source-line { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 5px 12px; margin: 16px 0 0; padding-top: 12px; border-top: 1px solid var(--vp-c-divider); color: var(--vp-c-text-2); font-size: 11px; line-height: 1.55; }
.question-review-tools { display: flex; align-items: center; flex-wrap: wrap; gap: 9px 12px; margin-top: 12px; }
.question-review-tools > small { color: var(--vp-c-text-2); font-size: 11px; line-height: 1.5; }
.uncertainty-button { min-height: 36px; padding: 0 11px; border: 1px solid var(--vp-c-divider); border-radius: 9px; color: var(--vp-c-text-2); background: var(--vp-c-bg); font: inherit; font-size: 11px; font-weight: 700; cursor: pointer; }
.uncertainty-button:hover, .uncertainty-button.active { border-color: #c2841b; color: #8a5700; background: #fff7e7; }
.uncertainty-button:focus-visible { outline: 3px solid color-mix(in srgb, #c2841b 35%, transparent); outline-offset: 2px; }
.question-actions, .result-actions { display: flex; justify-content: space-between; gap: 10px; margin-top: 19px; }
.submit-confirm { display: flex; justify-content: space-between; align-items: center; gap: 18px; margin-top: 16px; padding: 15px; border: 1px solid color-mix(in srgb, var(--quiz-accent) 28%, var(--vp-c-divider)); border-radius: 12px; background: var(--quiz-accent-soft); }
.submit-confirm strong { font-size: 13px; }
.submit-confirm p { margin: 3px 0 0; color: var(--vp-c-text-2); font-size: 12px; line-height: 1.5; }
.submit-confirm > div:last-child { display: flex; flex-shrink: 0; gap: 8px; }
.submit-confirm .button { min-height: 38px; padding: 0 12px; font-size: 12px; }
.question-nav { position: sticky; top: calc(var(--vp-nav-height) + 18px); padding: 17px; }
.question-nav__heading { display: flex; justify-content: space-between; color: var(--vp-c-text-1); font-size: 13px; }
.question-nav__heading span { color: var(--vp-c-text-2); font-variant-numeric: tabular-nums; }
.number-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 7px; margin: 14px 0; }
.number-grid button { aspect-ratio: 1; min-width: 0; border: 1px solid var(--vp-c-divider); border-radius: 9px; color: var(--vp-c-text-2); background: var(--vp-c-bg); font-size: 12px; font-weight: 700; cursor: pointer; }
.number-grid button.is-current { border-color: var(--quiz-accent); color: #fff; background: var(--quiz-accent); }
.number-grid button.is-answered:not(.is-current) { border-color: #9dd9bf; color: #137a50; background: #eaf8f0; }
.number-grid button.is-uncertain:not(.is-current) { border-color: #d8a343; color: #895400; background: #fff5dc; }
.nav-legend { display: flex; justify-content: space-between; margin: 0 0 14px; color: var(--vp-c-text-2); font-size: 10px; }
.nav-legend span { display: flex; align-items: center; gap: 5px; }
.legend-dot { width: 8px; height: 8px; border-radius: 3px; background: var(--vp-c-bg-soft); }
.legend-dot--current { background: var(--quiz-accent); }
.legend-dot--answered { background: #9dd9bf; }
.question-nav > p { margin: 10px 0 0; color: var(--vp-c-text-2); font-size: 11px; line-height: 1.6; }
.result-hero { padding: clamp(22px, 4vw, 38px); border: 1px solid color-mix(in srgb, var(--quiz-accent) 20%, var(--vp-c-divider)); border-radius: 19px; background: radial-gradient(circle at 90% 0, color-mix(in srgb, var(--quiz-accent) 11%, transparent), transparent 32%), var(--vp-c-bg-soft); }
.score-line { display: flex; align-items: baseline; flex-wrap: wrap; gap: 8px; margin: 5px 0 8px; }
.score-line > strong { color: var(--quiz-accent); font-size: clamp(44px, 8vw, 66px); line-height: 1; font-variant-numeric: tabular-nums; }
.score-line > span { color: var(--vp-c-text-2); font-size: 15px; }
.score-line > i { width: 1px; height: 18px; margin: 0 5px; background: var(--vp-c-divider); }
.score-line > b { font-size: 15px; }
.result-hero > p { max-width: 790px; margin: 8px 0 0; color: var(--vp-c-text-2); font-size: 13px; line-height: 1.7; }
.score-evidence-note { padding: 9px 12px; border-left: 3px solid #ca8b24; border-radius: 6px; background: color-mix(in srgb, #f6c95f 15%, var(--vp-c-bg)); }
.result-actions { justify-content: flex-start; }
.module-results { padding: 20px; }
.module-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 25px; }
.module-row > div:first-child { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 12px; }
.module-row > div:first-child span { color: var(--vp-c-text-2); font-variant-numeric: tabular-nums; }
.module-track { height: 7px; }
.review-section { display: grid; gap: 8px; }
.result-item { overflow: hidden; border: 1px solid var(--vp-c-divider); border-radius: 13px; background: var(--vp-c-bg); }
.result-item > summary { display: flex; align-items: center; gap: 11px; padding: 12px 15px; cursor: pointer; list-style: none; }
.result-item > summary::-webkit-details-marker { display: none; }
.result-index { display: grid; flex: 0 0 auto; place-items: center; width: 28px; height: 28px; border-radius: 9px; font-size: 12px; font-weight: 800; }
.result-index--correct { color: #147a50; background: #e6f7ee; }
.result-index--wrong { color: #b42318; background: #fff0ee; }
.result-summary-copy { display: grid; flex: 1; gap: 2px; min-width: 0; }
.result-summary-copy strong { font-size: 13px; }
.result-summary-copy small { color: var(--vp-c-text-2); font-size: 11px; line-height: 1.5; }
.result-status { font-size: 11px; font-weight: 750; }
.result-status--correct { color: #147a50; }
.result-status--wrong { color: #b42318; }
.result-detail { padding: 0 16px 17px; border-top: 1px solid var(--vp-c-divider); }
.result-material { margin: 13px 0; padding: 11px 13px; border-radius: 10px; background: var(--vp-c-bg-soft); font-size: 12px; }
.result-material > b { color: var(--vp-c-text-2); }
.result-material .material-content { padding-top: 6px; font-size: 12px; }
.result-detail > .question-content { margin-top: 14px; font-size: 15px; }
.review-options { display: grid; gap: 6px; }
.review-option { display: grid; grid-template-columns: 27px minmax(0, 1fr); align-items: start; gap: 9px; padding: 8px 10px; border: 1px solid var(--vp-c-divider); border-radius: 9px; font-size: 12px; line-height: 1.6; }
.review-option--correct { border-color: #9dd9bf; background: #eaf8f0; }
.review-option--wrong { border-color: #f2b9b3; background: #fff4f2; }
.review-option .answer-letter { width: 25px; height: 25px; font-size: 11px; }
.review-option :deep(p) { margin: 0; }
.grading-note { margin: 12px 0 0; color: var(--vp-c-text-2); font-size: 12px; line-height: 1.7; }
.answer-evidence { display: grid; gap: 4px; margin-top: 12px; padding: 11px 13px; border: 1px solid var(--vp-c-divider); border-left: 3px solid var(--quiz-accent); border-radius: 9px; background: var(--vp-c-bg-soft); }
.answer-evidence strong { font-size: 12px; }
.answer-evidence span { color: var(--vp-c-text-2); font-size: 11px; line-height: 1.6; }
.answer-evidence--fenbi { border-left-color: #14865d; }
.answer-evidence--fenbi strong { color: #147a50; }
.answer-evidence--disputed, .answer-evidence--upstream, .answer-evidence--unknown, .answer-evidence--personal { border-left-color: #c2841b; }
.review-flag { border: 1px solid currentColor; }
.review-flag--uncertain { color: #8a5700 !important; background: #fff4d6 !important; }
.review-flag--slow { color: #175d64 !important; background: #e9f6f6 !important; }
.review-link { display: inline-flex; margin-top: 13px; color: var(--quiz-accent); font-size: 12px; font-weight: 700; text-decoration: none; }
.review-link--source { margin-left: 16px; }
.review-link:hover { text-decoration: underline; }
:global(.dark) .retest-shell { --quiz-accent: var(--vp-c-brand-1); --quiz-accent-soft: var(--vp-c-brand-soft); --quiz-action: #315DCB; }
:global(.dark) .button--primary:hover { background: #274eae; }
:global(.dark) .number-grid button.is-current { border-color: var(--quiz-action); background: var(--quiz-action); }
:global(.dark) .number-grid button.is-answered:not(.is-current) { border-color: #286449; color: #8ee0b5; background: #163d2d; }
:global(.dark) .number-grid button.is-uncertain:not(.is-current), :global(.dark) .uncertainty-button:hover, :global(.dark) .uncertainty-button.active { border-color: #8b692a; color: #f4ce83; background: #3b301a; }
:global(.dark) .review-flag--uncertain { color: #f4ce83 !important; background: #3b301a !important; }
:global(.dark) .review-flag--slow { color: #97d7dc !important; background: #17383c !important; }
:global(.dark) .answer-evidence--fenbi strong { color: #8ee0b5; }
:global(.dark) .result-index--correct, :global(.dark) .review-option--correct { border-color: #286449; color: #a5e7c2; background: #163d2d; }
:global(.dark) .result-index--wrong, :global(.dark) .review-option--wrong { border-color: #713933; color: #ffbab1; background: #3c201e; }
@media (max-width: 850px) {
  .intro-card { grid-template-columns: 1fr; }
  .intro-metrics { max-width: 430px; }
  .exam-layout { grid-template-columns: minmax(0, 1fr); }
  .question-nav { position: static; }
  .number-grid { grid-template-columns: repeat(10, minmax(0, 1fr)); }
}
@media (max-width: 600px) {
  .retest-shell { padding: 16px 12px 36px; }
  .intro-card { gap: 22px; padding: 22px 18px; border-radius: 17px; }
  .intro-copy p { font-size: 14px; }
  .intro-metrics > div { min-height: 72px; padding: 10px 5px; }
  .intro-metrics span { font-size: 10px; }
  .how-it-works { grid-template-columns: 1fr; gap: 8px; }
  .how-it-works > div { padding: 12px; }
  .quiz-topbar { align-items: flex-start; }
  .timer-pills { gap: 6px; }
  .timer-pill { gap: 6px; padding: 8px 10px; }
  .timer-pill span { font-size: 10px; }
  .timer-pill strong { font-size: 12px; }
  .question-card { padding: 16px 13px; }
  .question-content { font-size: 15px; line-height: 1.8; }
  .mistake-row { align-items: flex-start; gap: 10px; padding: 11px; }
  .mistake-row__copy > strong { white-space: normal; }
  .mistake-review-button { min-height: 38px; padding: 0 10px; font-size: 11px; }
  .mistake-tools { align-items: stretch; flex-direction: column; }
  .mistake-tools input { width: 100%; }
  .mistake-date-group > summary { min-height: 58px; padding: 10px 12px; }
  .mistake-date-questions { gap: 7px; padding: 7px; }
  .mistake-date-question { padding: 10px; }
  .mistake-date-question__head { align-items: flex-start; }
  .mistake-date-question__head .mistake-review-button { min-height: 34px; }
  .mistake-date-question__stem { font-size: 12px; }
  .mistake-date-question__options { font-size: 10px; }
  .history-row, .question-history-row { grid-template-columns: 1fr auto; gap: 5px 12px; padding: 10px 11px; }
  .history-row > :nth-child(3), .history-row > :nth-child(4) { justify-self: end; }
  .answer-option { grid-template-columns: 1px 27px minmax(0, 1fr); gap: 8px; padding: 10px 9px; }
  .answer-letter { width: 26px; height: 26px; }
  .answer-option__content { font-size: 13px; }
  .question-actions .button { min-height: 42px; padding: 0 12px; }
  .submit-confirm { align-items: flex-start; flex-direction: column; }
  .submit-confirm > div:last-child { width: 100%; }
  .submit-confirm .button { flex: 1; }
  .number-grid { grid-template-columns: repeat(5, minmax(0, 1fr)); }
  .module-grid { grid-template-columns: 1fr; }
  .module-results { padding: 16px 13px; }
  .result-actions { flex-wrap: wrap; }
  .result-actions .button { flex: 1 1 auto; }
  .result-item > summary { gap: 8px; padding: 11px 10px; }
  .result-summary-copy strong { font-size: 12px; }
  .result-summary-copy small { font-size: 10px; }
  .result-detail { padding: 0 11px 14px; }
  .history-row { grid-template-columns: 1.2fr 1fr .6fr; padding: 10px 11px; font-size: 11px; }
  .history-row > span:last-child { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .retest-shell *, .retest-shell *::before, .retest-shell *::after { scroll-behavior: auto !important; transition-duration: .01ms !important; }
}
</style>
