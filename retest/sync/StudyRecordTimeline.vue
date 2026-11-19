<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { withBase } from 'vitepress'
import {
  bootstrapAccountSync,
  collectLocalStudyRecords,
  getCloudUser,
  isCloudSyncConfigured,
  readStudyRecords,
  sendEmailCode,
  signOutCloud,
  syncEventName,
  verifyEmailCode,
} from './study-records.js'

const email = ref('')
const code = ref('')
const step = ref('email')
const user = ref(null)
const records = ref([])
const status = ref(isCloudSyncConfigured ? 'signed-out' : 'unconfigured')
const message = ref('')
const busy = ref(false)
const filter = ref('全部')
const search = ref('')
let contextPromise
let refreshTimer

const kindLabels = {
  xingce_round: '行测 · 20题复测',
  xingce_single: '行测 · 单题复测',
  library_answer: '全站题库作答',
  essay_retest: '申论复测',
}
const syncStatusLabels = {
  unconfigured: '云端待连接',
  'signed-out': '仅本机保存',
  'local-only': '记录保存在本机',
  'signed-in': '已登录',
  syncing: '正在同步',
  synced: '已同步',
  offline: '离线待补传',
  error: '同步遇到问题',
}
const syncStatusLabel = computed(() => syncStatusLabels[status.value] || '准备同步')

function loadLocalContext() {
  contextPromise ||= Promise.all([
      import('../questions-metadata.json'),
      import('../full-catalog-metadata.json'),
    import('../essay-review.json'),
  ]).then(([questions, catalogue, essays]) => ({
      questions: questions.default.questions || [],
      catalogue: catalogue.default,
    essays: essays.default.essays || [],
  })).catch((error) => {
    contextPromise = null
    throw error
  })
  return contextPromise
}

const visibleRecords = computed(() => {
  const term = search.value.trim().toLocaleLowerCase()
  return records.value.filter((record) => {
    if (filter.value === '行测' && !record.kind.startsWith('xingce_')) return false
    if (filter.value === '申论' && record.kind !== 'essay_retest') return false
    if (filter.value === '题库作答' && record.kind !== 'library_answer') return false
    if (!term) return true
    return JSON.stringify(record.payload || {}).toLocaleLowerCase().includes(term)
      || (kindLabels[record.kind] || record.kind).toLocaleLowerCase().includes(term)
  })
})

const dayGroups = computed(() => {
  const groups = new Map()
  for (const record of visibleRecords.value) {
    const date = record.finishedAt ? shanghaiDayKey(record.finishedAt) : 'unknown'
    groups.set(date, [...(groups.get(date) || []), record])
  }
  return [...groups.entries()].map(([date, items]) => ({ date, items }))
})

function shanghaiDayKey(value) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(value))
  const fields = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]))
  return `${fields.year}-${fields.month}-${fields.day}`
}

function prettyDay(value) {
  if (value === 'unknown') return '日期未记录'
  return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'long', day: 'numeric', weekday: 'long' }).format(new Date(`${value}T12:00:00+08:00`))
}

function formatTime(value) {
  if (!value) return '时间未记录'
  return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date(value))
}

function formatDuration(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '用时未记录'
  const seconds = Math.max(0, Math.floor(Number(value)))
  const minutes = Math.floor(seconds / 60)
  return minutes ? `${minutes}分${seconds % 60}秒` : `${seconds}秒`
}

function answerLabel(value) {
  return value === null || value === undefined || value === '' ? '未作答' : String(value)
}

function questionTitle(item) {
  const question = item.question || {}
  if (question.title || item.title) return question.title || item.title
  if (question.module && question.number) return `${question.module} · 第 ${question.number} 题`
  return question.source || item.source || item.questionId || item.id || '题目'
}

