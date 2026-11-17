const rawBase = (repository, commit) => `https://raw.githubusercontent.com/${repository}/${commit}/`
const paperCache = new Map()

function paperYear(filePath) {
  return Number(filePath.match(/(?:^|\/)(20\d{2})年/)?.[1] || 0)
}

function encodePath(value) {
  return value.split('/').map((part) => encodeURIComponent(part)).join('/')
}

function resolvePath(fromFile, relative) {
  const parts = fromFile.split('/')
  parts.pop()
  for (const part of relative.replace(/\\/g, '/').split('/')) {
    if (!part || part === '.') continue
    if (part === '..') parts.pop()
    else parts.push(part)
  }
  const result = parts.join('/')
  return result.startsWith('90-图片/') ? result : ''
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character])
}

function decodeEntities(value) {
  return value
    .replace(/&nbsp;|&#160;|&#xA0;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
}

function markdownToHtml(markdown, sourcePath, repository, commit) {
  const images = []
  const keepImage = (alt, src) => {
    const local = resolvePath(sourcePath, src)
    const url = /^https:\/\//i.test(src)
      ? src
      : local ? rawBase(repository, commit) + encodePath(local) : ''
    if (!url || !url.startsWith('https://')) return alt || '题目配图'
    const token = `XINGCEIMAGE${images.length}TOKEN`
    images.push(`<img src="${escapeHtml(url)}" alt="${escapeHtml(alt || '题目配图')}" loading="lazy" decoding="async" referrerpolicy="no-referrer">`)
    return token
  }

  let content = String(markdown || '')
    .replace(/<img\b([^>]*?)\bsrc\s*=\s*(["'])(.*?)\2([^>]*)>/gi, (tag, before, quote, src, after) => {
      const alt = `${before} ${after}`.match(/\balt\s*=\s*(["'])(.*?)\1/i)?.[2] || '题目配图'
      return keepImage(alt, src)
    })
    .replace(/!\[([^\]]*)\]\(<?([^\s)>]+)>?(?:\s+[^)]*)?\)/g, (_, alt, src) => keepImage(alt, src))
    .replace(/!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, src, alt) => keepImage(alt || '题目配图', src))
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?p\b[^>]*>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
  content = decodeEntities(content).replace(/\r\n?/g, '\n').trim()

  const renderInline = (text) => escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>')
    .replace(/XINGCEIMAGE(\d+)TOKEN/g, (_, number) => images[Number(number)] || '')

  const rows = content.split('\n')
  const blocks = []
  for (let index = 0; index < rows.length;) {
    if (!rows[index].trim()) { index++; continue }
    if (/^\s*\|/.test(rows[index])) {
      const tableRows = []
      while (index < rows.length && /^\s*\|/.test(rows[index])) tableRows.push(rows[index++])
      const cells = (row) => row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim())
      const header = cells(tableRows.shift() || '')
      const bodyRows = tableRows.filter((row) => !/^\s*\|?\s*:?-{3,}/.test(row))
      blocks.push(`<table><thead><tr>${header.map((cell) => `<th>${renderInline(cell)}</th>`).join('')}</tr></thead><tbody>${bodyRows.map((row) => `<tr>${cells(row).map((cell) => `<td>${renderInline(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`)
      continue
    }
    if (/^\s*(?:[-*+]\s+|\d+[.)]\s+)/.test(rows[index])) {
      const ordered = /^\s*\d+[.)]\s+/.test(rows[index])
      const list = []
      while (index < rows.length && /^\s*(?:[-*+]\s+|\d+[.)]\s+)/.test(rows[index])) {
        list.push(rows[index++].replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/, ''))
      }
      const tag = ordered ? 'ol' : 'ul'
      blocks.push(`<${tag}>${list.map((item) => `<li>${renderInline(item)}</li>`).join('')}</${tag}>`)
      continue
    }
    if (/^\s*>/.test(rows[index])) {
      const quote = []
      while (index < rows.length && /^\s*>/.test(rows[index])) quote.push(rows[index++].replace(/^\s*>\s?/, ''))
      blocks.push(`<blockquote><p>${renderInline(quote.join(' '))}</p></blockquote>`)
      continue
    }
    const paragraph = []
    while (index < rows.length && rows[index].trim()
      && !/^\s*(?:\|\s*|[-*+]\s+|\d+[.)]\s+|>)/.test(rows[index])) {
      paragraph.push(rows[index++].trim())
    }
    if (paragraph.length) blocks.push(`<p>${renderInline(paragraph.join(' '))}</p>`)
    else index++
  }
  return blocks.join('\n')
}

