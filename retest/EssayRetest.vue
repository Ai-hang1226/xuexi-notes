<script setup>
import { computed, onMounted, ref } from 'vue'
import { withBase } from 'vitepress'
import bank from './essay-review.json'
import RecordBackup from './components/RecordBackup.vue'
import { saveStudyAttempt, syncCurrentDeviceInBackground } from './sync/study-records.js'

const storageKey = 'xuexi-notes:essay-retest:v1'
const essays = bank.essays || []
const mode = ref('intro')
const selectedEssay = ref(null)
const answerText = ref('')
const latestRecord = ref(null)
const drafts = ref({})
const attemptsByEssay = ref({})
const storageWarning = ref(false)
const validationMessage = ref('')
const startedAt = ref(0)
const submittedAt = ref(0)
const answerLength = computed(() => answerText.value.trim().length)

function safeUrl(url) {
  if (!url || /^(?:[a-z]+:|\/\/|#)/i.test(url)) return url || '#'
  if (!url.startsWith('/')) return url
  const normalized = url.replace(/^\/xuexi-notes(?=\/)/, '')
  return withBase(normalized.endsWith('/') || /\.[a-z0-9]+$/i.test(normalized) ? normalized : normalized + '.html')
}

function persist() {
  try {
    localStorage.setItem(storageKey, JSON.stringify({ drafts: drafts.value, attemptsByEssay: attemptsByEssay.value }))
  } catch {
    storageWarning.value = true
  }
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '{}')
    if (saved.drafts && typeof saved.drafts === 'object') drafts.value = saved.drafts
    if (saved.attemptsByEssay && typeof saved.attemptsByEssay === 'object') attemptsByEssay.value = saved.attemptsByEssay
  } catch {
    storageWarning.value = true
  }
}

function historyFor(essay) {
  return attemptsByEssay.value[essay.id] || []
}

