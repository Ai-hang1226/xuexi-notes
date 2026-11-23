<script setup>
import { computed, onMounted, ref, shallowRef } from 'vue'
import { withBase } from 'vitepress'
import skillPool from './xingcezhenti-pool.json'
import RecordBackup from './components/RecordBackup.vue'
import { getAnswerEvidenceForCatalog } from './question-evidence.js'
import { saveStudyAttempt, syncCurrentDeviceInBackground } from './sync/study-records.js'

const quizStorageKey = 'xuexi-notes:retest-prototype:v1'
const libraryStorageKey = 'xuexi-notes:question-library:v1'
const catalogue = shallowRef({ entries: [] })
const importedQuestionCount = ref(0)
const loadingCatalogue = ref(true)
const catalogueError = ref('')
const questionById = new Map()
const transferPendingIds = new Set()
const pendingReviewUrls = new Set()
const query = ref('')
const filter = ref('全部')
const visibleCount = ref(30)
const selected = ref(null)
const picked = ref('')
const draft = ref('')
const submitted = ref(false)
const libraryRecords = ref({ drafts: {}, marked: {}, answers: {}, attempts: [] })
const quizMistakes = ref({})
const storageWarning = ref(false)
const selectedAt = ref(0)
let cataloguePromise = null

async function loadCatalogue() {
  if (!cataloguePromise) {
    cataloguePromise = Promise.all([
      import('./full-catalog.json'),
      import('./questions.json'),
      import('../cuotiben/review-catalog.json'),
      import('./review-priority.json'),
    ]).then(([catalogueModule, bankModule, reviewModule, priorityModule]) => {
      const bank = bankModule.default
      for (const item of reviewModule.default) {
        if (/独立运用待验证/.test(item.note || '') && item.url) pendingReviewUrls.add(item.url)
      }
      for (const question of bank.questions) {
        questionById.set(question.id, question)
        if (pendingReviewUrls.has(question.reviewUrl)) transferPendingIds.add(question.id)
      }
      for (const item of priorityModule.default.questions) {
        if (item.reviewUrls?.some((url) => pendingReviewUrls.has(url))) transferPendingIds.add(item.id)
      }
      importedQuestionCount.value = bank.imported
      catalogue.value = catalogueModule.default
      catalogueError.value = ''
      let needsSave = false
      for (const item of catalogue.value.entries) {
        const previouslyMarked = libraryRecords.value.marked[item.id]
          || item.aliases?.some((id) => libraryRecords.value.marked[id])
        if (item.quizId && previouslyMarked && !quizMistakes.value[item.quizId]) {
          quizMistakes.value[item.quizId] = 1
          needsSave = true
        }
      }
      if (needsSave) {
        try {
          const quizSaved = JSON.parse(localStorage.getItem(quizStorageKey) || '{}')
          quizSaved.mistakeCounts = quizMistakes.value
          localStorage.setItem(quizStorageKey, JSON.stringify(quizSaved))
        } catch {
          storageWarning.value = true
        }
      }
      return catalogue.value
    }).catch((error) => {
      cataloguePromise = null
      throw error
    }).finally(() => {
      loadingCatalogue.value = false
    })
  }
  return cataloguePromise
}

function evidenceFor(item) {
  return getAnswerEvidenceForCatalog(item, questionById, skillPool.repository)
}

function isTransferPending(item) {
  return !!item.quizId && transferPendingIds.has(item.quizId)
}

function evidenceBadgeLabel(item) {
  const evidence = evidenceFor(item)
  return ({
    fenbi: '粉笔已核对',
    'fenbi-reference': '粉笔回忆版参考',
    upstream: '上游答案未直核',
    disputed: '版本有差异',
    personal: '个人复测口径',
    noted: '依据见说明',
    unknown: '答案待核验',
  })[evidence?.key] || ''
}

