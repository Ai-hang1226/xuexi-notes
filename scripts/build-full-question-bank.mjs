import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { createMarkdownRenderer } from 'vitepress'

// This catalogue records questions already present on the website. It does not
// infer an answer, change a previous attempt, or promote a fragment to a test.
const root = process.cwd()
const md = await createMarkdownRenderer(root, { html: true, math: true }, '/')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n')
const bank = JSON.parse(read('retest/questions.json'))
const reviews = JSON.parse(read('cuotiben/review-catalog.json'))
const recoveredFragments = JSON.parse(read('retest/recovered-lesson-fragments.json')).questions
const fenbiVerified = JSON.parse(read('retest/fenbi-verified.json')).questions
const reviewedQuestions = JSON.parse(read('retest/reviewed-questions.json'))
const existingReviewLinks = new Map(reviewedQuestions.existingLinks.map((link) => [link.reviewUrl, link]))
const legacyUnscoredUrls = new Set([...reviewedQuestions.questions, ...reviewedQuestions.existingLinks]
  .filter((item) => item.legacyUnscored === true).map((item) => item.reviewUrl))
if (existingReviewLinks.size !== reviewedQuestions.existingLinks.length) throw new Error('复盘关联网址重复')
const publicCandidates = JSON.parse(read('retest/public-source-candidates.json')).records
const methodReferences = JSON.parse(read('retest/method-question-references.json')).questions
const dispositions = JSON.parse(read('retest/question-dispositions.json')).records
const entries = []
const byFingerprint = new Map()
const byReviewUrl = new Map()
const coverage = { lessonExamples: 0, paperQuestions: 0, reviewReferences: 0, mappedExamples: 0, essaySources: 0, otherExamples: 0 }