function startRetest(essay) {
  selectedEssay.value = essay
  answerText.value = drafts.value[essay.id] || ''
  latestRecord.value = null
  validationMessage.value = ''
  startedAt.value = Date.now()
  submittedAt.value = 0
  mode.value = 'answer'
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function saveDraft() {
  if (!selectedEssay.value) return
  drafts.value = { ...drafts.value, [selectedEssay.value.id]: answerText.value }
  persist()
}

function submitAnswer() {
  if (!selectedEssay.value || !answerText.value.trim()) {
    validationMessage.value = '先写下本次作答，再查看原答和批改记录。'
    return
  }
  submittedAt.value = Date.now()
  const record = {
    id: `${submittedAt.value}-${Math.random().toString(36).slice(2, 8)}`,
    startedAt: startedAt.value ? new Date(startedAt.value).toISOString() : '',
    submittedAt: new Date(submittedAt.value).toISOString(),
    durationSeconds: Math.max(0, Math.floor((submittedAt.value - startedAt.value) / 1000)),
    answer: answerText.value.trim(),
    characterCount: answerText.value.trim().length,
    essayTitle: selectedEssay.value.title,
    source: selectedEssay.value.source,
  }
  attemptsByEssay.value = {
    ...attemptsByEssay.value,
    [selectedEssay.value.id]: [...historyFor(selectedEssay.value), record],
  }
  drafts.value = { ...drafts.value, [selectedEssay.value.id]: '' }
  latestRecord.value = record
  validationMessage.value = ''
  persist()
  saveStudyAttempt({
    id: `essay:${record.id}`,
    kind: 'essay_retest',
    startedAt: record.startedAt,
    finishedAt: record.submittedAt,
    durationSeconds: record.durationSeconds,
    payload: { essayId: selectedEssay.value.id, essayTitle: selectedEssay.value.title, attempt: record },
  })
  mode.value = 'result'
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function formatDate(value) {
  return new Date(value).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}

onMounted(async () => {
  load()
  await syncCurrentDeviceInBackground()
  load()
})
</script>

<template>
  <main class="essay-retest">
    <template v-if="mode === 'intro'">
      <header class="essay-hero">
        <span class="eyebrow">申论复测 · 已做题目</span>
        <h1>重写一遍，再对照自己的变化</h1>
        <p>这里只收录已经有首答记录的申论题。你可以随时选题重写，提交后保存本次答案，并打开此前的首答、评分和解析；申论主观题不做自动判分。</p>
        <div class="essay-stats">
          <div><strong>{{ essays.length }}</strong><span>道已做题</span></div>
          <div><strong>{{ Object.values(attemptsByEssay).reduce((sum, rows) => sum + rows.length, 0) }}</strong><span>次复测记录</span></div>
          <div><strong>自动保存</strong><span>草稿留在当前浏览器</span></div>
        </div>
      </header>

      <RecordBackup />

      <section class="essay-list-section">
        <div class="list-heading"><div><span class="eyebrow">题目清单</span><h2>选择一道已做过的题</h2></div><a :href="safeUrl('/retest/')">返回行测复测</a></div>
        <div class="essay-list">
          <article v-for="essay in essays" :key="essay.id" class="essay-card">
            <div class="essay-card__copy">
              <div class="essay-tags"><span>{{ essay.category }}</span><span :class="essay.sourceKind === '历史自编题' ? 'tag-self-made' : ''">{{ essay.sourceKind }}</span></div>
              <h3>{{ essay.title }}</h3>
              <p>{{ essay.excerpt }}</p>
              <small>{{ essay.source }} · 已复测 {{ historyFor(essay).length }} 次<template v-if="historyFor(essay).length"> · 最近一次 {{ formatDate(historyFor(essay).at(-1).submittedAt) }}</template></small>
            </div>
            <button class="action-button" type="button" @click="startRetest(essay)">{{ drafts[essay.id] ? '继续草稿' : '复测此题' }} <span aria-hidden="true">→</span></button>
          </article>
        </div>
      </section>

      <aside class="essay-note">
        <strong>记录说明</strong>
        <p>列表按已有首答证据生成；未作答题不会出现。标注“历史自编题”的题目仍可用于回顾已做过的内容，但不作为公考真题。已提交作答会逐次保留，登录同一邮箱后可跨设备查看；未提交草稿仍保存在当前浏览器，不改写原首答、原评分或原成绩。</p>
      </aside>
    </template>

    <template v-else-if="mode === 'answer' && selectedEssay">
      <header class="answer-head">
        <button class="text-button" type="button" @click="mode = 'intro'">← 返回题目清单</button>
        <span class="eyebrow">申论复测 · {{ selectedEssay.category }}</span>
        <h1>{{ selectedEssay.title }}</h1>
        <p>{{ selectedEssay.source }} · 已复测 {{ historyFor(selectedEssay).length }} 次</p>
      </header>
      <section class="prompt-card">
        <div class="prompt-heading"><strong>原题材料与作答要求</strong><span>先独立作答，不查看旧解析</span></div>
        <div class="prompt-content" v-html="selectedEssay.stemHtml"></div>
      </section>
      <section class="writing-card">
        <div class="writing-heading"><div><strong>本次作答</strong><small>边写边保存在当前浏览器</small></div><span>{{ answerLength }} 字符</span></div>
        <textarea v-model="answerText" rows="15" placeholder="在这里写下本次答案……" @input="saveDraft"></textarea>
        <p v-if="validationMessage" class="validation-message" role="alert">{{ validationMessage }}</p>
        <div class="writing-actions">
          <small>提交后会保存本次作答，并开放原首答与评分入口。</small>
          <button class="action-button" type="button" @click="submitAnswer">提交复测 →</button>
        </div>
      </section>
    </template>

    <template v-else-if="mode === 'result' && selectedEssay && latestRecord">
      <header class="result-head">
        <span class="eyebrow">申论复测已保存 · 第 {{ historyFor(selectedEssay).length }} 次</span>
        <h1>{{ selectedEssay.title }}</h1>
        <p>提交时间 {{ formatDate(latestRecord.submittedAt) }} · 用时 {{ formatDuration(latestRecord.durationSeconds) }} · {{ latestRecord.characterCount }} 字符</p>
        <p class="no-auto-score">这次作答已保存。系统不对申论主观题自动打分，请结合老师参考答案和原评分查看变化；登录后可在做题记录中跨设备复盘。</p>
      </header>
      <section class="submitted-answer">
        <div class="writing-heading"><strong>你刚提交的答案</strong><span>{{ latestRecord.characterCount }} 字符</span></div>
        <div class="answer-copy">{{ latestRecord.answer }}</div>
      </section>
      <section class="after-submit-links">
        <a class="action-button" :href="safeUrl(selectedEssay.answerUrl)">查看此前首答 ↗</a>
        <a class="secondary-button" :href="safeUrl(selectedEssay.analysisUrl)">打开评分与解析 ↗</a>
      </section>
      <section v-if="historyFor(selectedEssay).length > 1" class="essay-history">
        <div class="list-heading"><div><span class="eyebrow">本机复测档案</span><h2>历次提交</h2></div><span>{{ historyFor(selectedEssay).length }} 次</span></div>
        <details v-for="(record, index) in [...historyFor(selectedEssay)].reverse()" :key="record.id" class="essay-attempt">
          <summary>第 {{ historyFor(selectedEssay).length - index }} 次 · {{ formatDate(record.submittedAt) }} · {{ record.characterCount }} 字符 · {{ formatDuration(record.durationSeconds) }}</summary>
          <div class="answer-copy">{{ record.answer }}</div>
        </details>
      </section>
      <div class="result-actions">
        <button class="action-button" type="button" @click="startRetest(selectedEssay)">再写一次 →</button>
        <button class="secondary-button" type="button" @click="mode = 'intro'">返回题目清单</button>
      </div>
    </template>

    <p v-if="storageWarning" class="storage-warning">浏览器未能保存本地记录；请先复制你的作答内容，再关闭页面。</p>
  </main>
</template>

<style scoped>
.essay-retest { --essay-accent: var(--vp-c-brand-1); --essay-action: var(--vp-c-brand-1); width: min(1080px, 100%); margin: 0 auto; padding: 26px clamp(12px, 2.5vw, 28px) 52px; color: var(--vp-c-text-1); font-family: var(--vp-font-family-base); }
.essay-retest h1, .essay-retest h2, .essay-retest h3, .essay-retest p { margin-top: 0; }
.eyebrow { color: var(--essay-accent); font-size: 12px; font-weight: 750; letter-spacing: .07em; }
.essay-hero, .result-head { padding: clamp(24px, 4vw, 40px); border: 1px solid color-mix(in srgb, var(--essay-accent) 20%, var(--vp-c-divider)); border-radius: 21px; background: radial-gradient(circle at 92% 8%, color-mix(in srgb, var(--essay-accent) 12%, transparent), transparent 32%), var(--vp-c-bg-soft); }
.essay-hero h1, .answer-head h1, .result-head h1 { margin: 9px 0; border: 0; padding: 0; font-size: clamp(27px, 4vw, 40px); line-height: 1.23; letter-spacing: -.025em; }
.essay-hero > p, .answer-head > p, .result-head > p { max-width: 820px; color: var(--vp-c-text-2); font-size: 14px; line-height: 1.8; }
.essay-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; max-width: 620px; margin-top: 22px; }
.essay-stats > div { display: grid; gap: 5px; min-height: 73px; align-content: center; padding: 10px 14px; border: 1px solid var(--vp-c-divider); border-radius: 12px; background: var(--vp-c-bg); }
.essay-stats strong { color: var(--essay-accent); font-size: 20px; }
.essay-stats span { color: var(--vp-c-text-2); font-size: 11px; }
.essay-list-section, .essay-history { margin-top: 25px; }
.list-heading { display: flex; align-items: end; justify-content: space-between; gap: 16px; margin-bottom: 12px; }
.list-heading h2 { margin: 4px 0 0; border: 0; padding: 0; font-size: 22px; }
.list-heading > a { color: var(--essay-accent); font-size: 13px; font-weight: 700; text-decoration: none; }
.essay-list { display: grid; gap: 10px; }
.essay-card { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 17px 19px; border: 1px solid var(--vp-c-divider); border-radius: 14px; background: var(--vp-c-bg); }
.essay-card__copy { min-width: 0; }
.essay-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 7px; }
.essay-tags span { padding: 3px 8px; border-radius: 99px; color: var(--essay-accent); background: var(--vp-c-brand-soft); font-size: 10px; font-weight: 750; }
.essay-tags .tag-self-made { color: #955900; background: #fff4d9; }
.essay-card h3 { margin: 0 0 5px; font-size: 16px; }
.essay-card p { display: -webkit-box; overflow: hidden; margin: 0 0 7px; color: var(--vp-c-text-2); font-size: 12px; line-height: 1.7; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.essay-card small { color: var(--vp-c-text-2); font-size: 11px; }
.action-button, .secondary-button { display: inline-flex; flex: 0 0 auto; align-items: center; justify-content: center; gap: 9px; min-height: 43px; padding: 0 15px; border: 1px solid transparent; border-radius: 10px; font: inherit; font-size: 13px; font-weight: 750; text-decoration: none; cursor: pointer; }
.action-button { color: #fff; background: var(--essay-action); box-shadow: 0 6px 16px color-mix(in srgb, var(--essay-action) 20%, transparent); }
.action-button:hover { background: #274eae; }
.secondary-button { border-color: var(--vp-c-divider); color: var(--vp-c-text-1); background: var(--vp-c-bg); }
.action-button:hover, .secondary-button:hover { transform: translateY(-1px); }
.essay-note { margin-top: 19px; padding: 15px 17px; border: 1px solid var(--vp-c-divider); border-left: 4px solid var(--essay-accent); border-radius: 12px; background: var(--vp-c-bg-soft); }
.essay-note strong { font-size: 13px; }
.essay-note p { margin: 6px 0 0; color: var(--vp-c-text-2); font-size: 12px; line-height: 1.75; }
.answer-head { margin-bottom: 17px; }
.text-button { display: block; margin: 0 0 22px; padding: 0; border: 0; color: var(--essay-accent); background: none; font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; }
.prompt-card, .writing-card, .submitted-answer { margin-top: 15px; padding: clamp(17px, 3vw, 25px); border: 1px solid var(--vp-c-divider); border-radius: 15px; background: var(--vp-c-bg); }
.prompt-heading, .writing-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: var(--vp-c-text-1); font-size: 13px; }
.prompt-heading span, .writing-heading > span { color: var(--vp-c-text-2); font-size: 11px; }
.prompt-content { margin-top: 13px; color: var(--vp-c-text-1); font-size: 14px; line-height: 1.85; }
.prompt-content :deep(img) { display: block; max-width: 100%; height: auto; margin: 12px auto; }
.writing-heading small { display: block; margin-top: 4px; color: var(--vp-c-text-2); font-size: 11px; }
.writing-card textarea { display: block; width: 100%; min-height: 340px; margin-top: 13px; padding: 14px; resize: vertical; border: 1px solid var(--vp-c-divider); border-radius: 11px; color: var(--vp-c-text-1); background: var(--vp-c-bg); font: inherit; font-size: 15px; line-height: 1.9; }
.writing-card textarea:focus-visible { outline: 3px solid color-mix(in srgb, var(--essay-accent) 30%, transparent); border-color: var(--essay-accent); }
.writing-actions, .after-submit-links, .result-actions { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 15px; }
.writing-actions > small { color: var(--vp-c-text-2); font-size: 11px; line-height: 1.6; }
.validation-message, .storage-warning { color: #b45309; font-size: 12px; }
.no-auto-score { padding: 10px 12px; border-radius: 9px; background: var(--vp-c-brand-soft); }
.answer-copy { white-space: pre-wrap; overflow-wrap: anywhere; margin-top: 12px; color: var(--vp-c-text-1); font-size: 14px; line-height: 1.9; }
.essay-attempt { margin-top: 8px; padding: 12px 14px; border: 1px solid var(--vp-c-divider); border-radius: 10px; background: var(--vp-c-bg); }
.essay-attempt summary { color: var(--vp-c-text-1); font-size: 12px; font-weight: 700; cursor: pointer; }
.essay-attempt .answer-copy { padding-top: 10px; border-top: 1px solid var(--vp-c-divider); }
.storage-warning { margin: 15px 0 0; }
:global(.dark) .essay-retest { --essay-accent: var(--vp-c-brand-1); --essay-action: #315DCB; }
:global(.dark) .action-button:hover { background: #274eae; }
:global(.dark) .essay-hero, :global(.dark) .result-head { border-color: color-mix(in srgb, var(--essay-accent) 35%, var(--vp-c-divider)); }
:global(.dark) .essay-tags .tag-self-made { color: #ffd98b; background: #493711; }
@media (max-width: 620px) {
  .essay-retest { padding: 16px 12px 34px; }
  .essay-card { align-items: flex-start; flex-direction: column; padding: 14px; }
  .essay-card .action-button { width: 100%; }
  .essay-stats { gap: 7px; }
  .essay-stats > div { padding: 8px; }
  .essay-stats span { font-size: 10px; }
  .list-heading { align-items: flex-start; }
  .writing-card textarea { min-height: 280px; font-size: 14px; }
  .writing-actions { align-items: flex-start; flex-direction: column; }
  .after-submit-links, .result-actions { align-items: stretch; flex-direction: column; }
  .after-submit-links > a, .result-actions > button { width: 100%; }
}
</style>
