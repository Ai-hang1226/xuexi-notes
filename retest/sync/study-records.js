const env = import.meta.env || {}
const apiUrl = String(env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
const apiKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || ''

export const studyRecordKeys = {
  quiz: 'xuexi-notes:retest-prototype:v1',
  library: 'xuexi-notes:question-library:v1',
  essay: 'xuexi-notes:essay-retest:v1',
  session: 'xuexi-notes:cloud-session:v1',
  outbox: 'xuexi-notes:cloud-outbox:v1',
}

export const isCloudSyncConfigured = Boolean(apiUrl && apiKey)
export const syncEventName = 'xuexi-notes:cloud-sync'

function readJson(key, fallback = {}) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null') || fallback
  } catch {
    return fallback
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

function announce(state, message = '') {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(syncEventName, { detail: { state, message } }))
  }
}

function sessionValue() {
  if (typeof window === 'undefined') return null
  const session = readJson(studyRecordKeys.session, null)
  return session?.accessToken && session?.user?.id ? session : null
}

export function getCloudUser() {
  return sessionValue()?.user || null
}

function setSession(payload) {
  const session = {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: Date.now() + (Number(payload.expires_in) || 3600) * 1000,
    user: payload.user,
  }
  writeJson(studyRecordKeys.session, session)
  return session
}

function readOutbox() {
  const value = readJson(studyRecordKeys.outbox, [])
  return Array.isArray(value) ? value : []
}

function queueOutbox(record) {
  if (!record?.id) return
  const outbox = readOutbox()
  writeJson(studyRecordKeys.outbox, mergeRecords(outbox, [record]))
}

function clearOutbox(ids) {
  if (!ids?.length) return
  const synced = new Set(ids)
  writeJson(studyRecordKeys.outbox, readOutbox().filter((record) => !synced.has(record.id)))
}