const groups = [
  { label: '全部', test: () => true },
  { label: '可自动判分', test: (q) => q.status === '可自动判分' },
  { label: '粉笔已核对', test: (q) => evidenceFor(q)?.key === 'fenbi' },
  { label: '答案需留意', test: (q) => {
    const evidence = evidenceFor(q)
    return !!evidence && evidence.key !== 'fenbi'
  } },
  { label: '待独立验证', test: (q) => isTransferPending(q) },
  { label: '待核对', test: (q) => ['待核对', '题面不完整', '答案有争议', '题面待整理', '暂未匹配真题', '相似题未确认', '题源待补充', '候选题待核对', '检索受限', '检索未完成', '尚未检索', '真题已归位·未自动判分'].includes(q.status) },
  { label: '申论', test: (q) => q.subject === '申论' },
  { label: '历史自编', test: (q) => q.status === '历史自编' },
  { label: '原卷待答', test: (q) => q.status === '原卷待答' },
  { label: '待复习', test: (q) => isMarked(q) },
]
const filtered = computed(() => {
  const terms = query.value.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const group = groups.find((g) => g.label === filter.value) || groups[0]
  return catalogue.value.entries.filter((q) => {
    if (!group.test(q)) return false
    const haystack = `${q.title} ${q.source} ${q.excerpt} ${q.search || ''}`.toLowerCase()
    return terms.every((term) => haystack.includes(term))
  })
})
const displayed = computed(() => filtered.value.slice(0, visibleCount.value))
const current = computed(() => selected.value?.quizId
  ? { ...selected.value, ...questionById.get(selected.value.quizId) }
  : selected.value)
const isEssay = computed(() => selected.value?.subject === '申论')
const canChoose = computed(() => !isEssay.value && current.value?.options?.length === 4)
const isScored = computed(() => selected.value?.status === '可自动判分' && !!current.value?.correct)
const resultCorrect = computed(() => isScored.value && picked.value === current.value.correct)
const markedCount = computed(() => catalogue.value.entries.filter((q) => isMarked(q)).length)

function isMarked(item) {
  return !!libraryRecords.value.marked[item.id]
    || !!item.aliases?.some((id) => libraryRecords.value.marked[id])
    || !!(item.quizId && quizMistakes.value[item.quizId])
}

