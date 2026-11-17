<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { withBase } from 'vitepress'
import bank from './questions.json'
import skillPool from './xingcezhenti-pool.json'
import { fetchSkillQuestions, normalizeQuestionText } from '../scripts/xingcezhenti-runtime.mjs'

const questionCount = 20
const storageKey = 'xuexi-notes:retest-prototype:v1'
const questions = bank.questions
const mode = ref('intro')
const questionArchive = ref({})
const selectedQuestions = ref([])
const answers = ref({})
const currentIndex = ref(0)
const startedAt = ref(0)
const submittedAt = ref(0)
const now = ref(Date.now())
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
let skillIndexPromise = null

const currentQuestion = computed(() => selectedQuestions.value[currentIndex.value])
const activeQuestionCount = computed(() => mode.value === 'mistake-answer' ? 1 : questionCount)
const answeredCount = computed(() => Object.keys(answers.value).filter((id) => answers.value[id]).length)
const unansweredCount = computed(() => Math.max(0, activeQuestionCount.value - answeredCount.value))
const elapsedSeconds = computed(() => startedAt.value
  ? Math.max(0, Math.floor(((submittedAt.value || now.value) - startedAt.value) / 1000))
  : 0)
const progress = computed(() => Math.round((answeredCount.value / activeQuestionCount.value) * 100))
const availableQuestions = computed(() => [
  ...questions,
  ...Object.values(questionArchive.value).filter((question) => !questions.some((item) => item.id === question.id)),
])
const bankedMistakeCount = computed(() => availableQuestions.value.filter((question) => mistakeCounts.value[question.id]).length)
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
const visibleMistakeRecords = computed(() => {
  const query = mistakeFilter.value.trim().toLocaleLowerCase()
  if (!query) return mistakeRecords.value
  return mistakeRecords.value.filter(({ question }) => [question.module, question.type, question.source, question.title, question.number]
    .filter(Boolean).join(' ').toLocaleLowerCase().includes(query))
})
const pendingMistakeCount = computed(() => mistakeRecords.value.filter((record) => record.lastAttempt?.isCorrect === false).length)
const results = computed(() => selectedQuestions.value.map((question) => ({
  ...question,
  answer: answers.value[question.id] || '',
  isCorrect: answers.value[question.id] === question.correct,
})))
const correctCount = computed(() => results.value.filter((item) => item.isCorrect).length)
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