async function authRequest(path, body, accessToken = '') {
  const response = await fetch(`${apiUrl}/auth/v1/${path}`, {
    method: 'POST',
    headers: {
      apikey: apiKey,
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.msg || data.message || data.error_description || '邮箱验证服务暂时不可用。')
  return data
}

export async function sendEmailCode(email) {
  if (!isCloudSyncConfigured) throw new Error('云同步尚未配置。')
  await authRequest('otp', { email: email.trim().toLowerCase(), create_user: true })
}

export async function verifyEmailCode(email, token) {
  if (!isCloudSyncConfigured) throw new Error('云同步尚未配置。')
  const data = await authRequest('verify', {
    email: email.trim().toLowerCase(),
    token: token.trim(),
    type: 'email',
  })
  const session = setSession(data)
  announce('signed-in', '邮箱已验证。正在合并这台设备的记录。')
  return session.user
}

export async function signOutCloud() {
  const session = sessionValue()
  if (session && isCloudSyncConfigured) {
    try {
      await authRequest('logout', {}, session.accessToken)
    } catch {
      // Clear the local session even if the network is unavailable.
    }
  }
  localStorage.removeItem(studyRecordKeys.session)
  announce('signed-out', '已退出云同步；本机记录仍保留。')
}

async function freshAccessToken() {
  let session = sessionValue()
  if (!session) throw new Error('请先登录邮箱账号。')
  if (session.expiresAt > Date.now() + 60_000) return session
  if (!session.refreshToken) {
    localStorage.removeItem(studyRecordKeys.session)
    throw new Error('登录状态已过期，请重新验证邮箱。')
  }
  const data = await authRequest('token?grant_type=refresh_token', { refresh_token: session.refreshToken })
  session = setSession(data)
  return session
}

async function restRequest(path, options = {}) {
  const session = await freshAccessToken()
  const response = await fetch(`${apiUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.message || data.details || '云端记录暂时无法读取，请稍后重试。')
  }
  if (response.status === 204) return null
  return response.json().catch(() => null)
}

function stableId(prefix, value) {
  return `${prefix}:${String(value || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`)}`
}

function plainText(value = '') {
  if (!value) return ''
  if (typeof DOMParser !== 'undefined') {
    const parsed = new DOMParser().parseFromString(String(value), 'text/html')
    return (parsed.body.textContent || '').replace(/\s+/g, ' ').trim()
  }
  return String(value).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim()
}

function questionSnapshot(question = {}) {
  return {
    id: question.id || '',
    number: question.number ?? '',
    module: question.module || '',
    type: question.type || '',
    title: question.title || '',
    source: question.source || '',
    sourceSystem: question.sourceSystem || '',
    sourceUrl: question.reviewUrl || question.sourceUrl || '',
    year: question.year || '',
    subject: question.subject || '',
    excerpt: question.excerpt || '',
    stem: plainText(question.stem || question.stemText || question.question || question.text || question.stemHtml || ''),
    materialTitle: question.materialTitle || '',
    material: plainText(question.material || question.materialHtml || ''),
    options: Array.isArray(question.options) ? question.options.map((option) => ({
      label: option.label || '',
      text: plainText(option.text || option.html || ''),
    })) : [],
    correct: question.correct || '',
    gradingNote: question.gradingNote || '',
  }
}

function makeRecord(record) {
  const numeric = (value) => value !== null && value !== undefined && Number.isFinite(Number(value)) ? Number(value) : null
  return {
    id: String(record.id),
    kind: record.kind,
    startedAt: record.startedAt || null,
    finishedAt: record.finishedAt || null,
    durationSeconds: numeric(record.durationSeconds),
    score: numeric(record.score),
    total: numeric(record.total),
    payload: record.payload || {},
  }
}

function escapeHtml(value = '') {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function retestQuestion(snapshot) {
  const safeQuestion = questionSnapshot(snapshot)
  return {
    ...safeQuestion,
    stemHtml: `<p>${escapeHtml(safeQuestion.stem)}</p>`,
    materialHtml: safeQuestion.material ? `<p>${escapeHtml(safeQuestion.material)}</p>` : '',
    options: safeQuestion.options.map((option) => ({ label: option.label, html: `<p>${escapeHtml(option.text)}</p>` })),
  }
}

export function collectLocalStudyRecords(context = {}) {
  const quiz = readJson(studyRecordKeys.quiz)
  const library = readJson(studyRecordKeys.library)
  const essay = readJson(studyRecordKeys.essay)
  const questionById = new Map((context.questions || []).map((question) => [question.id, question]))
  const catalogueById = new Map()
  for (const item of context.catalogue?.entries || []) {
    catalogueById.set(item.id, item)
    for (const alias of item.aliases || []) catalogueById.set(alias, item)
  }
  const essayById = new Map((context.essays || []).map((item) => [item.id, item]))
  const rows = []
  const quizAttempts = Array.isArray(quiz.attempts) ? quiz.attempts : []

  for (const attempt of quizAttempts) {
    if (!attempt?.id || !attempt.finishedAt) continue
    const enrichedAttempt = {
      ...attempt,
      answers: (attempt.answers || []).map((answer) => ({
        ...answer,
        question: questionSnapshot(answer.question || quiz.questionArchive?.[answer.id] || questionById.get(answer.id) || catalogueById.get(answer.id) || { id: answer.id }),
      })),
    }
    rows.push(makeRecord({
      id: stableId('xingce-round', attempt.id),
      kind: 'xingce_round',
      startedAt: attempt.startedAt,
      finishedAt: attempt.finishedAt,
      durationSeconds: attempt.durationSeconds,
      score: Number(attempt.correct) * 5,
      total: attempt.total,
      payload: { attempt: enrichedAttempt },
    }))
  }

  for (const [questionId, history] of Object.entries(quiz.questionHistory || {})) {
    for (const record of Array.isArray(history) ? history : []) {
      if (record.kind !== '单题复测' || !record.sessionId || !record.finishedAt) continue
      const question = questionSnapshot(record.question || quiz.questionArchive?.[questionId] || questionById.get(questionId) || catalogueById.get(questionId) || { id: questionId })
      rows.push(makeRecord({
        id: stableId('xingce-single', record.sessionId),
        kind: 'xingce_single',
        startedAt: record.startedAt,
        finishedAt: record.finishedAt,
        durationSeconds: record.durationSeconds,
        total: 1,
        payload: { questionId, question, answer: record },
      }))
    }
  }

  const libraryAttempts = Array.isArray(library.attempts) ? library.attempts : []
  for (const attempt of libraryAttempts) {
    if (!attempt?.id || !attempt.submittedAt) continue
    const catalogueItem = catalogueById.get(attempt.questionId) || catalogueById.get(attempt.question?.id)
    const quizId = attempt.quizId || catalogueItem?.quizId || ''
    const sourceQuestion = questionById.get(quizId) || {}
    const enrichedAttempt = {
      ...attempt,
      quizId,
      question: questionSnapshot({
        ...catalogueItem,
        ...sourceQuestion,
        ...(attempt.question || {}),
        id: quizId || attempt.questionId,
        module: attempt.question?.module || sourceQuestion.module || '',
        title: attempt.question?.title || catalogueItem?.title || sourceQuestion.title || '',
        source: attempt.question?.source || catalogueItem?.source || sourceQuestion.source || '',
        reviewUrl: attempt.question?.reviewUrl || attempt.question?.sourceUrl || catalogueItem?.sourceUrl || sourceQuestion.reviewUrl || '',
        correct: attempt.correct || attempt.question?.correct || sourceQuestion.correct || '',
      }),
    }
    rows.push(makeRecord({
      id: stableId('library', attempt.id),
      kind: 'library_answer',
      startedAt: attempt.startedAt,
      finishedAt: attempt.submittedAt,
      durationSeconds: attempt.durationSeconds,
      score: attempt.isScored ? (attempt.isCorrect ? 5 : 0) : null,
      total: attempt.isScored ? 1 : null,
      payload: { attempt: enrichedAttempt },
    }))
  }
  // Older versions kept only the most recent answer for each catalogue item.
  for (const [questionId, answer] of Object.entries(library.answers || {})) {
    if (!answer?.at) continue
    const id = stableId('library-legacy', `${questionId}:${answer.at}`)
    if (libraryAttempts.some((attempt) => attempt.questionId === questionId && attempt.submittedAt === answer.at)) continue
    const item = catalogueById.get(questionId)
    const quizId = item?.quizId || ''
    const sourceQuestion = questionById.get(quizId) || {}
    const isScored = item?.status === '可自动判分' && Boolean(sourceQuestion.correct)
    const correct = isScored ? sourceQuestion.correct : ''
    const attempt = {
      id: id.replace(/^library-legacy:/, 'legacy-'),
      questionId,
      quizId,
      startedAt: '',
      submittedAt: answer.at,
      durationSeconds: null,
      answer: answer.answer || '',
      correct,
      isScored,
      isCorrect: isScored ? answer.answer === correct : null,
      isEssay: item?.subject === '申论',
      question: questionSnapshot({ ...item, ...sourceQuestion, id: quizId || questionId, sourceUrl: item?.sourceUrl || sourceQuestion.reviewUrl }),
      legacy: true,
    }
    rows.push(makeRecord({
      id,
      kind: 'library_answer',
      finishedAt: answer.at,
      payload: { attempt },
    }))
  }

  for (const [essayId, attempts] of Object.entries(essay.attemptsByEssay || {})) {
    for (const attempt of Array.isArray(attempts) ? attempts : []) {
      if (!attempt?.id || !attempt.submittedAt) continue
      rows.push(makeRecord({
        id: stableId('essay', attempt.id),
        kind: 'essay_retest',
        startedAt: attempt.startedAt,
        finishedAt: attempt.submittedAt,
        durationSeconds: attempt.durationSeconds,
        payload: {
          essayId,
          essayTitle: attempt.essayTitle || essayById.get(essayId)?.title || '',
          attempt: { ...attempt, essayTitle: attempt.essayTitle || essayById.get(essayId)?.title || '' },
        },
      }))
    }
  }

  return mergeRecords([], rows).sort((a, b) => (b.finishedAt || '').localeCompare(a.finishedAt || ''))
}

function mergeRecords(existing = [], incoming = []) {
  const merged = new Map()
  for (const row of [...existing, ...incoming]) {
    if (row?.id) merged.set(row.id, { ...(merged.get(row.id) || {}), ...row })
  }
  return [...merged.values()]
}

async function listCloudRecords() {
  const rows = []
  const pageSize = 100
  for (let offset = 0; ; offset += pageSize) {
    const page = await restRequest(`study_attempts?select=id,kind,started_at,finished_at,duration_seconds,score,total,payload,created_at&order=created_at.asc,id.asc&limit=${pageSize}&offset=${offset}`)
    rows.push(...(page || []).map((row) => ({
      id: row.id,
      kind: row.kind,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      durationSeconds: row.duration_seconds,
      score: row.score,
      total: row.total,
      payload: row.payload || {},
    })))
    if (!page || page.length < pageSize) break
  }
  return rows.sort((a, b) => (b.finishedAt || '').localeCompare(a.finishedAt || ''))
}

async function insertCloudRecords(records) {
  if (!records.length) return
  const session = await freshAccessToken()
  const batchSize = 40
  for (let offset = 0; offset < records.length; offset += batchSize) {
    const rows = records.slice(offset, offset + batchSize).map((row) => ({
      id: row.id,
      user_id: session.user.id,
      kind: row.kind,
      started_at: row.startedAt,
      finished_at: row.finishedAt,
      duration_seconds: row.durationSeconds,
      score: row.score,
      total: row.total,
      payload: row.payload,
    }))
    await restRequest('study_attempts?on_conflict=user_id,id', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify(rows),
    })
  }
}

function queueRecord(record) {
  if (typeof window === 'undefined') return
  if (!sessionValue()) {
    announce(isCloudSyncConfigured ? 'local-only' : 'unconfigured')
    return
  }
  try {
    queueOutbox(record)
  } catch {
    announce('error', '本机暂时无法保存待同步队列；当前作答记录仍按原方式保存在题目页。')
    return
  }
  if (navigator.onLine) void syncBackground()
  else announce('offline', '当前离线，记录已保存在本机；联网后会自动补传。')
}

export function saveStudyAttempt(record) {
  queueRecord(makeRecord(record))
}

function mergeCloudIntoLocal(records) {
  const quiz = readJson(studyRecordKeys.quiz)
  const library = readJson(studyRecordKeys.library)
  const essay = readJson(studyRecordKeys.essay)
  const attempts = Array.isArray(quiz.attempts) ? [...quiz.attempts] : []
  const questionHistory = { ...(quiz.questionHistory || {}) }
  const questionArchive = { ...(quiz.questionArchive || {}) }
  const mistakeCounts = { ...(quiz.mistakeCounts || {}) }
  const libraryAttempts = Array.isArray(library.attempts) ? [...library.attempts] : []
  const attemptsByEssay = { ...(essay.attemptsByEssay || {}) }
  let quizChanged = false
  let libraryChanged = false
  let essayChanged = false

  for (const row of records) {
    const payload = row.payload || {}
    if (row.kind === 'xingce_round' && payload.attempt?.id) {
      if (!attempts.some((item) => item.id === payload.attempt.id)) {
        attempts.push({
          ...payload.attempt,
          answers: (payload.attempt.answers || []).map(({ question, ...answer }) => answer),
        })
        quizChanged = true
      }
      for (const answer of payload.attempt.answers || []) {
        if (!answer.id) continue
        const history = questionHistory[answer.id] || []
        const key = `${payload.attempt.id}:${answer.id}`
        if (!history.some((item) => item.sessionId === key || (item.sessionId === payload.attempt.id && item.kind === '20题复测'))) {
          questionHistory[answer.id] = [...history, {
            sessionId: payload.attempt.id,
            finishedAt: payload.attempt.finishedAt,
            kind: '20题复测',
            answer: answer.answer || '',
            correct: answer.correct || '',
            isCorrect: Boolean(answer.isCorrect),
            durationSeconds: answer.durationSeconds ?? payload.attempt.durationSeconds ?? 0,
            durationScope: 'question',
            isUncertain: Boolean(answer.isUncertain),
            isSlow: Boolean(answer.isSlow),
          }]
          quizChanged = true
        }
        if (answer.question && !questionArchive[answer.id]) {
          questionArchive[answer.id] = retestQuestion(answer.question)
          quizChanged = true
        }
      }
    }
    if (row.kind === 'xingce_single' && payload.questionId && payload.answer) {
      const history = questionHistory[payload.questionId] || []
      if (!history.some((item) => item.sessionId === payload.answer.sessionId && item.finishedAt === payload.answer.finishedAt)) {
        const { question, ...answer } = payload.answer
        questionHistory[payload.questionId] = [...history, answer]
        quizChanged = true
      }
      if (payload.question?.id && !questionArchive[payload.questionId]) {
        questionArchive[payload.questionId] = retestQuestion(payload.question)
        quizChanged = true
      }
    }
    if (row.kind === 'library_answer' && payload.attempt?.id && !libraryAttempts.some((item) => item.id === payload.attempt.id)) {
      libraryAttempts.push(payload.attempt)
      libraryChanged = true
    }
    if (row.kind === 'library_answer' && payload.attempt?.quizId && payload.attempt?.isScored && typeof payload.attempt.isCorrect === 'boolean') {
      const attempt = payload.attempt
      const history = questionHistory[attempt.quizId] || []
      const sessionId = `library:${attempt.id || row.id}`
      if (!history.some((item) => item.sessionId === sessionId)) {
        questionHistory[attempt.quizId] = [...history, {
          sessionId,
          startedAt: attempt.startedAt || '',
          finishedAt: attempt.submittedAt || row.finishedAt,
          kind: '全站题库',
          answer: attempt.answer || '',
          correct: attempt.correct || attempt.question?.correct || '',
          isCorrect: attempt.isCorrect,
          durationSeconds: attempt.durationSeconds,
          durationScope: 'question',
          isUncertain: false,
          isSlow: false,
        }].sort((a, b) => (a.finishedAt || '').localeCompare(b.finishedAt || ''))
        quizChanged = true
      }
      if (!attempt.isCorrect) {
        const totalWrong = questionHistory[attempt.quizId].filter((item) => item.isCorrect === false).length
        mistakeCounts[attempt.quizId] = Math.max(Number(mistakeCounts[attempt.quizId]) || 0, totalWrong)
        quizChanged = true
      }
      if (attempt.question?.id && !questionArchive[attempt.quizId]) {
        questionArchive[attempt.quizId] = retestQuestion(attempt.question)
        quizChanged = true
      }
    }
    if (row.kind === 'library_answer' && payload.attempt?.questionId && payload.attempt?.submittedAt && !payload.attempt?.isEssay) {
      const current = library.answers?.[payload.attempt.questionId]
      if (!current || (Date.parse(payload.attempt.submittedAt) || 0) > (Date.parse(current.at) || 0)) {
        library.answers = { ...(library.answers || {}), [payload.attempt.questionId]: { answer: payload.attempt.answer || '', at: payload.attempt.submittedAt } }
        libraryChanged = true
      }
    }
    if (row.kind === 'essay_retest' && payload.essayId && payload.attempt?.id) {
      const history = attemptsByEssay[payload.essayId] || []
      if (!history.some((item) => item.id === payload.attempt.id)) {
        attemptsByEssay[payload.essayId] = [...history, payload.attempt]
        essayChanged = true
      }
    }
  }

  if (quizChanged) {
    quiz.attempts = mergeRecords([], attempts).sort((a, b) => (b.finishedAt || '').localeCompare(a.finishedAt || ''))
    quiz.questionHistory = questionHistory
    quiz.questionArchive = questionArchive
    quiz.mistakeCounts = mistakeCounts
    writeJson(studyRecordKeys.quiz, quiz)
  }
  if (libraryChanged) {
    library.attempts = mergeRecords([], libraryAttempts).sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''))
    writeJson(studyRecordKeys.library, library)
  }
  if (essayChanged) {
    essay.attemptsByEssay = Object.fromEntries(Object.entries(attemptsByEssay).map(([id, items]) => [
      id,
      mergeRecords([], items).sort((a, b) => (a.submittedAt || '').localeCompare(b.submittedAt || '')),
    ]))
    writeJson(studyRecordKeys.essay, essay)
  }
}

let accountSyncPromise = null

export function bootstrapAccountSync(local = collectLocalStudyRecords()) {
  if (!isCloudSyncConfigured || !sessionValue()) return Promise.resolve(local)
  if (accountSyncPromise) return accountSyncPromise
  accountSyncPromise = (async () => {
    announce('syncing', '正在合并本机和云端记录。')
    // Inserts ignore existing (user_id, id) pairs, so no preliminary full-table read is needed.
    await insertCloudRecords(local)
    const all = await listCloudRecords()
    mergeCloudIntoLocal(all)
    clearOutbox(local.map((row) => row.id))
    announce('synced', `已同步 ${all.length} 条做题记录。`)
    return all
  })().finally(() => { accountSyncPromise = null })
  return accountSyncPromise
}

let backgroundSyncPromise = null

export function syncBackground() {
  if (!isCloudSyncConfigured || !sessionValue()) return Promise.resolve()
  if (backgroundSyncPromise) return backgroundSyncPromise
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    announce('offline', '当前离线，记录已留在本机，联网后会补传。')
    return Promise.resolve()
  }
  backgroundSyncPromise = (async () => {
    const pending = readOutbox()
    if (!pending.length) return
    try {
      announce('syncing', `正在补传 ${pending.length} 条新记录。`)
      await insertCloudRecords(pending)
      clearOutbox(pending.map((row) => row.id))
      announce('synced', `新增 ${pending.length} 条记录已同步。`)
    } catch (error) {
      announce('error', error.message)
    }
  })().finally(() => { backgroundSyncPromise = null })
  return backgroundSyncPromise
}

export async function readStudyRecords(local = collectLocalStudyRecords()) {
  if (!isCloudSyncConfigured || !sessionValue()) return local
  return bootstrapAccountSync(local)
}

export async function syncCurrentDeviceInBackground() {
  if (!isCloudSyncConfigured || !sessionValue()) return
  try {
    return await bootstrapAccountSync()
  } catch (error) {
    announce('error', error.message)
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { void syncCurrentDeviceInBackground() })
}