function questionUrl(item) {
  const url = item.question?.sourceUrl || item.question?.reviewUrl || item.sourceUrl || ''
  if (!url) return ''
  if (/^(https?:)?\/\//i.test(url)) return url
  return withBase(url.replace(/^\/xuexi-notes(?=\/)/, '').startsWith('/')
    ? url.replace(/^\/xuexi-notes(?=\/)/, '')
    : `/${url}`)
}

function plainText(value) {
  if (!value) return ''
  if (typeof DOMParser === 'undefined') return String(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  const documentValue = new DOMParser().parseFromString(String(value), 'text/html')
  return (documentValue.body.textContent || '').replace(/\s+/g, ' ').trim()
}

function questionPrompt(item) {
  return plainText(item.question?.stem || item.question?.excerpt || item.stem || item.excerpt || '')
}

function questionMaterial(item) {
  const title = item.question?.materialTitle || ''
  const text = plainText(item.question?.material || item.question?.materialHtml || '')
  return [title, text].filter(Boolean).join('：')
}

function questionAnswers(record) {
  if (record.kind === 'xingce_round') return record.payload?.attempt?.answers || []
  if (record.kind === 'xingce_single') return [{
    ...(record.payload?.answer || {}),
    id: record.payload?.questionId,
    question: record.payload?.question,
  }]
  if (record.kind === 'library_answer') return [record.payload?.attempt || {}]
  return []
}

function setLocalRecords() {
  records.value = collectLocalStudyRecords()
}

async function refreshRecords() {
  if (busy.value) return
  busy.value = true
  message.value = ''
  try {
    const context = await loadLocalContext()
    records.value = await readStudyRecords(collectLocalStudyRecords(context))
    if (user.value) {
      status.value = 'synced'
      message.value = `已加载 ${records.value.length} 条账号记录。`
    } else {
      status.value = isCloudSyncConfigured ? 'signed-out' : 'unconfigured'
    }
  } catch (error) {
    status.value = 'error'
    message.value = error.message
    if (!records.value.length) setLocalRecords()
  } finally {
    busy.value = false
  }
}

async function requestCode() {
  if (!email.value.trim()) {
    message.value = '请先填写邮箱地址。'
    return
  }
  busy.value = true
  message.value = ''
  try {
    await sendEmailCode(email.value)
    step.value = 'code'
    message.value = '验证码已发送。请查看邮箱，也检查一下垃圾邮件文件夹。'
  } catch (error) {
    message.value = error.message
  } finally {
    busy.value = false
  }
}

async function confirmCode() {
  if (!code.value.trim()) {
    message.value = '请输入邮箱收到的验证码。'
    return
  }
  busy.value = true
  message.value = ''
  try {
    user.value = await verifyEmailCode(email.value, code.value)
    const context = await loadLocalContext()
    records.value = await bootstrapAccountSync(collectLocalStudyRecords(context))
    status.value = 'synced'
    message.value = `登录成功，已把这台设备的记录与账号合并，共 ${records.value.length} 条。`
  } catch (error) {
    user.value = getCloudUser()
    status.value = user.value ? 'error' : 'signed-out'
    message.value = error.message
  } finally {
    busy.value = false
  }
}

async function logout() {
  await signOutCloud()
  user.value = null
  step.value = 'email'
  code.value = ''
  setLocalRecords()
  status.value = isCloudSyncConfigured ? 'signed-out' : 'unconfigured'
  message.value = '已退出云同步；这台设备的记录仍保留。'
}

function onSyncEvent(event) {
  status.value = event.detail?.state || status.value
  if (event.detail?.message) message.value = event.detail.message
  if (status.value === 'synced' && user.value) records.value = collectLocalStudyRecords()
}

function onFocus() {
  if (!user.value || document.visibilityState !== 'visible') return
  window.clearTimeout(refreshTimer)
  refreshTimer = window.setTimeout(() => { void refreshRecords() }, 180)
}

onMounted(async () => {
  user.value = isCloudSyncConfigured ? getCloudUser() : null
  window.addEventListener(syncEventName, onSyncEvent)
  window.addEventListener('focus', onFocus)
  document.addEventListener('visibilitychange', onFocus)
  await refreshRecords()
})

onBeforeUnmount(() => {
  window.clearTimeout(refreshTimer)
  window.removeEventListener(syncEventName, onSyncEvent)
  window.removeEventListener('focus', onFocus)
  document.removeEventListener('visibilitychange', onFocus)
})
</script>

<template>
  <main class="study-records">
    <header class="records-heading">
      <div>
        <a class="back-link" :href="withBase('/')">← 返回学习首页</a>
        <h1>做题记录</h1>
        <p>按北京时间查看每次行测、题库和申论作答；展开记录可复盘答案、用时与结果。</p>
      </div>
      <div class="record-count"><strong>{{ visibleRecords.length }}</strong><span>{{ user ? '账号记录' : '本机记录' }}</span></div>
    </header>

    <section class="sync-panel" aria-label="跨设备记录同步">
      <div class="sync-copy">
        <div class="sync-copy__heading"><strong>{{ user ? `已登录：${user.email}` : '让不同设备的记录汇总到一起' }}</strong><span class="sync-state" :data-state="status">{{ syncStatusLabel }}</span></div>
        <p v-if="!isCloudSyncConfigured">云端同步还未连接；目前继续保存在当前设备。连接云端后，可用同一邮箱验证码登录并合并旧记录。</p>
        <p v-else-if="user">本机新记录会在联网后补传；同一邮箱在 iPad 或电脑登录后即可查看。提交的答案文本也会保存在你的账号中。</p>
        <p v-else>用同一邮箱接收验证码登录。首次登录会合并这台设备已有记录，其他设备也需要各登录一次来上传各自旧记录。</p>
      </div>
      <div v-if="isCloudSyncConfigured && !user" class="login-form">
        <template v-if="step === 'email'">
          <label class="sr-only" for="sync-email">邮箱地址</label>
          <input id="sync-email" v-model="email" type="email" autocomplete="email" placeholder="输入邮箱地址" @keydown.enter="requestCode">
          <button type="button" :disabled="busy" @click="requestCode">{{ busy ? '正在发送…' : '发送验证码' }}</button>
        </template>
        <template v-else>
          <label class="sr-only" for="sync-code">邮箱验证码</label>
          <input id="sync-code" v-model="code" type="text" inputmode="numeric" autocomplete="one-time-code" placeholder="输入邮箱验证码" @keydown.enter="confirmCode">
          <button type="button" :disabled="busy" @click="confirmCode">{{ busy ? '正在验证…' : '登录并同步' }}</button>
          <button class="quiet-button" type="button" :disabled="busy" @click="step = 'email'; code = ''">改邮箱</button>
        </template>
      </div>
      <div v-else-if="user" class="account-actions">
        <button type="button" :disabled="busy" @click="refreshRecords">{{ busy ? '正在同步…' : '立即同步' }}</button>
        <button class="quiet-button" type="button" @click="logout">退出登录</button>
      </div>
      <p v-if="message" class="sync-message" role="status" aria-live="polite">{{ message }}</p>
    </section>

    <div class="records-tools">
      <div class="record-filters" aria-label="记录类别">
        <button v-for="item in ['全部', '行测', '题库作答', '申论']" :key="item" type="button" :class="{ active: filter === item }" :aria-pressed="filter === item" @click="filter = item">{{ item }}</button>
      </div>
      <label class="search-records"><span class="sr-only">搜索做题记录</span><input v-model="search" type="search" placeholder="搜索题目、模块或来源"></label>
    </div>

    <p v-if="busy && !records.length" class="empty-records" role="status">正在读取做题记录…</p>
    <section v-else-if="!visibleRecords.length" class="empty-records">
      <strong>{{ records.length ? '没有符合筛选条件的记录' : '这里还没有已保存的作答' }}</strong>
      <p>{{ records.length ? '换一个类别或关键词试试。' : '完成一轮行测、题库作答或申论复测后，记录会自动出现在这里。' }}</p>
    </section>

    <section v-for="group in dayGroups" :key="group.date" class="day-group">
      <div class="day-heading"><h2>{{ prettyDay(group.date) }}</h2><span>{{ group.items.length }} 次作答</span></div>
      <article v-for="record in group.items" :key="record.id" class="attempt-row">
        <time class="attempt-time">{{ formatTime(record.finishedAt) }}</time>
        <span class="timeline-mark" aria-hidden="true"></span>
        <div class="attempt-content">
          <div class="attempt-summary">
            <strong>{{ kindLabels[record.kind] || '做题记录' }}</strong>
            <span v-if="record.score !== null && record.total !== null">{{ record.score }} 分 · {{ record.total }} 题</span>
            <span v-else-if="record.kind === 'xingce_single' || record.kind === 'library_answer'">1 题</span>
            <span v-else-if="record.kind === 'essay_retest'">{{ record.payload?.attempt?.characterCount ?? record.payload?.attempt?.answer?.length ?? 0 }} 字</span>
            <span>{{ formatDuration(record.durationSeconds) }}</span>
          </div>
          <details class="attempt-details">
            <summary>查看本次详细作答</summary>
            <p v-if="record.startedAt" class="attempt-range">开始 {{ formatTime(record.startedAt) }} · 交卷 {{ formatTime(record.finishedAt) }}</p>
            <p v-else class="attempt-range">开始时间未保存在历史记录中 · 交卷 {{ formatTime(record.finishedAt) }}</p>
            <div v-if="record.kind === 'essay_retest'" class="essay-answer">
              <strong>{{ record.payload?.essayTitle || record.payload?.attempt?.title || '申论作答' }}</strong>
              <pre>{{ record.payload?.attempt?.answer || '' }}</pre>
            </div>
            <ol v-else-if="questionAnswers(record).length" class="answer-list">
              <li v-for="(item, index) in questionAnswers(record)" :key="item.id || index">
                <div class="answer-title"><b>{{ String(index + 1).padStart(2, '0') }}</b><span>{{ questionTitle(item) }}</span><small v-if="item.question?.module || item.module">{{ item.question?.module || item.module }}</small></div>
                <p v-if="questionPrompt(item)" class="question-prompt">{{ questionPrompt(item) }}</p>
                <p v-if="questionMaterial(item)" class="question-options">材料：{{ questionMaterial(item) }}</p>
                <p v-if="typeof item.answer !== 'string' || item.answer.length <= 180">你的答案：{{ answerLabel(item.answer) }}<template v-if="item.correct"> · 参考答案：{{ item.correct }}</template><template v-if="item.isCorrect !== undefined && item.isCorrect !== null"> · {{ item.isCorrect ? '答对' : '答错' }}</template><template v-if="item.isUncertain"> · 不确定</template></p>
                <pre v-else class="long-answer">{{ item.answer }}</pre>
                <p v-if="item.question?.options?.length" class="question-options">选项：<span v-for="option in item.question.options" :key="option.label">{{ option.label }} {{ plainText(option.text || option.html) }}； </span></p>
                <small v-if="item.durationSeconds !== null && item.durationSeconds !== undefined">本题用时 {{ formatDuration(item.durationSeconds) }}</small>
                <a v-if="questionUrl(item)" class="original-link" :href="questionUrl(item)" target="_blank" rel="noopener">打开原题 ↗</a>
              </li>
            </ol>
            <p v-else class="attempt-range">这条是旧版本机记录，当时只保存了最近一次选择或提交时间。</p>
          </details>
        </div>
      </article>
    </section>
  </main>
</template>

<style scoped>
.study-records { --record-ink: #24324a; --record-blue: #4f46e5; --record-soft: #f5f6fa; --record-line: #e1e4eb; --record-warn: #ad5a12; width: min(1060px, 100%); margin: 0 auto; padding: 28px clamp(14px, 3vw, 30px) 64px; color: var(--vp-c-text-1); }
.records-heading { display: flex; justify-content: space-between; align-items: end; gap: 24px; padding: 4px 0 22px; border-bottom: 1px solid var(--record-line); }
.back-link { color: var(--record-blue); font-size: 13px; font-weight: 700; text-decoration: none; }
.records-heading h1 { margin: 12px 0 6px; border: 0; padding: 0; color: var(--record-ink); font-size: clamp(29px, 4vw, 39px); line-height: 1.2; }
.records-heading p { max-width: 720px; margin: 0; color: var(--vp-c-text-2); font-size: 14px; line-height: 1.7; }
.record-count { display: grid; min-width: 100px; justify-items: end; padding-bottom: 3px; }
.record-count strong { color: var(--record-blue); font-size: 26px; font-variant-numeric: tabular-nums; }
.record-count span { color: var(--vp-c-text-2); font-size: 12px; }
.sync-panel { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 12px 20px; margin: 18px 0 24px; padding: 17px 19px; border: 1px solid color-mix(in srgb, var(--record-blue) 22%, var(--record-line)); border-left: 4px solid var(--record-blue); border-radius: 12px; background: var(--record-soft); }
.sync-copy { min-width: 0; }
.sync-copy__heading { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
.sync-copy strong { color: var(--record-ink); font-size: 14px; }
.sync-state { padding: 3px 8px; border-radius: 99px; color: #5b6474; background: #e9ebf1; font-size: 10px; font-weight: 750; }
.sync-state[data-state="synced"] { color: #126b4f; background: #e1f3eb; }
.sync-state[data-state="syncing"], .sync-state[data-state="offline"], .sync-state[data-state="error"] { color: #95500b; background: #fff0d8; }
.sync-copy p { max-width: 700px; margin: 4px 0 0; color: var(--vp-c-text-2); font-size: 12px; line-height: 1.65; }
.login-form, .account-actions { display: flex; flex-wrap: wrap; gap: 7px; align-items: center; }
.login-form input { width: 210px; min-height: 39px; padding: 0 10px; border: 1px solid var(--record-line); border-radius: 8px; color: var(--vp-c-text-1); background: var(--vp-c-bg); font: inherit; font-size: 13px; }
.login-form button, .account-actions button { min-height: 39px; padding: 0 13px; border: 1px solid var(--record-blue); border-radius: 8px; color: #fff; background: var(--record-blue); font: inherit; font-size: 12px; font-weight: 750; cursor: pointer; }
.login-form button:disabled, .account-actions button:disabled { opacity: .55; cursor: wait; }
.login-form .quiet-button, .account-actions .quiet-button { border-color: var(--record-line); color: var(--record-ink); background: var(--vp-c-bg); }
.sync-message { grid-column: 1 / -1; margin: 0; color: var(--record-warn); font-size: 12px; line-height: 1.5; }
.records-tools { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
.record-filters { display: flex; flex-wrap: wrap; gap: 6px; }
.record-filters button { min-height: 34px; padding: 0 12px; border: 1px solid var(--record-line); border-radius: 7px; color: var(--vp-c-text-2); background: var(--vp-c-bg); font: inherit; font-size: 12px; cursor: pointer; }
.record-filters button.active { border-color: var(--record-blue); color: var(--record-blue); background: color-mix(in srgb, var(--record-blue) 7%, var(--vp-c-bg)); font-weight: 750; }
.search-records { width: min(300px, 100%); }
.search-records input { width: 100%; min-height: 36px; padding: 0 10px; border: 1px solid var(--record-line); border-radius: 8px; color: var(--vp-c-text-1); background: var(--vp-c-bg); font: inherit; font-size: 12px; }
.day-group { margin-top: 25px; }
.day-heading { display: flex; align-items: baseline; gap: 10px; margin-bottom: 5px; }
.day-heading h2 { margin: 0; border: 0; padding: 0; color: var(--record-ink); font-size: 18px; font-weight: 750; }
.day-heading > span { color: var(--vp-c-text-2); font-size: 11px; }
.attempt-row { display: grid; grid-template-columns: 76px 14px minmax(0, 1fr); gap: 0 11px; }
.attempt-time { padding-top: 17px; color: var(--vp-c-text-2); font-size: 12px; font-variant-numeric: tabular-nums; text-align: right; }
.timeline-mark { position: relative; display: block; width: 14px; min-height: 100%; }
.timeline-mark::before { position: absolute; top: 20px; left: 4px; width: 7px; height: 7px; border: 2px solid var(--record-blue); border-radius: 50%; background: var(--vp-c-bg); content: ''; }
.timeline-mark::after { position: absolute; top: 32px; bottom: 0; left: 7px; width: 1px; background: var(--record-line); content: ''; }
.attempt-row:last-child .timeline-mark::after { display: none; }
.attempt-content { min-width: 0; margin-bottom: 8px; padding: 12px 15px 10px; border: 1px solid var(--record-line); border-radius: 10px; background: var(--vp-c-bg); }
.attempt-summary { display: flex; flex-wrap: wrap; align-items: baseline; gap: 5px 16px; }
.attempt-summary strong { color: var(--record-ink); font-size: 14px; }
.attempt-summary span { color: var(--vp-c-text-2); font-size: 12px; }
.attempt-details { margin-top: 7px; }
.attempt-details summary { width: fit-content; color: var(--record-blue); font-size: 12px; font-weight: 700; cursor: pointer; }
.attempt-range { margin: 8px 0; color: var(--vp-c-text-2); font-size: 11px; line-height: 1.55; }
.answer-list { display: grid; gap: 8px; margin: 10px 0 2px; padding: 0; list-style: none; }
.answer-list li { padding: 9px 10px; border-left: 2px solid var(--record-line); background: var(--record-soft); }
.answer-title { display: flex; flex-wrap: wrap; gap: 7px; align-items: baseline; }
.answer-title b { color: var(--record-blue); font-size: 11px; font-variant-numeric: tabular-nums; }
.answer-title span { color: var(--record-ink); font-size: 12px; font-weight: 700; }
.answer-title small, .answer-list li > small { color: var(--vp-c-text-2); font-size: 10px; }
.answer-list li p { margin: 4px 0 2px; color: var(--vp-c-text-2); font-size: 11px; line-height: 1.55; }
.answer-list li .question-prompt { color: var(--record-ink); }
.answer-list li .question-options { color: var(--vp-c-text-2); font-size: 10px; }
.answer-list li .long-answer { overflow-wrap: anywhere; white-space: pre-wrap; margin: 7px 0; padding: 10px; border-radius: 7px; color: var(--vp-c-text-1); background: var(--vp-c-bg); font: inherit; font-size: 11px; line-height: 1.7; }
.original-link { display: inline-block; margin-left: 9px; color: var(--record-blue); font-size: 10px; font-weight: 700; text-decoration: none; }
.essay-answer { margin-top: 10px; }
.essay-answer strong { color: var(--record-ink); font-size: 12px; }
.essay-answer pre { overflow-wrap: anywhere; white-space: pre-wrap; margin: 7px 0 0; padding: 12px; border-radius: 8px; color: var(--vp-c-text-1); background: var(--record-soft); font: inherit; font-size: 12px; line-height: 1.75; }
.empty-records { margin-top: 22px; padding: 24px; border: 1px dashed var(--record-line); border-radius: 12px; color: var(--vp-c-text-2); text-align: center; }
.empty-records strong { color: var(--record-ink); font-size: 14px; }
.empty-records p { margin: 6px 0 0; font-size: 12px; line-height: 1.6; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; clip-path: inset(50%); }
.study-records button:focus-visible, .study-records a:focus-visible, .study-records input:focus-visible, .attempt-details summary:focus-visible { outline: 3px solid color-mix(in srgb, var(--record-blue) 55%, transparent); outline-offset: 2px; }
:global(.dark) .study-records { --record-ink: #e3e8f1; --record-soft: #1a1c22; --record-line: #343842; }
@media (max-width: 700px) {
  .records-heading { align-items: flex-start; }
  .record-count { min-width: 70px; }
  .sync-panel { grid-template-columns: 1fr; }
  .login-form input { flex: 1 1 170px; width: auto; }
  .records-tools { align-items: stretch; flex-direction: column; }
  .search-records { width: 100%; }
  .attempt-row { grid-template-columns: 51px 14px minmax(0, 1fr); gap: 0 7px; }
  .attempt-time { padding-top: 15px; font-size: 10px; }
  .attempt-content { padding: 11px 10px 9px; }
}
@media (prefers-reduced-motion: reduce) {
  .study-records *, .study-records *::before, .study-records *::after { scroll-behavior: auto !important; transition-duration: .01ms !important; }
}
</style>