function frontMatter(text) {
  const block = text.match(/^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/)?.[1] || ''
  const values = {}
  for (const line of block.split('\n')) {
    const match = line.match(/^([^:]+):\s*["']?(.*?)["']?\s*$/)
    if (match) values[match[1].trim()] = match[2].trim()
  }
  return values
}

function gitBlobSha1(bytes) {
  return crypto.subtle.digest('SHA-1', bytes).then((digest) =>
    [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join(''))
}

async function loadPaper(entry, index, signal) {
  if (!paperCache.has(entry.path)) {
    paperCache.set(entry.path, (async () => {
      const response = await fetch(rawBase(index.repository, index.commit) + encodePath(entry.path), { cache: 'force-cache', signal })
      if (!response.ok) throw new Error(`读取来源失败（HTTP ${response.status}）：${entry.path}`)
      const bytes = new Uint8Array(await response.arrayBuffer())
      const header = new TextEncoder().encode(`blob ${bytes.length}\0`)
      const gitObject = new Uint8Array(header.length + bytes.length)
      gitObject.set(header)
      gitObject.set(bytes, header.length)
      const hash = await gitBlobSha1(gitObject)
      if (hash !== entry.sha) throw new Error(`来源校验失败，已跳过：${entry.path}`)
      return new TextDecoder('utf-8').decode(bytes)
    })())
  }
  try {
    return await paperCache.get(entry.path)
  } catch (error) {
    paperCache.delete(entry.path)
    throw error
  }
}

export function normalizeQuestionText(value) {
  return String(value || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ')
    .replace(/[\s\u00a0\p{P}\p{S}]/gu, '').toLocaleLowerCase()
}

export function parseSkillPaper(text, entry, pool) {
  const metadata = frontMatter(text)
  const module = pool.modules.find((item) => entry.path.startsWith(`${item.folder}/`))
  if (!module || /(?:^|\/)README\.md$/i.test(entry.path)) return []
  const title = metadata['试卷'] || text.match(/^#\s+(.+)$/m)?.[1]?.trim() || entry.path.split('/').at(-1).replace(/\.md$/i, '')
  const questions = [...text.matchAll(/^#{2,4}\s+第\s*(\d+)\s*题[^\n]*?\bqid\s+(\d+)(?:\s*[·•]\s*([^<\n]+))?/gim)]
  const materialHeads = [...text.matchAll(/^#{2,4}\s+((?:材料|资料)(?:\s*[0-9一二三四五六七八九十]+)?[^\n]*)\s*$/gm)]
  const sourceUrl = `https://github.com/${pool.repository}/blob/${pool.commit}/${encodePath(entry.path)}`
  const output = []

  for (let index = 0; index < questions.length; index++) {
    const heading = questions[index]
    const end = questions[index + 1]?.index ?? text.length
    const block = text.slice(heading.index + heading[0].length, end)
    const lines = block.split('\n')
    const optionPattern = /^\s*(?:[-*+]\s*)?\*\*([A-D])\*\*\s*[.．、)）:：]\s*(.*)$/i
    const simpleOptionPattern = /^\s*(?:[-*+]\s*)?([A-D])\s*[.．、)）]\s+(.*)$/i
    const options = []
    const stemLines = []
    let current = null
    let optionStarted = false
    for (const line of lines) {
      const match = line.match(optionPattern) || line.match(simpleOptionPattern)
      if (match) {
        optionStarted = true
        if (current) options.push(current)
        current = { label: match[1].toUpperCase(), lines: [match[2].replace(/\s*✅\s*$/, '').trim()] }
        continue
      }
      if (/^\s*\*\*答案\*\*\s*[：:]/.test(line) || /^\s*\*\*官方解析\*\*/.test(line) || /^\s*#{2,4}\s/.test(line)) {
        if (current) options.push(current)
        current = null
        if (optionStarted) break
      }
      if (optionStarted) {
        if (current) current.lines.push(line.replace(/\s*✅\s*$/, '').trim())
      } else stemLines.push(line)
    }
    if (current) options.push(current)
    const answerText = block.match(/^\s*\*\*答案\*\*\s*[：:]\s*([^\r\n]+)/m)?.[1]?.trim() || ''
    const correct = /^[A-D]$/.test(answerText) ? answerText : ''
    const normalizedOptions = options.map((option) => ({
      label: option.label,
      raw: option.lines.join('\n').trim(),
    }))
    if (!correct || normalizedOptions.length !== 4
        || normalizedOptions.map((option) => option.label).join('') !== 'ABCD') continue

    const stem = stemLines.join('\n').trim()
    if (!stem) continue
    const number = Number(heading[1])
    const qid = heading[2]
    const topic = heading[3]?.trim() || module.label
    const material = [...materialHeads].reverse().find((item) => item.index < heading.index)
    let materialHtml = ''
    let materialTitle = ''
    if (material) {
      const nextMaterial = materialHeads.find((item) => item.index > material.index)
      const firstQuestionAfter = questions.find((item) => item.index > material.index)
      const materialEnd = Math.min(nextMaterial?.index ?? text.length, firstQuestionAfter?.index ?? text.length)
      if (heading.index < (nextMaterial?.index ?? text.length)) {
        materialTitle = material[1].trim()
        materialHtml = markdownToHtml(text.slice(material.index + material[0].length, materialEnd), entry.path, pool.repository, pool.commit)
      }
    }
    output.push({
      id: `xingce-${qid}`,
      title,
      number,
      type: topic,
      module: module.label,
      correct,
      answerStatus: 'upstream-reference',
      source: `${metadata['年份'] || ''} ${metadata['地区'] || ''} · ${title} · 第${number}题`.trim(),
      sourceUrl,
      reviewUrl: '',
      gradingNote: '参考答案来自行测真题技能固定版题目文件，尚未逐题与粉笔核对；如发现答案或题面有疑问，应按同一题面版本到粉笔核对。',
      stemHtml: markdownToHtml(stem, entry.path, pool.repository, pool.commit),
      options: normalizedOptions.map((option) => ({
        label: option.label,
        html: markdownToHtml(option.raw, entry.path, pool.repository, pool.commit),
      })),
      materialTitle,
      materialHtml,
      origin: '行测真题技能在线题库',
      sourceSystem: pool.repository,
      sourceCommit: pool.commit,
      sourcePaper: entry.path,
      sourceQid: qid,
    })
  }
  return output
}

function weightedPick(entries) {
  const total = entries.reduce((sum, item) => sum + Math.max(1, Number(item.size) || 1), 0)
  let cursor = Math.random() * total
  for (const entry of entries) {
    cursor -= Math.max(1, Number(entry.size) || 1)
    if (cursor <= 0) return entry
  }
  return entries.at(-1)
}

export async function fetchSkillQuestions({ index, pool, targetCounts, excludedIds = new Set(), excludedTexts = new Set(), signal }) {
  if (index.repository !== pool.repository || index.commit !== pool.commit || index.entries.length !== pool.sourceIndexEntries) {
    throw new Error('技能题库目录版本不一致，已停止抽题。')
  }
  const eligibleEntries = index.entries.filter((entry) => /\.md$/i.test(entry.path)
    && !/(?:^|\/)README\.md$/i.test(entry.path)
    && paperYear(entry.path) >= pool.fromYear && paperYear(entry.path) <= pool.throughYear)
  if (eligibleEntries.length !== pool.eligibleSourceFiles) throw new Error('2020年起的技能题源数量与索引不一致，已停止抽题。')
  const modules = pool.modules.filter((module) => (targetCounts[module.key] || 0) > 0)
  const loaded = []
  for (let offset = 0; offset < modules.length; offset += 2) {
    if (signal?.aborted) throw new DOMException('抽题已停止', 'AbortError')
    const batch = await Promise.all(modules.slice(offset, offset + 2).map(async (module) => {
    const target = targetCounts[module.key]
    const remaining = eligibleEntries.filter((entry) => entry.path.startsWith(`${module.folder}/`))
    const candidates = []
    const seen = new Set()
    const failures = []
    let networkFailures = 0
    for (let tries = 0; tries < 12 && candidates.length < target && remaining.length; tries++) {
      if (signal?.aborted) throw new DOMException('抽题已停止', 'AbortError')
      const entry = weightedPick(remaining)
      remaining.splice(remaining.indexOf(entry), 1)
      try {
        const text = await loadPaper(entry, index, signal)
        for (const question of parseSkillPaper(text, entry, pool)) {
          if (excludedIds.has(question.id) || seen.has(question.id)) continue
          const fingerprint = normalizeQuestionText(question.stemHtml + question.options.map((option) => option.html).join(''))
          if (!fingerprint || excludedTexts.has(fingerprint)) continue
          seen.add(question.id)
          candidates.push(question)
        }
      } catch (error) {
        if (signal?.aborted) throw error
        failures.push(error.message)
        if (error instanceof TypeError || /failed to fetch|networkerror|cors|http (?:403|429)/i.test(error.message)) {
          networkFailures++
          if (networkFailures >= 3) break
        } else networkFailures = 0
      }
    }
      return { questions: shuffleCopy(candidates).slice(0, target), failures, target }
    }))
    loaded.push(...batch)
  }
  return {
    questions: loaded.flatMap((item) => item.questions),
    failures: loaded.flatMap((item) => item.failures),
    requested: loaded.reduce((sum, item) => sum + item.target, 0),
  }
}

function shuffleCopy(items) {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index--) {
    const swap = Math.floor(Math.random() * (index + 1))
    ;[copy[index], copy[swap]] = [copy[swap], copy[index]]
  }
  return copy
}
