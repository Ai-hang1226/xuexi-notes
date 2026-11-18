<script setup>
import { ref } from 'vue'

const keys = {
  quiz: 'xuexi-notes:retest-prototype:v1',
  library: 'xuexi-notes:question-library:v1',
  essay: 'xuexi-notes:essay-retest:v1',
}

const fileInput = ref(null)
const message = ref('')
const isBusy = ref(false)

function readStored(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null')
  } catch {
    return null
  }
}

function exportRecords() {
  const records = Object.fromEntries(Object.entries(keys).map(([name, key]) => [name, readStored(key)]))
  const blob = new Blob([JSON.stringify({
    format: 'xuexi-notes-local-records',
    version: 1,
    createdAt: new Date().toISOString(),
    records,
  }, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `公考学习记录备份-${new Date().toISOString().slice(0, 10)}.json`
  link.setAttribute('aria-hidden', 'true')
  link.tabIndex = -1
  document.body.append(link)
  link.click()
  window.setTimeout(() => {
    link.remove()
    URL.revokeObjectURL(url)
  }, 60_000)
  message.value = '已开始下载备份文件，请保存到安全位置。'
}

function rowKey(row) {
  return row?.id || [row?.sessionId, row?.finishedAt, row?.kind, row?.answer].join('|')
}

function mergeRows(current = [], incoming = []) {
  const rows = new Map()
  for (const row of [...incoming, ...current]) {
    if (row && typeof row === 'object') rows.set(rowKey(row), { ...(rows.get(rowKey(row)) || {}), ...row })
  }
  return [...rows.values()].sort((a, b) => (a.finishedAt || a.submittedAt || '').localeCompare(b.finishedAt || b.submittedAt || ''))
}

function mergeQuiz(current, incoming) {
  const history = { ...(incoming.questionHistory || {}) }
  for (const [id, rows] of Object.entries(current.questionHistory || {})) {
    history[id] = mergeRows(rows, history[id] || [])
  }

  const mistakes = { ...(incoming.mistakeCounts || {}) }
  for (const [id, count] of Object.entries(current.mistakeCounts || {})) {
    mistakes[id] = Math.max(Number(mistakes[id]) || 0, Number(count) || 0)
  }
  for (const [id, rows] of Object.entries(history)) {
    const recordedErrors = rows.filter((row) => !row.isCorrect).length
    mistakes[id] = Math.max(Number(mistakes[id]) || 0, recordedErrors)
  }

  return {
    ...incoming,
    ...current,
    schemaVersion: 3,
    attempts: mergeRows(current.attempts || [], incoming.attempts || []).reverse(),
    mistakeCounts: mistakes,
    questionHistory: history,
    questionArchive: { ...(incoming.questionArchive || {}), ...(current.questionArchive || {}) },
  }
}

function mergeLibrary(current, incoming) {
  const currentAnswers = current.answers || {}
  const incomingAnswers = incoming.answers || {}
  const answers = { ...incomingAnswers }
  for (const [id, answer] of Object.entries(currentAnswers)) {
    const currentTime = Date.parse(answer?.at || '') || 0
    const incomingTime = Date.parse(answers[id]?.at || '') || 0
    if (!answers[id] || currentTime >= incomingTime) answers[id] = answer
  }
  return {
    drafts: { ...(incoming.drafts || {}), ...(current.drafts || {}) },
    marked: { ...(incoming.marked || {}), ...(current.marked || {}) },
    answers,
  }
}

function mergeEssay(current, incoming) {
  const drafts = { ...(incoming.drafts || {}) }
  for (const [id, draft] of Object.entries(current.drafts || {})) {
    if (String(draft || '').trim()) drafts[id] = draft
  }
  const attemptsByEssay = { ...(incoming.attemptsByEssay || {}) }
  for (const [id, rows] of Object.entries(current.attemptsByEssay || {})) {
    attemptsByEssay[id] = mergeRows(rows, attemptsByEssay[id] || [])
  }
  return { drafts, attemptsByEssay }
}

async function importRecords(event) {
  const file = event.target.files?.[0]
  if (!file) return
  isBusy.value = true
  message.value = ''
  try {
    const backup = JSON.parse(await file.text())
    if (backup.format !== 'xuexi-notes-local-records' || backup.version !== 1 || !backup.records) {
      throw new Error('这不是可识别的公考学习记录备份文件。')
    }

    const mergers = { quiz: mergeQuiz, library: mergeLibrary, essay: mergeEssay }
    const pendingWrites = []
    for (const [name, key] of Object.entries(keys)) {
      const incoming = backup.records[name]
      if (!incoming || typeof incoming !== 'object') continue
      const current = readStored(key) || {}
      pendingWrites.push({ key, value: JSON.stringify(mergers[name](current, incoming)) })
    }
    if (!pendingWrites.length) throw new Error('备份文件中没有可恢复的复测记录。')

    const previousValues = new Map(pendingWrites.map(({ key }) => [key, localStorage.getItem(key)]))
    try {
      for (const { key, value } of pendingWrites) localStorage.setItem(key, value)
    } catch (error) {
      let rollbackFailed = false
      for (const [key, value] of previousValues) {
        try {
          if (value === null) localStorage.removeItem(key)
          else localStorage.setItem(key, value)
        } catch {
          rollbackFailed = true
        }
      }
      throw new Error(rollbackFailed
        ? '浏览器空间不足，恢复未完成；请先导出当前记录并清理浏览器空间后重试。'
        : `浏览器空间不足，恢复未完成，原有记录已还原。${error?.message ? `（${error.message}）` : ''}`)
    }

    message.value = '已与当前浏览器记录合并，页面即将刷新。原有记录已保留。'
    window.setTimeout(() => window.location.reload(), 900)
  } catch (error) {
    message.value = error instanceof SyntaxError ? '文件无法读取，请选择完整的 JSON 备份文件。' : error.message
  } finally {
    isBusy.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}
</script>

<template>
  <section class="record-backup" aria-label="复测记录备份">
    <div class="record-backup__copy">
      <strong>备份本机学习记录</strong>
      <p>导出到电脑保存；恢复时与当前记录合并，不会上传到网站。</p>
    </div>
    <div class="record-backup__actions">
      <button type="button" @click="exportRecords">导出备份</button>
      <button type="button" :disabled="isBusy" @click="fileInput?.click()">{{ isBusy ? '正在恢复…' : '选择备份恢复' }}</button>
      <input ref="fileInput" type="file" accept="application/json,.json" @change="importRecords">
    </div>
    <p v-if="message" class="record-backup__message" role="status" aria-live="polite">{{ message }}</p>
  </section>
</template>

<style scoped>
.record-backup { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-top: 18px; padding: 13px 15px; border: 1px solid var(--vp-c-divider); border-radius: 12px; background: var(--vp-c-bg-soft); }
.record-backup__copy { min-width: 0; }
.record-backup__copy strong { font-size: 13px; }
.record-backup__copy p { margin: 3px 0 0; color: var(--vp-c-text-2); font-size: 11px; line-height: 1.55; }
.record-backup__actions { display: flex; flex: 0 0 auto; gap: 8px; }
.record-backup__actions button { min-height: 38px; padding: 0 11px; border: 1px solid var(--vp-c-divider); border-radius: 9px; color: var(--vp-c-text-1); background: var(--vp-c-bg); font: inherit; font-size: 11px; font-weight: 700; cursor: pointer; }
.record-backup__actions button:hover:not(:disabled) { border-color: var(--vp-c-brand-1); color: var(--vp-c-brand-1); }
.record-backup__actions button:focus-visible { outline: 3px solid var(--vp-c-brand-1); outline-offset: 2px; }
.record-backup__actions button:disabled { opacity: .55; cursor: wait; }
.record-backup__actions input { display: none; }
.record-backup__message { flex-basis: 100%; margin: 0; color: var(--vp-c-text-2); font-size: 11px; line-height: 1.5; }
.record-backup { flex-wrap: wrap; }
@media (max-width: 600px) {
  .record-backup { align-items: flex-start; flex-direction: column; }
  .record-backup__actions { width: 100%; }
  .record-backup__actions button { flex: 1; min-height: 42px; }
}
</style>