function textOf(value = '') {
  return value.replace(/<[^>]*>/g, ' ').replace(/&(?:nbsp|#160);/g, ' ')
    .replace(/&(?:amp|lt|gt|quot);/g, ' ').replace(/\s+/g, ' ').trim()
}
function clean(value = '') {
  return value.replace(/<\/?mark\b[^>]*>/gi, '').replace(/<script\b[\s\S]*?<\/script>/gi, '').trim()
}
const render = (value) => md.render(clean(value)).trim()
const inline = (value) => md.renderInline(clean(value)).trim()
const stableId = (value) => 'site-' + crypto.createHash('sha256').update(value).digest('hex').slice(0, 16)
function fingerprint(stem, options = []) {
  if (!stem || options.length !== 4) return ''
  const body = [stem, ...options.map((o) => o.html)].join('')
    .replace(/<[^>]*>/g, '').replace(/[\s\u00a0\p{P}\p{S}]/gu, '').slice(0, 600)
  const images = [...stem.matchAll(/<img\b[^>]*src=["']([^"']+)/gi)].map((m) => m[1]).join('|')
  return crypto.createHash('sha256').update(body + images).digest('hex')
}
function route(file, anchor = '') {
  return '/' + file.replace(/\.md$/, '') + (anchor ? '#' + anchor : '')
}
function addAlias(item, alias) {
  if (!alias || alias === item.id) return
  item.aliases ||= []
  if (!item.aliases.includes(alias)) item.aliases.push(alias)
}
function add(entry, key = '') {
  const known = entries.find((item) => item.id === entry.id) || (key && byFingerprint.get(key))
  if (known) {
    if (known.id !== entry.id) addAlias(known, entry.id)
    if (entry.sourceUrl && !known.sources.some((s) => s.url === entry.sourceUrl)) {
      known.sources.push({ label: entry.source, url: entry.sourceUrl })
    }
    return known
  }
  const item = { ...entry, sources: entry.sourceUrl ? [{ label: entry.source, url: entry.sourceUrl }] : [] }
  entries.push(item)
  if (key) byFingerprint.set(key, item)
  if (entry.sourceUrl) byReviewUrl.set(entry.sourceUrl, item)
  return item
}
function anchors(file, text) {
  const result = new Map()
  const tokens = md.parse(text, {})
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (token.type === 'heading_open' && token.map) {
      result.set(token.map[0], token.attrGet('id') || '')
    }
  }
  return result
}
function headingMatches(text, re) {
  const lines = text.split('\n')
  const matches = []
  for (let i = 0; i < lines.length; i++) {
    const hit = lines[i].match(re)
    if (hit) matches.push({ line: i, number: hit[1], title: lines[i].replace(/^#+\s*/, '').replace(/\s*\{#[^}]+\}\s*$/, '').trim() })
  }
  return { lines, matches }
}
function splitChoices(text) {
  const lines = text.split('\n')
  const choices = []
  const re = /^\s*(?:>\s*)?(?:[-*]\s*)?(?:\*\*)?([A-D])(?:[．.、)）:]|\*\*(?:[．.、)）:]|\s)|\s|$)(?:\*\*)?\s*(.*)$/
  for (let i = 0; i < lines.length; i++) {
    const hit = lines[i].match(re)
    if (hit) choices.push({ label: hit[1], line: i, text: hit[2] })
  }
  if (choices.length !== 4 || choices.map((c) => c.label).join('') !== 'ABCD') return null
  const options = choices.map((choice, i) => {
    let optionEnd = choices[i + 1]?.line ?? lines.length
    if (i === choices.length - 1) {
      const heading = lines.findIndex((line, n) => n > choice.line && /^#{1,3}\s/.test(line))
      if (heading >= 0) optionEnd = Math.min(optionEnd, heading)
    }
    const rest = lines.slice(choice.line + 1, optionEnd)
      .join('\n').replace(/<\/?section[^>]*>/g, '').trim()
    return { label: choice.label, html: rest ? render(choice.text + '\n\n' + rest) : inline(choice.text) }
  })
  return { stem: lines.slice(0, choices[0].line).join('\n').trim(), options }
}
function firstQuoted(text) {
  const lines = text.split('\n')
  const start = lines.findIndex((line) => /^>\s?/.test(line) && !/^>\s*(?:🏷️|⚠️)/.test(line))
  if (start < 0) return ''
  const out = []
  for (let i = start; i < lines.length; i++) {
    if (!/^>/.test(lines[i])) break
    out.push(lines[i].replace(/^>\s?/, ''))
  }
  return out.join('\n').trim()
}
function questionBody(block) {
  return block.replace(/^\s*(?:来源|题源)[：:][^\n]*$/gm, '')
    .replace(/<\/?section[^>]*>/g, '').replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/^\s*\[.*?(?:首答|结果|批改).*?\].*$/gm, '').trim()
}
function reviewOriginal(block) {
  const marker = /(?:\*\*(?:题目回顾|完整原题与选项|原题与全部选项|原题与选项|原题和选项)\*\*[：:]?|^#{2,5}\s*(?:题目回顾|完整原题与选项|原题与全部选项|原题与选项|原题和选项)\s*$)/m.exec(block)
  if (!marker) return ''
  let original = block.slice(marker.index + marker[0].length)
  const boundary = original.search(/^(?:\s*<BreakPointCard\b|\s*<a\s+class=|#{2,5}\s+(?:本人思路|最终正确解析|易错提醒|题源|复盘)|\s*\*\*(?:本人思路|最终正确解析|易错提醒|参考答案|正确答案|解析|原答|题源)[^\n]*|\s*---\s*$)/m)
  if (boundary >= 0) original = original.slice(0, boundary)
  const firstLine = original.split('\n').find((line) => line.trim()) || ''
  return /^>/.test(firstLine) ? firstQuoted(original) : questionBody(original)
}

// Start from the existing test: IDs and local mistake records stay unchanged.
for (const q of bank.questions) {
  const questionName = typeof q.number === 'number' ? '第' + q.number + '题' : String(q.number)
  add({
    id: q.id, quizId: q.id, subject: '行测', status: '可自动判分',
    title: q.title || q.module + ' · ' + questionName, source: q.origin,
    sourceUrl: q.reviewUrl, excerpt: textOf(q.stemHtml).slice(0, 220),
    search: textOf([q.stemHtml, ...q.options.map((o) => o.html)].join(' ')),
  }, fingerprint(q.stemHtml, q.options))
}

// Every named lesson example gets an entry, even if the lecture only supplied
// a fragment or its inferred answer has not been checked.
const lessonFile = 'xingce/大宝小宝言语体系-正文.md'
const lesson = read(lessonFile)
const lessonAnchors = anchors(lessonFile, lesson)
const lessonParts = headingMatches(lesson, /^#{4,5}\s+例\s*(\d+\.\d+)[^\n]*$/)
for (let i = 0; i < lessonParts.matches.length; i++) {
  const h = lessonParts.matches[i]
  const block = lessonParts.lines.slice(h.line + 1, lessonParts.matches[i + 1]?.line ?? lessonParts.lines.length).join('\n')
  const tag = block.search(/^>\s*🏷️/m)
  const beforeTag = tag < 0 ? block : block.slice(0, tag)
  const quotedQuestion = firstQuoted(beforeTag)
  const choices = splitChoices(quotedQuestion)
  const stem = choices ? choices.stem : quotedQuestion
  const stemHtml = stem ? render(stem) : ''
  const options = choices?.options || []
  const sourceUrl = route(lessonFile, lessonAnchors.get(h.line))
  const recovered = !options.length && recoveredFragments.find((q) => clean(q.lessonStem) === clean(stem))
  const verified = fenbiVerified.find((q) => q.reviewUrl === sourceUrl)
  const verifiedFingerprint = verified && fingerprint(render(verified.stem), verified.options.map((option) => ({ html: inline(option.text) })))
  const linked = (verified && (entries.find((entry) => entry.quizId === verified.id) || byFingerprint.get(verifiedFingerprint)))
    || (recovered && entries.find((entry) => entry.quizId === recovered.id))
  if (linked) {
    addAlias(linked, stableId(sourceUrl))
    if (!linked.sources.some((source) => source.url === sourceUrl)) linked.sources.push({ label: '知识点讲义原题', url: sourceUrl })
  }
  else add({
    id: stableId(sourceUrl), subject: '行测', status: options.length === 4 ? '待核对' : '题面不完整',
    title: '言语讲义 · ' + h.title, source: '知识点讲义', sourceUrl,
    excerpt: textOf(stemHtml).slice(0, 220) || '原页为讲义片段，请打开原位置查看。',
    search: textOf([stemHtml, ...options.map((o) => o.html)].join(' ')),
    stemHtml, options,
  }, fingerprint(stemHtml, options))
  coverage.lessonExamples++
}

// Daily papers and the historical assessment are indexed separately from
// their answer/review pages. Pending papers remain pending and are not graded.
const dailyFiles = fs.readdirSync(path.join(root, 'daily-quizzes'))
  .filter((name) => /^\d{4}-\d{2}-\d{2}(?:-[^.]+)?\.md$/.test(name)
    && !/-(?:answer|review|essay|summary|score)(?:-|\.md$)/.test(name)
    && name !== '2026-11-07-xingce-135.md').sort()
for (const name of dailyFiles) {
  const file = 'daily-quizzes/' + name
  const text = read(file)
  const isAssessment = name.includes('assessment')
  const intro = text.slice(0, 1800)
  const isHistory = /本卷[^\n]*(?:自编|模拟)|AI自编|本次体验不替代/.test(intro)
  const isReal = !isHistory && /真题|网友回忆版/.test(intro)
  const reviewFile = file.replace(/\.md$/, '-review.md')
  const hasReview = fs.existsSync(path.join(root, reviewFile))
  const reviewText = hasReview ? read(reviewFile).slice(0, 1600) : ''
  const pending = name.endsWith('-trial.md') || !hasReview || /等待交卷|尚未收到本人作答/.test(reviewText)
  const heading = isAssessment ? /^###\s+第\s*(\d+)题[^\n]*$/ : /^##\s+第\s*(\d+)题[^\n]*$/
  const { lines, matches } = headingMatches(text, heading)
  const pageAnchors = anchors(file, text)
  for (let i = 0; i < matches.length; i++) {
    const h = matches[i]
    let end = matches[i + 1]?.line ?? lines.length
    for (let j = h.line + 1; j < end; j++) {
      if (/^##\s+(?:交卷|七、申论|申论)/.test(lines[j])) { end = j; break }
    }
    const body = questionBody(lines.slice(h.line + 1, end).join('\n'))
    const isEssay = !isAssessment && (Number(h.number) >= 9 || (name.includes('-trial') && Number(h.number) === 3))
    const choices = isEssay ? null : splitChoices(body)
    const stemHtml = choices?.stem ? render(choices.stem) : (isEssay ? render(body) : '')
    const options = choices?.options || []
    let materialHtml = ''
    if (isAssessment && Number(h.number) >= 43) {
      let materialStart = h.line - 1
      while (materialStart >= 0 && !/^### 资料[一二]/.test(lines[materialStart])) materialStart--
      if (materialStart >= 0) {
        let materialEnd = materialStart + 1
        while (materialEnd < lines.length && !/^### 第\d+题/.test(lines[materialEnd])) materialEnd++
        materialHtml = render(lines.slice(materialStart + 1, materialEnd).join('\n'))
      }
    }
    const url = route(file, pageAnchors.get(h.line))
    let linked
    if (name === '2026-11-06.md' && !isEssay) {
      linked = entries.find((entry) => entry.quizId && bank.questions.some((q) => q.id === entry.quizId
        && q.number === Number(h.number) && q.reviewUrl.includes('每日测验复盘-2026-11-06')))
    }
    const item = {
      id: stableId(url), subject: isEssay ? '申论' : '行测',
      status: pending ? '原卷待答' : isEssay && isReal ? '申论材料题' : isHistory ? '历史自编' : '待核对',
      title: name.slice(0, 10) + (isAssessment ? ' · 阶段测评' : name.includes('trial') ? ' · 体验卷' : ' · 每日测验') + ' · 第' + h.number + '题',
      source: isReal ? '每日真题卷' : isHistory ? '历史自编卷' : '每日试卷（题源待核）', sourceUrl: url,
      excerpt: textOf(stemHtml).slice(0, 220) || '请打开原卷查看题目和配图。',
      search: textOf([materialHtml, stemHtml, ...options.map((o) => o.html)].join(' ')), stemHtml, options, materialHtml,
    }
    if (linked) {
      linked.sources.push({ label: item.source, url })
    } else add(item, fingerprint(stemHtml, options))
    coverage.paperQuestions++
  }
  if (isAssessment) {
    const at = lines.findIndex((line) => /^## 七、申论/.test(line))
    if (at >= 0) {
      const until = lines.findIndex((line, i) => i > at && /^## 交卷/.test(line))
      const stemHtml = render(questionBody(lines.slice(at + 1, until < 0 ? lines.length : until).join('\n')))
      const url = route(file, pageAnchors.get(at))
      add({ id: stableId(url), subject: '申论', status: '历史自编', title: '2026-11-04 · 阶段测评 · 申论', source: '历史自编卷', sourceUrl: url, excerpt: textOf(stemHtml).slice(0, 220), search: textOf(stemHtml), stemHtml, options: [] })
      coverage.paperQuestions++
    }
  }
}

// The 135-question paper has custom HTML and fixed question IDs.
const bigPaper = 'daily-quizzes/2026-11-07-xingce-135.md'
const bigText = read(bigPaper)
for (const hit of bigText.matchAll(/^### 第(\d+)题\s*\{#q\d+\}\n([\s\S]*?)(?=^### (?:第\d+题|阅读材料)|^## |$(?![\s\S]))/gm)) {
  const n = Number(hit[1]), url = route(bigPaper, 'q' + n)
  const known = entries.find((entry) => entry.quizId === 'q' + n)
  if (known) {
    addAlias(known, stableId(url))
    if (!known.sources.some((source) => source.url === url)) known.sources.push({ label: '135题综合真题卷', url })
  }
  else {
    const body = hit[2], start = body.indexOf('<div class="exam-question">')
    const stop = body.indexOf('<p class="exam-provenance">', start)
    const original = start >= 0 && stop > start ? body.slice(body.indexOf('>', start) + 1, stop) : ''
    const options = [...original.matchAll(/<div class="exam-option">\s*<strong>([A-D])\.<\/strong>\s*([\s\S]*?)<\/div>/g)]
      .map((m) => ({ label: m[1], html: m[2].trim() }))
    const stemHtml = clean(original.replace(/<div class="exam-option">\s*<strong>[A-D]\.<\/strong>\s*[\s\S]*?<\/div>/g, ''))
    add({ id: stableId(url), subject: '行测', status: '答案有争议', title: '135题综合真题卷 · 第' + n + '题', source: '综合真题卷', sourceUrl: url, excerpt: textOf(stemHtml).slice(0, 220), search: textOf(stemHtml), stemHtml, options })
  }
  coverage.paperQuestions++
}

// Keep all pre-existing review references, including incomplete early notes.
for (const row of reviews) {
  let known = byReviewUrl.get(row.url) || entries.find((entry) => entry.sources.some((s) => s.url === row.url))
  const verified = fenbiVerified.find((question) => question.reviewUrl === row.url)
  const existingLink = existingReviewLinks.get(row.url)
  if (existingLink) {
    const existing = entries.find((entry) => entry.quizId === existingLink.questionId)
    if (!existing || (known && known.quizId !== existingLink.questionId)) {
      throw new Error('复盘关联的既有题不存在或有冲突：' + existingLink.questionId)
    }
    known = existing
  }
  if (!known && verified) {
    const key = fingerprint(render(verified.stem), verified.options.map((option) => ({ html: inline(option.text) })))
    known = entries.find((entry) => entry.quizId === verified.id) || byFingerprint.get(key)
  }
  if (!known && row.url.includes('135题混合真题批改')) {
    const n = row.url.match(/#q(\d+)/)?.[1]
    known = entries.find((entry) => entry.quizId === 'q' + n || entry.sourceUrl === route(bigPaper, 'q' + n))
  }
  if (!known && row.url.includes('江苏A类阶段测评复盘-2026-11-04')) {
    const n = row.url.match(/#q(\d+)/)?.[1]
    known = entries.find((entry) => entry.title === '2026-11-04 · 阶段测评 · 第' + n + '题')
  }
  if (known) {
    const reviewAlias = stableId(row.url)
    addAlias(known, reviewAlias)
    if (legacyUnscoredUrls.has(row.url)) {
      known.legacyUnscoredIds ||= []
      if (!known.legacyUnscoredIds.includes(reviewAlias)) known.legacyUnscoredIds.push(reviewAlias)
    }
    if (!known.sources.some((s) => s.url === row.url)) known.sources.push({ label: '错题复盘', url: row.url })
  } else {
    const [page, anchor] = row.url.split('#')
    const file = page.replace(/^\//, '') + '.md'
    let stemHtml = '', options = [], disputedFigure = false
    if (anchor && fs.existsSync(path.join(root, file))) {
      const text = read(file), lines = text.split('\n')
      const explicit = lines.findIndex((line) => line.includes('{#' + anchor + '}'))
      const headingMap = anchors(file, text)
      const at = explicit >= 0 ? explicit : [...headingMap].find(([, id]) => id === anchor)?.[0]
      if (Number.isInteger(at)) {
        const level = lines[at].match(/^#+/)?.[0].length || 3
        let end = at + 1
        while (end < lines.length && !new RegExp('^#{1,' + level + '}\\s').test(lines[end])) end++
        const block = lines.slice(at + 1, end).join('\n')
        let original = reviewOriginal(block)
        if (!original) original = block.match(/<summary>[^<]*(?:原题|全部选项)[^<]*<\/summary>\s*([\s\S]*?)<\/details>/)?.[1] || ''
        const choices = splitChoices(original)
        if (choices?.stem) { stemHtml = render(choices.stem); options = choices.options }
        else if (original) stemHtml = render(original)
        if (!original && file === 'cuotiben/图形推理专项复盘-2026-10-21.md' && anchor === 'q1') {
          const figure = block.match(/<figure\b[^>]*>[\s\S]*?<\/figure>/)?.[0]
          if (figure && /第1题-原题与选项\.png/.test(figure)
              && fs.existsSync(path.join(root, 'public/figure-review-20261021/第1题-原题与选项.png'))) {
            stemHtml = render('从所给的四个选项中选择最合适的一项，填入问号处，使图形呈现一定规律。\n\n' + figure)
            options = ['A', 'B', 'C', 'D'].map((label) => ({ label, html:'' }))
            disputedFigure = true
          }
        }
      }
    }
    const status = disputedFigure || /争议|分歧/.test((row.reviewState || '') + (row.note || '')) ? '答案有争议'
      : options.length === 4 ? '待核对' : '题面待整理'
    add({ id: stableId(row.url), subject: '行测', status, title: row.title, source: '错题复盘', sourceUrl: row.url,
      excerpt: textOf(stemHtml).slice(0, 220) || '保留原题或原复盘，题面完整性与答案仍需核对。',
      search: row.title + ' ' + textOf([stemHtml, ...options.map((o) => o.html)].join(' ')), stemHtml, options }, fingerprint(stemHtml, options))
  }
  coverage.reviewReferences++
}

// Pick up newly added, clearly delimited review questions on later builds even
// when the hand-maintained review catalogue has not yet been updated.
for (const name of fs.readdirSync(path.join(root, 'cuotiben')).filter((value) => value.endsWith('.md'))) {
  const file = 'cuotiben/' + name, text = read(file), lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const heading = lines[i].match(/^(#{2,4})\s+(?:第\s*\d+\s*题|题\s*\d+)[^\n]*\{#(q[\w-]+)\}\s*$/)
    if (!heading) continue
    const url = route(file, heading[2])
    if (entries.some((entry) => entry.sources.some((source) => source.url === url))) continue
    let end = i + 1
    while (end < lines.length && !new RegExp('^#{1,' + heading[1].length + '}\\s').test(lines[end])) end++
    const original = reviewOriginal(lines.slice(i + 1, end).join('\n'))
    if (!original) continue
    const choices = splitChoices(original)
    const stemHtml = choices?.stem ? render(choices.stem) : render(original)
    const options = choices?.options || []
    add({ id:stableId(url), subject:'行测', status:options.length === 4 ? '待核对' : '题面待整理',
      title:lines[i].replace(/^#+\s*/, '').replace(/\s*\{#[^}]+\}\s*$/, '').trim(),
      source:'错题复盘', sourceUrl:url, excerpt:textOf(stemHtml).slice(0, 220),
      search:textOf([stemHtml, ...options.map((option) => option.html)].join(' ')), stemHtml, options }, fingerprint(stemHtml, options))
  }
}

// The verbal-method map repeats questions alongside learning methods. Keep its
// actual question text but never copy answer-bearing headings into the prompt.
const mappedFile = 'cuotiben/言语体系总览与真题归位.md'
const mappedText = read(mappedFile), mappedAnchors = anchors(mappedFile, mappedText)
const mapped = headingMatches(mappedText, /^###\s+▶\s*题\s*(\d+)[^\n]*$/)
for (let i = 0; i < mapped.matches.length; i++) {
  const h = mapped.matches[i], block = mapped.lines.slice(h.line + 1, mapped.matches[i + 1]?.line ?? mapped.lines.length).join('\n')
  const marker = block.search(/\*\*真题重现\*\*[：:]?/)
  const original = marker >= 0 ? firstQuoted(block.slice(marker)) : ''
  const choices = splitChoices(original), stemHtml = choices?.stem ? render(choices.stem) : ''
  const options = choices?.options || [], url = route(mappedFile, mappedAnchors.get(h.line))
  const explicitAnchor = h.title.match(/\{#([^}]+)\}/)?.[1] || mappedAnchors.get(h.line)
  const corresponding = entries.find((entry) => entry.sources.some((s) => s.url.includes('xingce-cuoti')
    && ((explicitAnchor && s.url.endsWith('#' + explicitAnchor))
      || (Number(h.number) <= 7 && s.url.includes('#_' + h.number + '-2023江苏-')))))
  if (corresponding) corresponding.sources.push({ label: '言语体系真题归位', url })
  else add({ id: stableId(url), subject: '行测', status: /争议/.test(h.title) ? '答案有争议' : options.length === 4 ? '待核对' : '题面待整理',
    title: '言语体系真题 · 第' + h.number + '题', source: '言语体系真题归位', sourceUrl: url,
    excerpt: textOf(stemHtml).slice(0, 220) || '请打开原页查看原题和材料。',
    search: textOf([stemHtml, ...options.map((o) => o.html)].join(' ')), stemHtml, options }, fingerprint(stemHtml, options))
  coverage.mappedExamples++
}

// Five source pages contain full essay materials. Strip highlighting and
// answer-oriented editor headings before they are presented for a new attempt.
const essays = [
  ['day5-city-greening', 'DAY5 · 城市绿化', '2024安徽A，讲义标注'],
  ['day6-business-environment', 'DAY6 · 营商环境', '2023山西省市，讲义标注'],
  ['day7-backpack-bank', 'DAY7 · 背包银行', '2024江西县乡，讲义标注'],
  ['day8-public-services', 'DAY8 · 公共服务', '2016江苏事业单位，讲义标注'],
  ['day9-digital-city', 'DAY9 · 数字城市', '2024福建省市，讲义标注'],
]
for (const [slug, title, source] of essays) {
  const file = 'shenlun/sources/' + slug + '.md', text = read(file)
  let body = ''
  if (/## 一、题干与要求/.test(text)) {
    const prompt = text.split('## 一、题干与要求')[1]?.split('## 二、完整材料')[0] || ''
    const material = (text.split('## 二、完整材料')[1]?.split('## 三、')[0] || '').replace(/^[^\n]*\n/, '')
    body = prompt.replace(/^\*\*题目来源[^\n]*$/gm, '').replace(/^\*\*讲义单元[^\n]*$/gm, '') + '\n\n' + material
  } else {
    body = text.split('## 完整讲义文字')[1]?.split(/^## 老师/m)[0] || ''
  }
  body = body.replace(/^>\s*\*\*?阅读标记[^\n]*$/gm, '').replace(/^###\s+材料\d+[^\n]*$/gm, '')
    .replace(/^\*\*(?:对应答案|背景展示)[^\n]*\*\*\s*$/gm, '')
    .replace(/^\s*DAY\d+[^\n]*$/gm, '').replace(/^\s*20\d\d 年公务员[^\n]*$/gm, '').trim()
  const stemHtml = render(body), url = '/shenlun/' + slug
  add({ id: 'essay-' + slug, subject: '申论', status: '申论材料题', title, source, sourceUrl: url, excerpt: textOf(stemHtml).slice(0, 220), search: textOf(stemHtml), stemHtml, options: [] })
  coverage.essaySources++
}

// Older method examples were identified from line numbers. Keep their existing
// IDs when explanatory text is added or sections move; the unchanged source
// anchor is the key. A missing or duplicate anchor must be reviewed explicitly.
const stableMethodExampleIds = new Map([
  ['/xingce/shuliang-guanxi#✅-深挖-比例交叉·整除问题-统一比例-2×2表-⭐高频', 'site-74dd8ed7212496f5'],
  ['/xingce/shuliang-guanxi#✅-深挖-周期循环工程·干几天休几天-最后一步别多算休息日-⭐高频', 'site-a79ad790c38c4bbf'],
  ['/xingce/ziliao-fenxi#例题-混合增长率', 'site-c67a92154acd6deb'],
  ['/xingce/ziliao-fenxi#例题-2015-2019-新动能指数', 'site-341b372b64c6da85'],
  ['/xingce/语句排序-先找衔接再验证整体#第15题-历史地理学', 'site-0ab6958f56bae599'],
  ['/xingce/语句排序-先找衔接再验证整体#第18题-地球颜色变化', 'site-24b2bde8648d91be'],
  ['/xingce/语句排序-先找衔接再验证整体#第28题-吃播-与解压', 'site-2b1a7d77420e4672'],
])
const matchedStableMethodUrls = new Set()

// Standalone method pages sometimes contain a worked question or a fragment.
for (const name of fs.readdirSync(path.join(root, 'xingce')).filter((x) => x.endsWith('.md') && x !== '大宝小宝言语体系-正文.md')) {
  const file = 'xingce/' + name, text = read(file), pageAnchors = anchors(file, text), lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (!/^#{2,5}\s*(?:例题|第\d+题)|^\*\*(?:✅\s*)?例题\*\*[：:]/.test(lines[i])) continue
    let body = lines[i]
    if (/^#{2,5}/.test(lines[i])) {
      const next = lines.slice(i + 1).find((line) => line.trim())
      if (next && !/^#{1,5}\s|(?:答案|解析|解答|原卷|首答|用时|复盘)/.test(next)) body += '\n\n' + next
    }
    const stemHtml = render(body)
    const previous = [...pageAnchors.keys()].filter((line) => line <= i).at(-1)
    const url = route(file, pageAnchors.get(i) || pageAnchors.get(previous))
    if (stableMethodExampleIds.has(url)) {
      if (matchedStableMethodUrls.has(url)) throw new Error('方法例题固定锚点重复：' + url)
      matchedStableMethodUrls.add(url)
    }
    const id = stableMethodExampleIds.get(url) || stableId(file + ':' + i)
    const verified = fenbiVerified.find((question) => question.id === id)
    const key = verified && fingerprint(render(verified.stem), verified.options.map((option) => ({ html: inline(option.text) })))
    const sourceNumber = name === '语句排序-先找衔接再验证整体.md' ? lines[i].match(/^###\s*第(15|18|28)题/)?.[1] : ''
    const referenced = sourceNumber && byReviewUrl.get('/cuotiben/言语理解专项复盘-2026-10-17#q' + sourceNumber)
    const linked = referenced || (verified && (entries.find((entry) => entry.quizId === verified.id) || byFingerprint.get(key)))
    if (linked) {
      addAlias(linked, id)
      if (!linked.sources.some((source) => source.url === url)) linked.sources.push({ label: '知识点方法页', url })
    } else {
      add({ id, subject: '行测', status: '题面待整理', title: name.replace(/\.md$/, '') + ' · 例题', source: '知识点方法页', sourceUrl: url, excerpt: textOf(stemHtml).slice(0, 220), search: textOf(stemHtml), stemHtml, options: [] })
    }
    coverage.otherExamples++
  }
}
for (const url of stableMethodExampleIds.keys()) {
  if (!matchedStableMethodUrls.has(url)) throw new Error('方法例题固定锚点缺失：' + url)
}

// Some method pages mention a question without displaying its complete stem.
// Keep its disputed status even after finding the original question.
for (const question of methodReferences) {
  const id = stableId(question.sourceUrl)
  const verified = fenbiVerified.find((row) => row.id === id)
  const stemHtml = render(verified?.stem || question.stem)
  const options = (verified?.options || question.options).map((option) => ({ label:option.label, html:inline(option.text) }))
  const entry = add({ id, subject:'行测', status:question.status, title:question.title,
    source:'知识点方法页', sourceUrl:question.sourceUrl, excerpt:textOf(stemHtml).slice(0, 220),
    search:textOf([stemHtml, ...options.map((option) => option.html)].join(' ')), stemHtml, options })
  if (verified && !entry.sources.some((source) => source.url === verified.sourceUrl)) {
    entry.sources.push({ label:'粉笔参考答案（作答后查看）', url:verified.sourceUrl })
  }
}

// A matching public paper is a lead, not proof of Fenbi's current answer.
// Keep it behind the source link; it does not make an unverified question scored.
for (const candidate of publicCandidates) {
  const item = entries.find((entry) => entry.id === candidate.catalogId || entry.aliases?.includes(candidate.catalogId)
    || entry.sources.some((source) => source.url === candidate.reviewUrl))
  if (!item || item.status === '可自动判分' || item.sources.some((source) => source.url === candidate.sourceUrl)) continue
  const checked = fenbiVerified.some((question) => question.id === candidate.catalogId)
  item.sources.push({
    label: candidate.sourceMatchVerified ? '粉笔检索命中题源（答案待直核）' : (checked ? '公开对照题源' : candidate.knownDisagreement ? '公开候选题源（答案有分歧）' : '公开候选题源（待核）') + ' · 编号 ' + candidate.qid,
    url: candidate.sourceUrl,
  })
}

let matchedDispositions = 0
for (const decision of dispositions) {
  const entry = entries.find((row) => row.id === decision.id || row.aliases?.includes(decision.id))
  if (!entry) throw new Error('题库状态记录未匹配到目录条目：' + decision.id)
  matchedDispositions++
  if (entry.status === '可自动判分') continue
  entry.status = decision.status || entry.status
  if (decision.title) entry.title = decision.title
  if (decision.source) entry.source = decision.source
  if (decision.reviewNote) entry.reviewNote = decision.reviewNote
  if (decision.referenceAnswer) entry.referenceAnswer = decision.referenceAnswer
  if (decision.referenceNote) entry.referenceNote = decision.referenceNote
  if (decision.stem) {
    entry.stemHtml = render(decision.stem)
    entry.options = (decision.options || []).map((option) => ({ label:option.label, html:inline(option.text) }))
    entry.excerpt = textOf(entry.stemHtml).slice(0, 220)
    entry.search = textOf([entry.title, entry.stemHtml, ...entry.options.map((option) => option.html)].join(' '))
  }
  for (const [label, url] of [['粉笔题库检索结果（需直核解析）', decision.sourceUrl], ['题目与粉笔答案转录（公开回忆版）', decision.paperUrl]]) {
    if (url && !entry.sources.some((source) => source.url === url)) entry.sources.push({ label, url })
  }
}
if (matchedDispositions !== dispositions.length) throw new Error('题库状态记录未全部应用')

const summary = Object.fromEntries([...new Set(entries.map((entry) => entry.status))]
  .map((status) => [status, entries.filter((entry) => entry.status === status).length]))
if (coverage.lessonExamples !== lessonParts.matches.length || coverage.reviewReferences !== reviews.length) {
  throw new Error('题目目录覆盖数量不匹配')
}
fs.writeFileSync(path.join(root, 'retest/full-catalog.json'), JSON.stringify({ summary, coverage, entries }, null, 2) + '\n', 'utf8')
const studyRecordMetadata = {
  entries: entries.map(({ id, aliases, legacyUnscoredIds, quizId, subject, status, title, source, sourceUrl, excerpt, sources }) => ({
    id, aliases, legacyUnscoredIds, quizId, subject, status, title, source, sourceUrl, excerpt, sources,
  })),
}
fs.writeFileSync(path.join(root, 'retest/full-catalog-metadata.json'), JSON.stringify(studyRecordMetadata) + '\n', 'utf8')
const studyQuestionMetadata = {
  questions: bank.questions.map(({ id, number, type, module, correct, source, stemHtml, options, materialTitle, materialHtml, reviewUrl, sourceUrl, gradingNote }) => ({
    id, number, type, module, correct, source, stem: textOf(stemHtml),
    options: options.map((option) => ({ label: option.label, text: textOf(option.html) })),
    materialTitle, material: textOf(materialHtml), reviewUrl, sourceUrl, gradingNote,
  })),
}
fs.writeFileSync(path.join(root, 'retest/questions-metadata.json'), JSON.stringify(studyQuestionMetadata) + '\n', 'utf8')

const reviewPriorityTypes = new Set(['错题', '猜题', '不确定', '耗时较长'])
const priorityReviews = reviews.filter((item) => item.types?.some((type) => reviewPriorityTypes.has(type)))
const reviewByUrl = new Map(priorityReviews.map((item) => [item.url, item]))
const scoreableIds = new Set(bank.questions.map((question) => question.id))
const priorityQuestions = new Map()
const mappedReviewUrls = new Set()
for (const entry of entries) {
  if (entry.status !== '可自动判分') continue
  const questionId = scoreableIds.has(entry.id) ? entry.id : entry.aliases?.find((id) => scoreableIds.has(id))
  if (!questionId) continue
  for (const source of entry.sources) {
    const review = reviewByUrl.get(source.url)
    if (!review) continue
    mappedReviewUrls.add(review.url)
    const mapped = priorityQuestions.get(questionId) || { id: questionId, types: [], date: '', reviewUrls: [] }
    for (const type of review.types) if (reviewPriorityTypes.has(type) && !mapped.types.includes(type)) mapped.types.push(type)
    if (review.date && (!mapped.date || review.date < mapped.date)) mapped.date = review.date
    // Recent reviews reopen the practice cycle, whether the question is new,
    // explicitly linked to an older ID, or matched through an existing source.
    if (/^\d{4}-\d{2}-\d{2}$/.test(review.date || '')
        && (review.date >= '2026-11-23' || existingReviewLinks.has(review.url))
        && (!mapped.reenteredReviewDate || review.date > mapped.reenteredReviewDate)) {
      mapped.reenteredReviewDate = review.date
    }
    if (!mapped.reviewUrls.includes(review.url)) mapped.reviewUrls.push(review.url)
    priorityQuestions.set(questionId, mapped)
  }
}
const unavailableReviews = priorityReviews.filter((item) => !mappedReviewUrls.has(item.url)).map((item) => {
  const entry = entries.find((candidate) => candidate.sources.some((source) => source.url === item.url))
  return { id: item.id, title: item.title, types: item.types, date: item.date, url: item.url, status: entry?.status || '未进入自动判分题库' }
})
const priorityIndex = {
  sourceRecords: priorityReviews.length,
  mappedRecords: mappedReviewUrls.size,
  unavailableReviews,
  questions: [...priorityQuestions.values()].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)),
}
fs.writeFileSync(path.join(root, 'retest/review-priority.json'), JSON.stringify(priorityIndex, null, 2) + '\n', 'utf8')
console.log('全站题库目录：' + entries.length + ' 条；' + JSON.stringify(summary) + '；来源覆盖 ' + JSON.stringify(coverage))
console.log('历史优先复测：' + priorityIndex.mappedRecords + '/' + priorityIndex.sourceRecords + ' 条进入自动判分题库；' + unavailableReviews.length + ' 条仍待完善')