function updateFilter(label) {
  filter.value = label
  visibleCount.value = 30
}
function openQuestion(item) {
  selected.value = item
  picked.value = ''
  const drafts = libraryRecords.value.drafts || {}
  const savedId = [item.id, ...(item.aliases || [])].find((id) => Object.prototype.hasOwnProperty.call(drafts, id))
  draft.value = savedId === undefined ? '' : drafts[savedId]
  submitted.value = false
  selectedAt.value = Date.now()
  if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
}
function closeQuestion() {
  selected.value = null
  submitted.value = false
  selectedAt.value = 0
  if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
}
function saveLibrary() {
  try {
    localStorage.setItem(libraryStorageKey, JSON.stringify(libraryRecords.value))
  } catch {
    storageWarning.value = true
  }
}
function saveDraft() {
  if (!selected.value) return
  libraryRecords.value.drafts[selected.value.id] = draft.value
  saveLibrary()
}
function questionText(value = '') {
  const element = document.createElement('div')
  element.innerHTML = String(value)
  return (element.textContent || '').replace(/\s+/g, ' ').trim()
}
function addQuizAttempt(id, attempt, archiveQuestion) {
  if (!id || !attempt.isScored) return
  try {
    const saved = JSON.parse(localStorage.getItem(quizStorageKey) || '{}')
    if (!saved.mistakeCounts || typeof saved.mistakeCounts !== 'object') saved.mistakeCounts = {}
    if (!saved.questionHistory || typeof saved.questionHistory !== 'object') saved.questionHistory = {}
    if (!saved.questionArchive || typeof saved.questionArchive !== 'object') saved.questionArchive = {}
    const sessionId = `library:${attempt.id}`
    const history = saved.questionHistory[id] || []
    if (!history.some((item) => item.sessionId === sessionId)) {
      saved.questionHistory[id] = [...history, {
        sessionId,
        startedAt: attempt.startedAt,
        finishedAt: attempt.submittedAt,
        kind: '全站题库',
        answer: attempt.answer || '',
        correct: attempt.correct || '',
        isCorrect: Boolean(attempt.isCorrect),
        durationSeconds: attempt.durationSeconds,
        durationScope: 'question',
        isUncertain: false,
        isSlow: false,
      }].sort((a, b) => (a.finishedAt || '').localeCompare(b.finishedAt || ''))
    }
    if (!attempt.isCorrect) {
      const wrongCount = saved.questionHistory[id].filter((item) => item.isCorrect === false).length
      saved.mistakeCounts[id] = Math.max(Number(saved.mistakeCounts[id]) || 0, wrongCount)
    }
    if (!saved.questionArchive[id] && archiveQuestion) saved.questionArchive[id] = archiveQuestion
    localStorage.setItem(quizStorageKey, JSON.stringify(saved))
    quizMistakes.value = { ...saved.mistakeCounts }
  } catch {
    storageWarning.value = true
  }
}
function submitQuestion() {
  if (!selected.value || submitted.value) return
  if (isEssay.value && !draft.value.trim()) return
  if (isEssay.value) saveDraft()
  if (canChoose.value && !picked.value) return
  const submittedAt = Date.now()
  const answerValue = isEssay.value ? draft.value.trim() : picked.value
  const archiveQuestion = selected.value.quizId ? {
    ...current.value,
    id: selected.value.quizId,
    title: selected.value.title || current.value.title || '',
    source: selected.value.source || current.value.source || '',
    reviewUrl: current.value.reviewUrl || selected.value.sourceUrl || selected.value.sources?.[0]?.url || '',
  } : null
  const question = {
    id: selected.value.quizId || selected.value.id,
    title: selected.value.title || '',
    subject: selected.value.subject || '',
    module: current.value.module || '',
    source: selected.value.source || '',
    sourceUrl: selected.value.sourceUrl || selected.value.sources?.[0]?.url || '',
    excerpt: selected.value.excerpt || '',
    stem: isEssay.value ? (selected.value.excerpt || '') : questionText(current.value.stemHtml || selected.value.excerpt || ''),
    number: current.value.number || '',
    year: current.value.year || '',
    reviewUrl: current.value.reviewUrl || selected.value.sourceUrl || selected.value.sources?.[0]?.url || '',
    options: (current.value.options || []).map((option) => ({
      label: option.label || '',
      text: questionText(option.html || option.text || ''),
    })),
    correct: isScored.value ? current.value.correct : '',
  }
  const attempt = {
    id: `${submittedAt}-${Math.random().toString(36).slice(2, 8)}`,
    questionId: selected.value.id,
    quizId: selected.value.quizId || '',
    startedAt: selectedAt.value ? new Date(selectedAt.value).toISOString() : '',
    submittedAt: new Date(submittedAt).toISOString(),
    durationSeconds: selectedAt.value ? Math.max(0, Math.floor((submittedAt - selectedAt.value) / 1000)) : null,
    answer: answerValue,
    correct: isScored.value ? current.value.correct : '',
    isScored: isScored.value,
    isCorrect: isScored.value ? resultCorrect.value : null,
    isEssay: isEssay.value,
    question,
  }
  libraryRecords.value.attempts = [...(libraryRecords.value.attempts || []), attempt]
  if (canChoose.value) {
    libraryRecords.value.answers[selected.value.id] = { answer: picked.value, at: attempt.submittedAt }
    if (attempt.quizId && attempt.isScored) addQuizAttempt(attempt.quizId, attempt, archiveQuestion)
  }
  saveLibrary()
  saveStudyAttempt({
    id: `library:${attempt.id}`,
    kind: 'library_answer',
    startedAt: attempt.startedAt,
    finishedAt: attempt.submittedAt,
    durationSeconds: attempt.durationSeconds,
    score: attempt.isScored ? (attempt.isCorrect ? 5 : 0) : null,
    total: attempt.isScored ? 1 : null,
    payload: { attempt },
  })
  submitted.value = true
}
function toggleMarked(item) {
  const removing = isMarked(item)
  if (removing) {
    delete libraryRecords.value.marked[item.id]
    for (const id of item.aliases || []) delete libraryRecords.value.marked[id]
  }
  else libraryRecords.value.marked[item.id] = true
  if (item.quizId) {
    try {
      const saved = JSON.parse(localStorage.getItem(quizStorageKey) || '{}')
      if (!saved.mistakeCounts || typeof saved.mistakeCounts !== 'object') saved.mistakeCounts = {}
      if (removing) delete saved.mistakeCounts[item.quizId]
      else saved.mistakeCounts[item.quizId] = Math.max(1, Number(saved.mistakeCounts[item.quizId]) || 0)
      localStorage.setItem(quizStorageKey, JSON.stringify(saved))
      quizMistakes.value = { ...saved.mistakeCounts }
    } catch {
      storageWarning.value = true
    }
  }
  saveLibrary()
}
function baseInHtmlUrl(url) {
  if (/^(?:[a-z]+:|\/\/|#)/i.test(url)) return url
  let resolved = url
  if (/^\.\/assets\//.test(resolved) && selected.value?.sourceUrl?.startsWith('/daily-quizzes/')) {
    resolved = '/daily-quizzes/' + resolved.slice(2)
  }
  if (!resolved.startsWith('/')) return resolved
  return withBase(resolved.replace(/^\/xuexi-notes(?=\/)/, ''))
}
function formatHtml(html = '') {
  return html.replace(/\b(src|href|srcset)=(['"])(.*?)\2/gi, (_, attribute, quote, url) => {
    const cleanUrl = url.split(',')[0].trim().split(/\s+/)[0]
    return `${attribute}=${quote}${baseInHtmlUrl(cleanUrl)}${quote}`
  })
}
function sourceLink(url) {
  return /^(?:https?:)?\/\//.test(url) ? url : withBase(url)
}
function labelFor(status) {
  return {
    '可自动判分': '可自动判分', '待核对': '答案待核', '题面不完整': '题面不完整',
    '原卷待答': '原卷待答', '历史自编': '历史自编', '申论材料题': '申论材料题',
    '答案有争议': '答案有争议', '题面待整理': '原页待整理', '暂未匹配真题': '暂未匹配真题',
    '相似题未确认': '相似题未确认', '题源待补充': '题源待补充',
    '候选题待核对': '候选题待核对', '检索受限': '粉笔检索受限',
    '检索未完成': '检索未完成', '尚未检索': '尚未检索',
    '教学示例': '教学示例', '真题已归位·未自动判分': '真题已归位 · 未自动判分',
  }[status] || status
}

onMounted(() => {
  try {
    const saved = JSON.parse(localStorage.getItem(libraryStorageKey) || '{}')
    libraryRecords.value = {
      drafts: saved.drafts && typeof saved.drafts === 'object' ? saved.drafts : {},
      marked: saved.marked && typeof saved.marked === 'object' ? saved.marked : {},
      answers: saved.answers && typeof saved.answers === 'object' ? saved.answers : {},
      attempts: Array.isArray(saved.attempts) ? saved.attempts : [],
    }
    const quizSaved = JSON.parse(localStorage.getItem(quizStorageKey) || '{}')
    quizMistakes.value = quizSaved.mistakeCounts && typeof quizSaved.mistakeCounts === 'object' ? quizSaved.mistakeCounts : {}
  } catch {
    storageWarning.value = true
  }
  void loadCatalogue().catch(() => {
    catalogueError.value = '题库暂时未能载入；请检查网络后刷新页面重试。'
  })
  void syncCurrentDeviceInBackground().then(() => {
    const saved = JSON.parse(localStorage.getItem(libraryStorageKey) || '{}')
    libraryRecords.value = {
      ...libraryRecords.value,
      ...saved,
      drafts: { ...(saved.drafts || {}), ...libraryRecords.value.drafts },
      marked: { ...(saved.marked || {}), ...libraryRecords.value.marked },
      answers: { ...(saved.answers || {}), ...libraryRecords.value.answers },
      attempts: Array.isArray(saved.attempts) ? saved.attempts : libraryRecords.value.attempts,
    }
    const quizSaved = JSON.parse(localStorage.getItem(quizStorageKey) || '{}')
    quizMistakes.value = quizSaved.mistakeCounts && typeof quizSaved.mistakeCounts === 'object' ? quizSaved.mistakeCounts : quizMistakes.value
  })
})
</script>

<template>
  <main class="library-shell">
    <template v-if="!selected">
      <header class="library-header">
        <div>
          <a class="back-link" :href="withBase('/retest/')">← 返回 20 题复测</a>
          <h1>全站题库</h1>
          <p>把试卷、错题复盘、知识点例题和申论材料放在一起。先筛选，再打开你想做的题。</p>
        </div>
        <a class="primary-action" :href="withBase('/retest/')">随机做 20 题 →</a>
      </header>

      <div class="library-summary">
        <span><strong>{{ catalogue.entries.length }}</strong> 条题目记录</span>
        <span><strong>{{ importedQuestionCount || '…' }}</strong> 道可自动判分</span>
        <span><strong>{{ markedCount }}</strong> 条本机待复习</span>
      </div>
      <RecordBackup />
      <p class="scope-note">同一道题尽量合并不同出处；历史自编题仅作回看。待核对区会标明暂未匹配真题、候选不符或题源待补充；这些题不会自动判分。教学示例与已归位但未完成直核的真题也会标清。</p>

      <section class="search-panel" aria-label="筛选题目">
        <label class="search-label" for="question-search">搜索题目</label>
        <input id="question-search" v-model="query" type="search" placeholder="输入题干、知识点或年份" @input="visibleCount = 30">
        <div class="filter-list" aria-label="题目分类">
          <button v-for="group in groups" :key="group.label" type="button" :class="{ active: filter === group.label }" :aria-pressed="filter === group.label" @click="updateFilter(group.label)">{{ group.label }}</button>
        </div>
        <p class="result-count">找到 {{ filtered.length }} 条<span v-if="query">与“{{ query }}”相关的记录</span></p>
      </section>

      <p v-if="loadingCatalogue" class="catalog-loading" role="status">正在载入全站题目与来源信息，筛选区会很快开放。</p>
      <p v-else-if="catalogueError" class="catalog-loading catalog-loading--error" role="alert">{{ catalogueError }}</p>
      <section v-else class="question-list" aria-label="题目列表">
        <article v-for="item in displayed" :key="item.id" class="library-card">
          <div class="card-meta"><span>{{ item.subject }}</span><span>{{ labelFor(item.status) }}</span><span>{{ item.source }}</span><span v-if="evidenceBadgeLabel(item)" class="evidence-chip" :class="`evidence-chip--${evidenceFor(item).key}`" :title="evidenceFor(item).explanation">{{ evidenceBadgeLabel(item) }}</span><span v-if="isTransferPending(item)" class="pending-chip">待独立验证</span></div>
          <h2>{{ item.title }}</h2>
          <p>{{ item.excerpt }}</p>
          <div class="card-actions">
            <button class="text-action" type="button" @click="openQuestion(item)">{{ item.quizId || item.stemHtml ? (item.subject === '申论' ? '打开材料作答 →' : '打开题目 →') : '查看来源 →' }}</button>
            <button class="mark-action" type="button" :aria-pressed="isMarked(item)" @click="toggleMarked(item)">{{ isMarked(item) ? '已加入待复习' : '加入待复习' }}</button>
          </div>
        </article>
        <p v-if="!filtered.length" class="empty-state">没有找到匹配的题目。试试换一个关键词或切换分类。</p>
        <button v-if="displayed.length < filtered.length" class="more-button" type="button" @click="visibleCount += 30">显示更多（还剩 {{ filtered.length - displayed.length }} 条）</button>
      </section>
    </template>

    <template v-else>
      <div class="reader-top"><button class="back-button" type="button" @click="closeQuestion">← 返回题库</button><span>{{ labelFor(selected.status) }}</span></div>
      <section class="reader-card">
        <div class="card-meta"><span>{{ selected.subject }}</span><span>{{ selected.source }}</span></div>
        <h1>{{ selected.title }}</h1>
        <p v-if="selected.status === '原卷待答'" class="reader-note">原卷仍是待答状态；这里的练习不会替你提交原卷，也不会改变原有成绩。</p>
        <p v-else-if="selected.status === '历史自编'" class="reader-note">这是历史自编练习，保留供回看；不计入真题自动判分。</p>
        <p v-else-if="!isScored && !isEssay" class="reader-note">{{ selected.reviewNote || '这道题的题源、题面或答案尚需核对，暂不自动判断对错。' }}</p>
        <p v-if="isEssay" class="reader-note">先根据材料作答，再查看原页的参考内容。申论按主观题处理，不自动给分。</p>
        <div v-if="!isEssay && evidenceFor(selected)" class="answer-evidence" :class="`answer-evidence--${evidenceFor(selected).key}`"><strong>答案核验：{{ evidenceFor(selected).label }}</strong><span>{{ evidenceFor(selected).explanation }}</span></div>

        <div v-if="current.materialHtml" class="material-box"><strong>{{ current.materialTitle || '题目材料' }}</strong><div class="question-text" v-html="formatHtml(current.materialHtml)"></div></div>
        <div v-if="current.stemHtml" class="question-text" v-html="formatHtml(current.stemHtml)"></div>
        <p v-else class="reader-note">原页目前只保留题目摘要或复盘，请打开来源查看已有内容。</p>

        <fieldset v-if="canChoose" class="answer-list" :disabled="submitted">
          <legend>选择一个答案</legend>
          <label v-for="option in current.options" :key="option.label" class="answer-row" :class="{ chosen: picked === option.label }">
            <input v-model="picked" type="radio" name="library-answer" :value="option.label">
            <span class="answer-letter">{{ option.label }}</span><span v-if="option.html" v-html="formatHtml(option.html)"></span><span v-else>按题干原图选择 {{ option.label }}</span>
          </label>
        </fieldset>

        <label v-if="isEssay" class="draft-label" for="essay-answer">我的作答 <span>草稿保存在当前浏览器</span></label>
        <textarea v-if="isEssay" id="essay-answer" v-model="draft" rows="9" placeholder="在这里写下你的答案……" @input="saveDraft"></textarea>
        <p v-if="isEssay" class="draft-count">已写 {{ draft.replace(/\s/g, '').length }} 字符</p>

        <div class="reader-actions">
          <button v-if="canChoose || isEssay" class="primary-button" type="button" :disabled="submitted || (canChoose && !picked) || (isEssay && !draft.trim())" @click="submitQuestion">{{ isEssay ? '完成作答，查看参考入口' : '提交作答' }}</button>
          <button class="secondary-button" type="button" :aria-pressed="isMarked(selected)" @click="toggleMarked(selected)">{{ isMarked(selected) ? '移出待复习' : '加入待复习' }}</button>
        </div>

        <div v-if="submitted" class="answer-result" role="status">
          <template v-if="isScored">
            <strong>{{ resultCorrect ? '本题答对' : '本题答错' }} · 参考答案 {{ current.correct }}</strong>
            <p>{{ resultCorrect ? '只记录本次作答，不自动认定已经掌握。' : '本题已加入当前浏览器的优先复测列表。' }}</p>
            <p v-if="current.gradingNote">{{ current.gradingNote }}</p>
          </template>
          <template v-else-if="isEssay"><strong>本次作答已保存</strong><p>登录后会跨设备同步；可以打开原页对照材料和已有参考内容，不会自动改写你以前的答案或成绩。</p></template>
          <template v-else><strong>已记录本次选择：{{ picked }}</strong><p>这道题暂不自动判分；原页可能包含尚待核对的推断或历史解析。</p><p v-if="current.referenceAnswer"><strong>参考答案：{{ current.referenceAnswer }}</strong></p><p v-if="current.referenceNote">{{ current.referenceNote }}</p></template>
        </div>

        <div v-if="submitted || (!canChoose && !isEssay)" class="source-links">
          <span>题目来源</span>
          <a v-for="source in selected.sources" :key="source.url" :href="sourceLink(source.url)" target="_blank" rel="noopener">{{ source.label }} ↗</a>
          <a v-if="submitted && current.sourceUrl && /^(?:https?:)?\/\//.test(current.sourceUrl)" :href="current.sourceUrl" target="_blank" rel="noopener">查看外部题源 ↗</a>
        </div>
      </section>
    </template>
    <p v-if="storageWarning" class="storage-warning">当前浏览器无法保存记录，关闭页面后本次记录可能丢失。</p>
  </main>
</template>

<style scoped>
.library-shell { width: min(1100px, 100%); margin: 0 auto; padding: 28px clamp(14px, 3vw, 30px) 56px; color: var(--vp-c-text-1); }
.library-header { display: flex; justify-content: space-between; align-items: end; gap: 20px; padding: 0 0 22px; border-bottom: 1px solid var(--vp-c-divider); }
.library-header h1, .reader-card h1 { margin: 12px 0 8px; border: 0; padding: 0; font-size: clamp(28px, 4vw, 39px); line-height: 1.25; }
.library-header p, .scope-note { margin: 0; color: var(--vp-c-text-2); font-size: 15px; line-height: 1.75; }
.back-link, .text-action, .source-links a { color: #4f46e5; font-size: 14px; font-weight: 700; text-decoration: none; }
.primary-action, .primary-button { display: inline-flex; justify-content: center; align-items: center; min-height: 44px; padding: 0 17px; border: 0; border-radius: 10px; color: #fff; background: #4f46e5; font: inherit; font-size: 14px; font-weight: 700; white-space: nowrap; cursor: pointer; text-decoration: none; }
.primary-button:disabled { cursor: not-allowed; opacity: .48; }
.library-summary { display: flex; flex-wrap: wrap; gap: 10px 30px; padding: 18px 0 8px; color: var(--vp-c-text-2); font-size: 13px; }
.library-summary strong { margin-right: 5px; color: var(--vp-c-text-1); font-size: 22px; font-variant-numeric: tabular-nums; }
.scope-note { font-size: 13px; }
.search-panel { margin: 22px 0; padding: 20px; border: 1px solid var(--vp-c-divider); border-radius: 14px; background: var(--vp-c-bg-soft); }
.search-label, .draft-label { display: block; margin-bottom: 8px; font-size: 14px; font-weight: 700; }
input[type=search], textarea { width: 100%; border: 1px solid var(--vp-c-divider); border-radius: 10px; padding: 11px 13px; color: var(--vp-c-text-1); background: var(--vp-c-bg); font: inherit; font-size: 15px; }
.filter-list { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
.filter-list button, .mark-action, .back-button, .secondary-button, .more-button { min-height: 38px; padding: 6px 12px; border: 1px solid var(--vp-c-divider); border-radius: 9px; color: var(--vp-c-text-1); background: var(--vp-c-bg); font: inherit; font-size: 13px; cursor: pointer; }
.filter-list button.active { border-color: #4f46e5; color: #4f46e5; background: rgba(79,70,229,.08); font-weight: 700; }
.result-count { margin: 12px 0 0; color: var(--vp-c-text-2); font-size: 12px; }
.question-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.library-card, .reader-card { min-width: 0; padding: 19px; border: 1px solid var(--vp-c-divider); border-radius: 14px; background: var(--vp-c-bg); }
.card-meta { display: flex; flex-wrap: wrap; gap: 6px; color: #4f46e5; font-size: 11px; font-weight: 700; }
.card-meta span { padding: 3px 7px; border-radius: 6px; background: rgba(79,70,229,.08); }
.card-meta .evidence-chip, .card-meta .pending-chip { border: 1px solid var(--vp-c-divider); color: var(--vp-c-text-2); background: var(--vp-c-bg-soft); }
.card-meta .evidence-chip--fenbi { border-color: #7bc7a2; color: #147a50; background: #eaf8f0; }
.card-meta .evidence-chip--disputed, .card-meta .evidence-chip--upstream, .card-meta .evidence-chip--unknown, .card-meta .evidence-chip--personal { border-color: #e4b85f; color: #8a5700; background: #fff7e7; }
.card-meta .pending-chip { border-color: #df9c45; color: #935000; background: #fff4e4; }
.library-card h2 { margin: 10px 0 7px; border: 0; padding: 0; font-size: 16px; line-height: 1.45; }
.library-card p { min-height: 4.8em; margin: 0; overflow: hidden; color: var(--vp-c-text-2); font-size: 13px; line-height: 1.65; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; }
.card-actions { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-top: 13px; }
.text-action { padding: 7px 0; border: 0; background: transparent; cursor: pointer; }
.mark-action[aria-pressed=true] { border-color: #4f46e5; color: #4f46e5; }
.more-button, .empty-state { grid-column: 1 / -1; }
.more-button { min-height: 44px; }
.empty-state { color: var(--vp-c-text-2); text-align: center; }
.reader-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; color: var(--vp-c-text-2); font-size: 12px; }
.reader-card { padding: clamp(20px, 4vw, 38px); }
.reader-card h1 { font-size: clamp(24px, 3vw, 32px); }
.reader-note { margin: 12px 0; padding: 11px 13px; border-left: 3px solid #818cf8; border-radius: 5px; color: var(--vp-c-text-2); background: var(--vp-c-bg-soft); font-size: 13px; line-height: 1.7; }
.material-box { margin: 20px 0; padding: 16px; border: 1px solid var(--vp-c-divider); border-radius: 12px; background: var(--vp-c-bg-soft); }
.question-text { margin: 20px 0; font-size: 17px; line-height: 1.9; overflow-wrap: anywhere; }
.question-text :deep(p) { margin: 0 0 14px; }
.question-text :deep(img), .answer-row :deep(img) { max-width: 100%; height: auto; }
.question-text :deep(table) { display: block; max-width: 100%; overflow-x: auto; }
.answer-list { display: grid; gap: 8px; margin: 0; padding: 0; border: 0; }
.answer-list legend { margin-bottom: 8px; color: var(--vp-c-text-2); font-size: 12px; }
.answer-row { display: grid; grid-template-columns: 1px 30px minmax(0, 1fr); align-items: start; gap: 10px; padding: 12px; border: 1px solid var(--vp-c-divider); border-radius: 10px; font-size: 15px; line-height: 1.7; cursor: pointer; }
.answer-row input { width: 1px; height: 1px; opacity: .01; }
.answer-row.chosen { border-color: #818cf8; background: rgba(79,70,229,.07); }
.answer-letter { display: grid; place-items: center; width: 28px; height: 28px; border: 1px solid var(--vp-c-divider); border-radius: 8px; font-size: 12px; font-weight: 700; }
.answer-row.chosen .answer-letter { color: #fff; background: #4f46e5; }
.answer-row :deep(p) { margin: 0; }
.draft-label { margin-top: 22px; }
.draft-label span, .draft-count { color: var(--vp-c-text-2); font-size: 12px; font-weight: 400; }
textarea { resize: vertical; min-height: 150px; line-height: 1.7; }
.draft-count { text-align: right; }
.reader-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 20px; }
.answer-result { margin-top: 20px; padding: 15px; border: 1px solid #c7d2fe; border-radius: 10px; background: rgba(79,70,229,.07); font-size: 14px; line-height: 1.7; }
.answer-result p { margin: 6px 0 0; color: var(--vp-c-text-2); }
.answer-evidence { display: grid; gap: 4px; margin: 13px 0; padding: 11px 13px; border: 1px solid var(--vp-c-divider); border-left: 3px solid #4f46e5; border-radius: 9px; background: var(--vp-c-bg-soft); }
.answer-evidence strong { font-size: 12px; }
.answer-evidence span { color: var(--vp-c-text-2); font-size: 12px; line-height: 1.6; }
.answer-evidence--fenbi { border-left-color: #14865d; }
.answer-evidence--fenbi strong { color: #147a50; }
.answer-evidence--disputed, .answer-evidence--upstream, .answer-evidence--unknown, .answer-evidence--personal { border-left-color: #c2841b; }
.source-links { display: flex; flex-wrap: wrap; gap: 8px 16px; margin-top: 20px; color: var(--vp-c-text-2); font-size: 13px; }
.storage-warning { color: #b45309; font-size: 13px; }
button:focus-visible, a:focus-visible, input:focus-visible, textarea:focus-visible { outline: 3px solid rgba(79,70,229,.35); outline-offset: 2px; }
@media (max-width: 650px) { .library-header { align-items: flex-start; flex-direction: column; } .question-list { grid-template-columns: 1fr; } .library-summary { gap: 6px 20px; } .library-card p { min-height: 0; } }
:global(.dark) .card-meta .evidence-chip--fenbi, :global(.dark) .answer-evidence--fenbi { color: #9fe1bd; background: #163d2d; }
:global(.dark) .card-meta .evidence-chip--disputed, :global(.dark) .card-meta .evidence-chip--upstream, :global(.dark) .card-meta .evidence-chip--unknown, :global(.dark) .card-meta .evidence-chip--personal, :global(.dark) .card-meta .pending-chip { color: #f4ce83; background: #3b301a; }
:global(.dark) .answer-evidence--disputed, :global(.dark) .answer-evidence--upstream, :global(.dark) .answer-evidence--unknown, :global(.dark) .answer-evidence--personal { border-left-color: #8b692a; }
</style>