async function loadSkillIndex() {
  if (!skillIndexPromise) {
    skillIndexPromise = fetch(withBase('/retest/xingcezhenti-index.json'), { cache: 'force-cache' })
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

async function drawQuestions() {
  const previousMistakes = availableQuestions.value
    .filter((question) => mistakeCounts.value[question.id] || questionHistory.value[question.id]?.some((item) => !item.isCorrect))
    .sort((a, b) => (mistakeCounts.value[b.id] || 0) - (mistakeCounts.value[a.id] || 0)
      || (questionHistory.value[b.id]?.at(-1)?.finishedAt || '').localeCompare(questionHistory.value[a.id]?.at(-1)?.finishedAt || ''))
  const priority = previousMistakes.slice(0, 10)
  const chosen = new Set(priority.map((question) => question.id))
  const localPool = shuffle(questions.filter((question) => !isSkillQuestion(question) && !chosen.has(question.id)))
  const localQuestions = localPool.slice(0, Math.min(1, questionCount - priority.length))
  for (const question of localQuestions) chosen.add(question.id)

  const skillCount = questionCount - priority.length - localQuestions.length
  let remote = { questions: [], failures: [] }
  if (skillCount > 0) {
    const knownSkillQuestions = questions.filter(isSkillQuestion)
    const excludedIds = new Set([
      ...Object.keys(questionHistory.value),
      ...Object.keys(mistakeCounts.value),
      ...chosen,
    ])
    const excludedTexts = new Set(knownSkillQuestions.map(questionFingerprint).filter(Boolean))
    const index = await loadSkillIndex()
    remote = await fetchSkillQuestions({
      index,
      pool: skillPool,
      targetCounts: allocateModuleTargets(skillCount),
      excludedIds,
      excludedTexts,
    })
  }

  const remoteIds = new Set(remote.questions.map((question) => question.id))
  for (const id of remoteIds) chosen.add(id)
  const fallback = shuffle(availableQuestions.value.filter((question) => !chosen.has(question.id)))
  const selected = [...priority, ...localQuestions, ...remote.questions]
  const complete = [...selected, ...fallback.slice(0, questionCount - selected.length)]
  if (complete.length !== questionCount) throw new Error('当前可用题目不足20道，暂时无法开始。')

  const localFill = questionCount - priority.length - remote.questions.length
  const sourceFailures = remote.failures.length
  poolNotice.value = remote.questions.length === skillCount
    ? `本轮从2020年及以后技能真题池抽取 ${remote.questions.length} 道，并优先安排 ${priority.length} 道曾错题。`
    : `技能题源本轮载入 ${remote.questions.length} 道；其余 ${localFill} 道由网站现有题库补齐。${sourceFailures ? '部分来源文件未能读取，已自动跳过。' : ''}`
  return shuffle(complete)
}

async function startQuiz() {
  if (loadingQuiz.value) return
  loadingQuiz.value = true
  poolNotice.value = ''
  try {
    selectedQuestions.value = await drawQuestions()
    answers.value = {}
    currentIndex.value = 0
    startedAt.value = Date.now()
    submittedAt.value = 0
    confirmSubmit.value = false
    mode.value = 'answer'
    scrollToTop()
  } catch (error) {
    poolNotice.value = `${error.message} 本轮未开始；可以重试，网络不可用时请稍后再试。`
  } finally {
    loadingQuiz.value = false
  }
}

function startMistakeReview(question) {
  selectedQuestions.value = [question]
  answers.value = {}
  currentIndex.value = 0
  startedAt.value = Date.now()
  submittedAt.value = 0
  mistakeResult.value = null
  confirmSubmit.value = false
  mode.value = 'mistake-answer'
  scrollToTop()
}

function selectAnswer(label) {
  if (!currentQuestion.value) return
  answers.value[currentQuestion.value.id] = label
}

function goTo(index) {
  if (index < 0 || index >= questionCount) return
  currentIndex.value = index
  confirmSubmit.value = false
  scrollToTop()
}

function requestSubmit() {
  confirmSubmit.value = true
}

function submitQuiz() {
  submittedAt.value = Date.now()
  const nextMistakes = { ...mistakeCounts.value }
  const attempt = {
    id: `${submittedAt.value}-${Math.random().toString(36).slice(2, 8)}`,
    finishedAt: new Date(submittedAt.value).toISOString(),
    durationSeconds: elapsedSeconds.value,
    correct: correctCount.value,
    total: questionCount,
    answers: results.value.map(({ id, answer, correct, isCorrect }) => ({ id, answer, correct, isCorrect })),
  }

  for (const item of results.value) {
    if (!item.isCorrect) nextMistakes[item.id] = (nextMistakes[item.id] || 0) + 1
    recordQuestionAttempt(item, attempt.id, '20题复测', attempt.durationSeconds)
  }
  const nextArchive = { ...questionArchive.value }
  for (const item of results.value) {
    if (isSkillQuestion(item) && !item.isCorrect) nextArchive[item.id] = item
  }
  attempts.value = [attempt, ...attempts.value]
  mistakeCounts.value = nextMistakes
  questionArchive.value = nextArchive
  persistLocalRecords()
  confirmSubmit.value = false
  mode.value = 'result'
  scrollToTop()
}

function submitMistakeReview() {
  const question = currentQuestion.value
  if (!question || !answers.value[question.id]) return
  submittedAt.value = Date.now()
  const answer = answers.value[question.id]
  const result = {
    ...question,
    answer,
    isCorrect: answer === question.correct,
    durationSeconds: elapsedSeconds.value,
    finishedAt: new Date(submittedAt.value).toISOString(),
  }
  const id = `${submittedAt.value}-${Math.random().toString(36).slice(2, 8)}`
  recordQuestionAttempt(result, id, '单题复测', result.durationSeconds)
  if (!result.isCorrect) mistakeCounts.value = { ...mistakeCounts.value, [question.id]: (mistakeCounts.value[question.id] || 0) + 1 }
  mistakeResult.value = result
  persistLocalRecords()
  mode.value = 'mistake-result'
  scrollToTop()
}

function recordQuestionAttempt(item, sessionId, kind, durationSeconds) {
  const record = {
    sessionId,
    finishedAt: new Date(submittedAt.value).toISOString(),
    kind,
    answer: item.answer || '',
    correct: item.correct,
    isCorrect: Boolean(item.isCorrect),
    durationSeconds,
  }
  questionHistory.value = {
    ...questionHistory.value,
    [item.id]: [...(questionHistory.value[item.id] || []), record],
  }
}

function persistLocalRecords() {
  try {
    localStorage.setItem(storageKey, JSON.stringify({
      schemaVersion: 2,
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
      questionHistory.value = saved.questionHistory
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
  return new Date(value).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function answerText(item) {
  return item.answer ? item.answer : '未作答'
}

function questionLabel(number) {
  return typeof number === 'number' ? '第 ' + number + ' 题' : number
}

onMounted(() => {
  readLocalRecords()
  timer = window.setInterval(() => { now.value = Date.now() }, 1000)
})

onBeforeUnmount(() => {
  if (timer) window.clearInterval(timer)
})
</script>

<template>
  <main class="retest-shell">
    <template v-if="mode === 'intro'">
      <header class="intro-card">
        <div class="intro-copy">
          <span class="eyebrow">行测复测 · 全站错题持续积累</span>
          <h1>错题再练，交卷即看结果</h1>
          <p>每次抽取20道题：从2020年及以后的技能真题源按需加载，也会保留网站已有题目；以前错过的题优先进入本轮。交卷后自动计分，历次作答留在当前浏览器。</p>
          <button class="button button--primary" type="button" :disabled="loadingQuiz" @click="startQuiz">{{ loadingQuiz ? '正在从真题库抽题…' : '开始20题复测' }} <span v-if="!loadingQuiz" aria-hidden="true">→</span></button>
          <a class="button button--quiet library-entry" :href="withBase('/retest/library/')">查看全站题库 →</a>
          <a class="button button--quiet library-entry" :href="withBase('/retest/essay.html')">申论复测 →</a>
          <small class="privacy-note">新记录保存在当前浏览器，可按题查看历次作答；不改写原有成绩和复测台账。</small>
        </div>
        <div class="intro-metrics" aria-label="复测题库信息">
          <div><strong>{{ skillPool.indexedQuestions.toLocaleString('zh-CN') }}</strong><span>道技能真题（2020+）</span></div>
          <div><strong>20</strong><span>题 / 每次</span></div>
          <div><strong>{{ bankedMistakeCount }}</strong><span>道曾经答错</span></div>
        </div>
      </header>
      <p v-if="poolNotice" class="pool-notice" role="status">{{ poolNotice }}</p>

      <section class="how-it-works" aria-label="测验流程">
        <div><span>01</span><b>抽题</b><small>从2020年起的技能真题源抽题；网站已有题和曾错题继续保留。</small></div>
        <div><span>02</span><b>作答</b><small>可跳题、改答案，也可返回检查；答案暂不显示。</small></div>
        <div><span>03</span><b>复习</b><small>历次作答按题保存，错题可单独重做，重复错误不会覆盖旧记录。</small></div>
      </section>

      <section class="record-section" v-if="attempts.length">
        <div class="section-title"><div><span class="eyebrow">当前浏览器</span><h2>最近复测记录</h2></div><span>{{ attempts.length }} 次</span></div>
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
          <div><span class="eyebrow">逐题历史 · 当前浏览器</span><h2>我的行测错题复测库</h2></div>
          <span>{{ mistakeRecords.length }} 道曾错 · {{ pendingMistakeCount }} 道最近仍错</span>
        </div>
        <p class="mistake-intro">错过一次就会留在这里。以后每次整卷复测和单题复测都会追加一条记录；最近做对也不会删除以前的错答。</p>
        <div v-if="mistakeRecords.length" class="mistake-tools">
          <label><span class="sr-only">筛选错题</span><input v-model="mistakeFilter" type="search" placeholder="按模块、题目或来源搜索"></label>
          <span>按最近仍错和累计错答次数排序</span>
        </div>
        <div v-if="visibleMistakeRecords.length" class="mistake-list">
          <article v-for="record in visibleMistakeRecords" :key="record.question.id" class="mistake-row">
            <div class="mistake-row__copy">
              <div class="mistake-row__tags"><span>{{ record.question.module }}</span><span>{{ questionLabel(record.question.number) }}</span></div>
              <strong>{{ record.question.title || record.question.source }}</strong>
              <small>
                累计错答 {{ record.wrongCount }} 次
                <template v-if="record.lastAttempt"> · 最近{{ record.lastAttempt.isCorrect ? '答对' : '答错/未答' }}于 {{ formatDate(record.lastAttempt.finishedAt) }}</template>
                <template v-else> · 旧记录日期未保存</template>
                <template v-if="record.history.length"> · 共记录 {{ record.history.length }} 次作答</template>
              </small>
            </div>
            <button class="button button--outline mistake-review-button" type="button" @click="startMistakeReview(record.question)">单独再做</button>
          </article>
        </div>
        <div v-else-if="mistakeRecords.length" class="empty-state">没有找到匹配题目，换个模块名或关键词试试。</div>
        <div v-else class="empty-state">还没有行测错题记录。完成第一组复测后，错题会自动出现在这里。</div>
      </section>

      <aside class="source-note">
        <b>题库从哪里来</b>
        <p>技能题源覆盖2020—2026年六个模块，共 {{ skillPool.indexedQuestions.toLocaleString('zh-CN') }} 道、{{ skillPool.eligibleSourceFiles.toLocaleString('zh-CN') }} 份原题文件，题目在点击开始后从固定版本按需读取并校验；这样不用把约百兆原始资料一次塞进网页。网站本身另有 {{ bank.imported }} 道已整理题，包括综合真题、历史错题和知识点例题。<a :href="skillPool.questionCountSources[0]" target="_blank" rel="noopener">查看上游模块索引 ↗</a></p>
        <p>技能题的参考答案取自对应固定版原卷，尚未逐题与粉笔核对；遇到题面或答案疑问时，需按同题版本到粉笔核对。只有完整四选项且答案明确为A—D的题进入自动判分。浏览器保存每题历次作答；熟题得分不代表陌生题水平。</p>
        <p><a :href="pageHref('/retest/answer-evidence')">查看答案核对记录（含答案）↗</a></p>
      </aside>
      <p v-if="storageWarning" class="storage-warning">当前浏览器没有保存本地记录；关闭页面后，本次记录可能无法保留。</p>
    </template>

    <template v-else-if="(mode === 'answer' || mode === 'mistake-answer') && currentQuestion">
      <header class="quiz-topbar">
        <div><span class="eyebrow">{{ mode === 'mistake-answer' ? '行测单题复测' : '行测20题复测' }} · 第 {{ currentIndex + 1 }} / {{ activeQuestionCount }} 题</span><h1>按自己的节奏完成</h1></div>
        <div class="timer-pill"><span class="timer-dot"></span><span>用时</span><strong>{{ formatDuration(elapsedSeconds) }}</strong></div>
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
            <button v-for="(question, index) in selectedQuestions" :key="question.id" type="button" :class="{ 'is-current': index === currentIndex, 'is-answered': answers[question.id] }" :aria-label="`第${index + 1}题${answers[question.id] ? '已作答' : '未作答'}`" @click="goTo(index)">{{ index + 1 }}</button>
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
        <p>用时 {{ formatDuration(mistakeResult.durationSeconds) }}。这次结果已追加保存；过去答错记录仍保留。</p>
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
              <span>{{ formatDate(item.finishedAt) }} · {{ item.kind }}</span><strong>你的答案 {{ item.answer || '未作答' }}</strong><span>参考 {{ item.correct }}</span><span :class="item.isCorrect ? 'status-good' : 'status-bad'">{{ item.isCorrect ? '答对' : '答错' }}</span>
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
        <p>本轮用时 {{ formatDuration(elapsedSeconds) }}。答错和未作答的题已加入本机优先复测列表；答对只记本轮结果，不自动判定为已掌握。</p>
        <div class="result-actions"><button class="button button--primary" type="button" @click="startQuiz">再抽20题 →</button><button class="button button--quiet" type="button" @click="mode = 'intro'">回到复测首页</button></div>
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
        <div class="section-title"><div><span class="eyebrow">逐题核对</span><h2>答案与原题</h2></div><span>{{ results.filter((item) => !item.isCorrect).length }} 道需回看</span></div>
        <details v-for="(item, index) in results" :key="item.id" class="result-item" :open="!item.isCorrect">
          <summary>
            <span class="result-index" :class="item.isCorrect ? 'result-index--correct' : 'result-index--wrong'">{{ index + 1 }}</span>
            <span class="result-summary-copy"><strong>{{ item.module }} · {{ questionLabel(item.number) }}</strong><small>你的答案：{{ answerText(item) }}　参考答案：{{ item.correct }}</small></span>
            <span class="result-status" :class="item.isCorrect ? 'result-status--correct' : 'result-status--wrong'">{{ !item.answer ? '未作答' : item.isCorrect ? '答对' : '答错' }}</span>
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
.retest-shell { --quiz-accent: #4f46e5; --quiz-accent-soft: rgba(79,70,229,.09); width: min(1180px, 100%); margin: 0 auto; padding: 26px clamp(12px, 2.5vw, 28px) 52px; color: var(--vp-c-text-1); font-family: var(--vp-font-family-base); }
.retest-shell h1, .retest-shell h2, .retest-shell p { margin-top: 0; }
.eyebrow { color: var(--quiz-accent); font-size: 12px; font-weight: 750; letter-spacing: .08em; }
.intro-card { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(220px, .8fr); align-items: center; gap: 28px; padding: clamp(24px, 4vw, 44px); border: 1px solid #d8daf7; border-radius: 22px; background: radial-gradient(circle at 90% 10%, rgba(99,102,241,.14), transparent 34%), linear-gradient(140deg, var(--vp-c-bg), var(--vp-c-bg-soft)); }
.intro-copy h1 { margin: 9px 0 10px; border: 0; padding: 0; font-size: clamp(29px, 4vw, 43px); line-height: 1.2; letter-spacing: -.03em; }
.intro-copy p { max-width: 700px; margin-bottom: 21px; color: var(--vp-c-text-2); font-size: 16px; line-height: 1.75; }
.button { display: inline-flex; align-items: center; justify-content: center; gap: 10px; min-height: 44px; padding: 0 17px; border: 1px solid transparent; border-radius: 11px; font: inherit; font-size: 14px; font-weight: 720; cursor: pointer; transition: transform .16s, background .16s, border-color .16s; }
.button:hover:not(:disabled) { transform: translateY(-1px); }
.button:focus-visible { outline: 3px solid rgba(79,70,229,.35); outline-offset: 2px; }
.button:disabled { cursor: not-allowed; opacity: .45; }
.button--primary { color: #fff; background: var(--quiz-accent); box-shadow: 0 7px 18px rgba(79,70,229,.16); }
.button--primary:hover { background: #4338ca; }
.button--quiet { border-color: var(--vp-c-divider); color: var(--vp-c-text-1); background: var(--vp-c-bg); }
.button--quiet:hover, .button--outline:hover { border-color: var(--quiz-accent); color: var(--quiz-accent); }
.library-entry { margin-left: 8px; text-decoration: none; }
.button--outline { width: 100%; border-color: #c7c9f2; color: var(--quiz-accent); background: var(--vp-c-bg); }
.privacy-note { display: block; margin-top: 11px; color: var(--vp-c-text-2); font-size: 12px; line-height: 1.55; }
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
.mistake-tools input:focus-visible { outline: 3px solid rgba(79,70,229,.25); outline-offset: 1px; }
.mistake-list { display: grid; gap: 8px; }
.mistake-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 13px 14px; border: 1px solid var(--vp-c-divider); border-radius: 12px; background: var(--vp-c-bg); }
.mistake-row__copy { display: grid; gap: 5px; min-width: 0; }
.mistake-row__copy > strong { overflow: hidden; color: var(--vp-c-text-1); font-size: 13px; font-weight: 700; text-overflow: ellipsis; }
.mistake-row__copy > small { color: var(--vp-c-text-2); font-size: 11px; line-height: 1.5; }
.mistake-row__tags { display: flex; flex-wrap: wrap; gap: 6px; }
.mistake-row__tags span { padding: 3px 7px; border-radius: 99px; color: var(--quiz-accent); background: var(--quiz-accent-soft); font-size: 10px; font-weight: 700; }
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
.timer-pill { display: flex; align-items: center; gap: 8px; padding: 9px 13px; border: 1px solid var(--vp-c-divider); border-radius: 999px; color: var(--vp-c-text-2); background: var(--vp-c-bg); font-size: 12px; }
.timer-pill strong { color: var(--vp-c-text-1); font-size: 14px; font-variant-numeric: tabular-nums; }
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
.answer-option:hover, .answer-option.is-selected { border-color: #9995ef; background: var(--quiz-accent-soft); }
.answer-option input { width: 1px; height: 1px; margin: 0; opacity: .01; }
.answer-option input:focus-visible + .answer-letter { outline: 3px solid rgba(79,70,229,.35); outline-offset: 2px; }
.answer-letter { display: inline-grid; place-items: center; width: 29px; height: 29px; border: 1px solid var(--vp-c-divider); border-radius: 9px; color: var(--vp-c-text-2); background: var(--vp-c-bg-soft); font-size: 12px; font-weight: 800; }
.answer-option.is-selected .answer-letter { border-color: var(--quiz-accent); color: #fff; background: var(--quiz-accent); }
.answer-option__content { min-width: 0; padding-top: 3px; font-size: 14px; line-height: 1.65; }
.answer-option__content :deep(p) { margin: 0; }
.source-line { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 5px 12px; margin: 16px 0 0; padding-top: 12px; border-top: 1px solid var(--vp-c-divider); color: var(--vp-c-text-2); font-size: 11px; line-height: 1.55; }
.question-actions, .result-actions { display: flex; justify-content: space-between; gap: 10px; margin-top: 19px; }
.submit-confirm { display: flex; justify-content: space-between; align-items: center; gap: 18px; margin-top: 16px; padding: 15px; border: 1px solid #c9c8f6; border-radius: 12px; background: var(--quiz-accent-soft); }
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
.nav-legend { display: flex; justify-content: space-between; margin: 0 0 14px; color: var(--vp-c-text-2); font-size: 10px; }
.nav-legend span { display: flex; align-items: center; gap: 5px; }
.legend-dot { width: 8px; height: 8px; border-radius: 3px; background: var(--vp-c-bg-soft); }
.legend-dot--current { background: var(--quiz-accent); }
.legend-dot--answered { background: #9dd9bf; }
.question-nav > p { margin: 10px 0 0; color: var(--vp-c-text-2); font-size: 11px; line-height: 1.6; }
.result-hero { padding: clamp(22px, 4vw, 38px); border: 1px solid #d8daf7; border-radius: 19px; background: radial-gradient(circle at 90% 0, rgba(99,102,241,.13), transparent 32%), var(--vp-c-bg-soft); }
.score-line { display: flex; align-items: baseline; flex-wrap: wrap; gap: 8px; margin: 5px 0 8px; }
.score-line > strong { color: var(--quiz-accent); font-size: clamp(44px, 8vw, 66px); line-height: 1; font-variant-numeric: tabular-nums; }
.score-line > span { color: var(--vp-c-text-2); font-size: 15px; }
.score-line > i { width: 1px; height: 18px; margin: 0 5px; background: var(--vp-c-divider); }
.score-line > b { font-size: 15px; }
.result-hero > p { max-width: 790px; margin: 8px 0 0; color: var(--vp-c-text-2); font-size: 13px; line-height: 1.7; }
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
.review-link { display: inline-flex; margin-top: 13px; color: var(--quiz-accent); font-size: 12px; font-weight: 700; text-decoration: none; }
.review-link--source { margin-left: 16px; }
.review-link:hover { text-decoration: underline; }
:global(.dark) .retest-shell { --quiz-accent: #a5b4fc; --quiz-accent-soft: rgba(165,180,252,.12); }
:global(.dark) .intro-card, :global(.dark) .result-hero { border-color: #454b78; }
:global(.dark) .number-grid button.is-answered:not(.is-current) { border-color: #286449; color: #8ee0b5; background: #163d2d; }
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
  .timer-pill { gap: 6px; padding: 8px 10px; }
  .question-card { padding: 16px 13px; }
  .question-content { font-size: 15px; line-height: 1.8; }
  .mistake-row { align-items: flex-start; gap: 10px; padding: 11px; }
  .mistake-row__copy > strong { white-space: normal; }
  .mistake-review-button { min-height: 38px; padding: 0 10px; font-size: 11px; }
  .mistake-tools { align-items: stretch; flex-direction: column; }
  .mistake-tools input { width: 100%; }
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
