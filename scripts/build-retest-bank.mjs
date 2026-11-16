import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { createMarkdownRenderer } from 'vitepress'

// Historical records remain unchanged; only traceable, complete questions
// with a documented reference answer are exported.
const root = process.cwd()
const output = path.join(root, 'retest/questions.json')
const md = await createMarkdownRenderer(root, { html: true, math: true }, '/')
const questions = []
const skipped = []
const fingerprints = new Map()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n')
const clean = (value) => value.replace(/<\/?mark\b[^>]*>/gi, '').trim()
const html = (value) => md.render(clean(value)).trim()
const inline = (value) => md.renderInline(clean(value)).trim()
const fail = (page, number, reason) => skipped.push({ page, number: String(number), reason })
const displaySource = (value) => value
  .replace(/(?:平台|题库)参考(?:答案)?[：:\s]*[A-D][^。]*。?/g, '')
  .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim()
const catalog = JSON.parse(read('cuotiben/review-catalog.json'))
const recovered = new Map(JSON.parse(read('retest/recovered-sources.json')).records
  .map((record) => [record.number, record]))
const legacy135 = new Set(catalog.filter((item) => item.url.includes('135题混合真题批改'))
  .map((item) => Number(item.url.match(/#q(\d+)/)?.[1])).filter(Number.isFinite))

function assetsExist(content) {
  const refs = [...content.matchAll(/\b(?:src|srcset)=["']([^"']+)["']/gi)]
  return refs.every((match) => {
    const url = match[1].split(',')[0].trim().split(/\s+/)[0]
    if (!url.startsWith('/') || url.startsWith('//')) return true
    const relative = decodeURI(url).replace(/^\/xuexi-notes\//, '/').replace(/^\//, '')
    return fs.existsSync(path.join(root, 'public', relative))
  })
}

function add(q, page) {
  if (!q.correct || !/^[A-D]$/.test(q.correct) || q.options.length !== 4
      || q.options.map((option) => option.label).join('') !== 'ABCD' || !q.stemHtml.trim()) {
    fail(page, q.number, '题干、选项或参考答案不完整')
    return
  }
  if (!assetsExist([q.stemHtml, q.materialHtml, ...q.options.map((o) => o.html)].join('\n'))) {
    fail(page, q.number, '题图或材料图片缺失')
    return
  }
  const normalized = [q.stemHtml, ...q.options.map((o) => o.html)]
    .join('').replace(/<[^>]*>/g, '').replace(/[\s\u00a0\p{P}\p{S}]/gu, '').slice(0, 600)
  const imageRefs = [...q.stemHtml.matchAll(/<img\b[^>]*src=["']([^"']+)/gi)].map((m) => m[1]).join('|')
  const fingerprint = crypto.createHash('sha256').update(normalized + imageRefs).digest('hex')
  if (fingerprints.has(fingerprint)) {
    if (page === 'retest/fenbi-verified.json') {
      const previous = questions.find((item) => item.id === fingerprints.get(fingerprint))
      if (previous && previous.correct !== q.correct) {
        throw new Error('粉笔答案与既有题库不一致，请核对题面和选项后再发布：' + q.number)
      }
    }
    fail(page, q.number, '与已收录题目重复')
    return
  }
  fingerprints.set(fingerprint, q.id)
  questions.push(q)
}

function typeFor135(number) {
  if (number <= 10) return '政治理论'
  if (number <= 20) return '常识判断'
  if (number <= 50) return '言语理解'
  if (number <= 70) return '数量关系'
  if (number <= 115) return '判断推理'
  return '资料分析'
}

// The 135-question paper has original figures and a separately archived
// answer table. Keep the prototype's IDs so old browser records still match.
const paperFile = 'daily-quizzes/2026-11-07-xingce-135.md'
const paper = read(paperFile)
const review = read('daily-quizzes/2026-11-07-xingce-135-review.md')
const keyPart = review.split('## 完整答案核对')[1]?.split('## 按模块核对题号')[0] || ''
const answerRows = [...keyPart.matchAll(/^\|\s*(\d+)[—–-](\d+)\s*\|\s*[A-D]+\s*\|\s*([A-D]+)\s*\|/gm)]
const answerKey = new Map()
for (const row of answerRows) {
  const first = Number(row[1])
  if (Number(row[2]) - first + 1 !== row[3].length) throw new Error('135题答案表数量不匹配')
  ;[...row[3]].forEach((letter, index) => answerKey.set(first + index, letter))
}
if (answerKey.size !== 135) throw new Error('135题答案表未完整识别')
const materials = new Map()
for (const match of paper.matchAll(/^### 阅读材料（第(\d+)[—–-](\d+)题）\n([\s\S]*?)(?=^### 第\d+题)/gm)) {
  const content = clean(match[3])
  for (let number = +match[1]; number <= +match[2]; number++) {
    materials.set(number, { title: '第' + match[1] + '—' + match[2] + '题共用材料', html: content })
  }
}
for (const match of paper.matchAll(/^### 第(\d+)题\s*\{#q\d+\}\n([\s\S]*?)(?=^### (?:第\d+题|阅读材料)|^## |$(?![\s\S]))/gm)) {
  const number = +match[1]
  const block = match[2]
  const start = block.indexOf('<div class="exam-question">')
  const provenance = block.match(/<p class="exam-provenance">([^<]+)<\/p>/)
  if (start < 0 || !provenance) {
    fail(paperFile, number, '缺少来源或原题')
    continue
  }
  const content = clean(block.slice(block.indexOf('>', start) + 1, block.indexOf('<p class="exam-provenance">', start)))
  const choices = [...content.matchAll(/<div class="exam-option">\s*<strong>([A-D])\.<\/strong>\s*([\s\S]*?)<\/div>/g)]
  const imageChoices = /选项\s*A、B、C、D\s*见原图/.test(content) && /<img\b/i.test(content)
  if (choices.length !== 4 && !imageChoices) {
    fail(paperFile, number, '原题选项不完整')
    continue
  }
  const stemHtml = content.replace(/<div class="exam-option">\s*<strong>[A-D]\.<\/strong>\s*[\s\S]*?<\/div>/g, '').trim()
  const material = materials.get(number)
  if (((number >= 46 && number <= 50) || number >= 111) && !material) {
    fail(paperFile, number, '共用材料缺失')
    continue
  }
  const type = typeFor135(number)
  add({
    id: 'q' + number, number, type, module: type, correct: answerKey.get(number),
    source: provenance[1].trim(),
    stemHtml,
    options: choices.length === 4 ? choices.map((m) => ({ label: m[1], html: m[2].trim() }))
      : ['A', 'B', 'C', 'D'].map((label) => ({ label, html: '' })),
    materialTitle: material?.title || '', materialHtml: material?.html || '',
    reviewUrl: legacy135.has(number)
      ? '/cuotiben/135题混合真题批改-2026-11-07#q' + number
      : '/daily-quizzes/2026-11-07-xingce-135#q' + number,
    sourceUrl: number === 35 ? 'https://www.fenbi.com/spa/tiku/guide/question/search?q=%E6%B0%94%E6%BA%B6%E8%83%B6%E5%92%8C%E6%82%AC%E6%B5%AE%E9%A2%97%E7%B2%92&courseSet=xingce&course=xingce&qType=1'
      : number === 96 ? 'https://www.huatu.com/2026/0314/2854050.html' : '',
    gradingNote: number === 35 ? '本题按粉笔回忆版参考 B 判分；其他机构有 D 的解析，且不同回忆版存在“质疑／制约”的文字差异。该参考不等同官方答案。'
      : number === 96 ? '华图对相同的“成虫”回忆版参考 A，并讨论了其他关系可能带来的争议；不同回忆资料的文字仍有差异。' : '',
    origin: '综合真题卷',
  }, paperFile)
}

function parseOptions(text) {
  const lines = text.split('\n')
  const matches = []
  const optionRe = /^\s*(?:>\s*)?(?:[-*]\s*)?(?:\*\*)?([A-D])(?:[．.、)）:]|\*\*(?:[．.、)）:]|\s)|\s|$)(?:\*\*)?\s*(.*)$/
  for (let index = 0; index < lines.length; index++) {
    const match = lines[index].match(optionRe)
    if (!match) continue
    matches.push({ label: match[1], index, text: match[2] })
  }
  if (matches.length !== 4 || matches.map((item) => item.label).join('') !== 'ABCD') return null
  const options = matches.map((item, index) => {
    const rest = lines.slice(item.index + 1, matches[index + 1]?.index ?? lines.length).join('\n').trim()
    return { label: item.label, html: rest ? html(item.text + '\n\n' + rest) : inline(item.text) }
  })
  return { options, stem: lines.slice(0, matches[0].index).join('\n').trim() }
}

function sourceLine(block) {
  return block.split('\n').map((line) => line.replace(/\*\*/g, '').trim())
    .find((line) => /^(?:题源(?:（平台标注）)?|来源)[：:]/.test(line)
      && /(?:19|20)\d{2}年/.test(line)
      && /公务员|国考|省考|市考|区考|联考|事业单位|选调生|公安机关人民警察专项录用考试/.test(line)
      && !/自编|模拟|未查明|未知/.test(line)) || ''
}

function answerFrom(block, source) {
  const sourceAnswer = source.match(/(?:平台|题库)?参考(?:答案)?[：:\s]*([A-D])\b/)
  const platformAnswer = block.match(/平台答案[：:\s]*([A-D])\b/)
  const statusAnswer = block.match(/(?:首答|原答|原卷)[^\n]{0,35}(?:→\s*(?:平台答案|答案|参考)?|参考|(?:平台)?答案)[：:\s]*([A-D])\b/)
  const answer = sourceAnswer?.[1] || platformAnswer?.[1] || statusAnswer?.[1]
  const recognized = [sourceAnswer?.[1], platformAnswer?.[1], statusAnswer?.[1]].filter(Boolean)
  return recognized.every((item) => item === answer) ? answer : ''
}

function extractOriginal(block) {
  let question = block.match(/<summary>[^<]*(?:原题|全部选项)[^<]*<\/summary>\s*([\s\S]*?)<\/details>/)?.[1]
  if (!question) question = block.match(/^### 原题(?:与全部选项|与选项|和选项)[^\n]*\n([\s\S]*?)(?=^### |^<BreakPointCard\b|^题源(?:（平台标注）)?[：:]|$(?![\s\S]))/m)?.[1]
  if (!question) question = block.match(/^\*\*(?:完整原题与选项|题目回顾)\*\*[：:]?\s*\n([\s\S]*?)(?=^<BreakPointCard\b|^### |$(?![\s\S]))/m)?.[1]
  if (!question) return null
  question = question.replace(/^(?:题源(?:（平台标注）)?|来源)[：:][^\n]*$/gm, '')
    .replace(/\n\*\*复盘状态\*\*[\s\S]*/, '')
    .replace(/ {2,}(?=[B-D][.．]\s*)/g, '\n').trim()
  const choices = parseOptions(question)
  if (!choices && /A、B、C、D选项见原图/.test(question) && /<img\b/.test(question)) {
    return { stemHtml: html(question), options: ['A', 'B', 'C', 'D'].map((label) => ({ label, html: '' })) }
  }
  if (!choices || !choices.stem) return null
  return { stemHtml: html(choices.stem), options: choices.options }
}

const seenReview = new Set()
const reviewEntries = [...catalog]
for (const filename of fs.readdirSync(path.join(root, 'cuotiben'))) {
  if (!filename.endsWith('.md') || filename.includes('135题混合真题')) continue
  const text = read('cuotiben/' + filename)
  const type = filename.match(/(政治理论|常识判断|言语理解|数量关系|图形推理|逻辑判断|定义判断|类比推理|资料分析)/)?.[1]
  if (!type) continue
  for (const heading of text.matchAll(/^## [^\n]*\{#(q\d+)\}/gm)) {
    reviewEntries.push({ url: '/cuotiben/' + filename.slice(0, -3) + '#' + heading[1], module: type })
  }
}
for (const item of reviewEntries) {
  const [urlPath, anchor] = item.url.split('#')
  if (!anchor || !/^q\d+$/.test(anchor) || urlPath.includes('135题混合真题')) continue
  const file = urlPath.replace(/^\//, '') + '.md'
  if (!fs.existsSync(path.join(root, file))) continue
  const identity = file + '#' + anchor
  if (seenReview.has(identity)) continue
  seenReview.add(identity)
  const text = read(file)
  const heading = new RegExp('^## [^\\n]*\\{#' + anchor + '\\}[^\\n]*\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))', 'm')
  const block = text.match(heading)?.[1]
  if (!block) {
    fail(file, anchor, '题目结构待整理')
    continue
  }
  if (/原始材料有[^\n]*坏字|原题[^\n]*(?:缺字|不完整)/.test(block)) {
    fail(file, anchor, '原题文字待补全')
    continue
  }
  const backup = file.includes('言语理解专项复盘-2026-10-17')
    ? recovered.get(Number(anchor.slice(1))) : null
  const source = sourceLine(block) || (backup ? '题源（平台标注）：' + backup.source : '')
  const pageAnswer = answerFrom(block, source)
  const answer = backup ? (pageAnswer && pageAnswer !== backup.answer ? '' : backup.answer) : pageAnswer
  let question = extractOriginal(block)
  // Some figure questions show all four choices in the original image.
  if (!question && file.includes('图形推理专项复盘-2026-10-21')) {
    const imageQuestion = block.match(/^\*\*[^*\n]*(?:原答|平台答案)[^*\n]*\*\*\s*\n([\s\S]*?)(?=^<BreakPointCard\b)/m)?.[1]
    if (imageQuestion && /<img\b[^>]*alt="[^"]*(?:原图|原题)[^"]*(?:选项|图形)/.test(imageQuestion)) {
      const line = imageQuestion.split('\n').find((s) => /^A[．.].*B[．.].*C[．.].*D[．.]/.test(s))
      const choiceMatches = line ? [...line.matchAll(/([A-D])[．.]\s*(.*?)(?=\s+[A-D][．.]|$)/g)] : []
      question = {
        stemHtml: html(line ? imageQuestion.replace(line, '') : imageQuestion),
        options: choiceMatches.length === 4
          ? choiceMatches.map((choice) => ({ label: choice[1], html: inline(choice[2]) }))
          : ['A', 'B', 'C', 'D'].map((label) => ({ label, html: '' })),
      }
    }
  }
  if (file.includes('图形推理专项复盘-2026-10-21') && anchor === 'q1') {
    fail(file, anchor, '答案存在分歧')
    continue
  }
  if (/自编模拟/.test(block)) {
    fail(file, anchor, '历史自编题不进入真题复测')
    continue
  }
  if (!source || !answer || !question) {
    fail(file, anchor, !source ? '真题来源待核' : !answer ? '参考答案待核' : '题面或选项待整理')
    continue
  }
  let material = ''
  let materialTitle = ''
  const materialNumber = source.match(/材料见上方(\d+)号材料/)?.[1]
  if (materialNumber) {
    const re = new RegExp('^### 材料' + materialNumber + '[^\\n]*\\n([\\s\\S]*?)(?=^### 材料\\d+|^## 第\\d+题)', 'm')
    const materialMatch = text.match(re)
    if (!materialMatch) {
      fail(file, anchor, '共用材料待核')
      continue
    }
    material = html(materialMatch[1])
    materialTitle = '原题材料 ' + materialNumber
  } else if (/材料见|根据以下材料|根据上述材料|根据下列资料|根据以下资料/.test(question.stemHtml)) {
    fail(file, anchor, '共用材料待核')
    continue
  }
  const module = ['图形推理', '逻辑判断', '定义判断', '类比推理'].includes(item.module) ? '判断推理' : item.module
  add({
    id: 'review-' + crypto.createHash('sha256').update(identity).digest('hex').slice(0, 16),
    number: Number(anchor.slice(1)), type: item.module, module, correct: answer,
    source: displaySource(source),
    ...question, materialTitle, materialHtml: material, reviewUrl: item.url,
    sourceUrl: file.includes('每日测验复盘-2026-11-06') && anchor === 'q2'
      ? 'https://www.xingguanggongkao.com/Wb/quesView/id/50610.html' : '',
    gradingNote: file.includes('每日测验复盘-2026-11-06') && anchor === 'q2'
      ? '星光公考及其他题库参考 B；被转载的来源文章也使用“名副其实、映照”。题库参考不等同官方公布答案。' : '',
    origin: '历史错题与复盘',
  }, file)
}

// Historic reviews whose complete source paper has been matched separately.
const verifiedJiangsu = [
  ...JSON.parse(read('retest/jiangsu-matches.json')).questions,
  ...JSON.parse(read('retest/resolved-matches.json')).questions,
]
for (const item of verifiedJiangsu) {
  if (item.id === 'jiangsu-2021-2742078') {
    fail('retest/jiangsu-matches.json', item.number, '不同题库参考答案存在分歧')
    continue
  }
  add({
    id: item.id, number: item.number, type: '言语理解', module: '言语理解',
    source: item.source, sourceUrl: item.sourceUrl, correct: item.correct,
    gradingNote: item.gradingNote || '',
    stemHtml: html(item.stem),
    options: item.options.map((option) => ({ label: option.label, html: inline(option.text) })),
    materialTitle: item.material ? '原题共用材料' : '',
    materialHtml: item.material ? html(item.material) : '',
    reviewUrl: item.reviewUrl, origin: '历史错题与复盘',
  }, 'retest/jiangsu-matches.json')
}

function addVerifiedLesson(item, page) {
  const isReview = item.reviewUrl?.startsWith('/cuotiben/')
  const material = item.material
    ? item.material.replace(/^<p>(?=<p>)/, '').replace(/<\/p>\s*$/, '')
    : ''
  add({
    id: item.id, number: item.number, type: isReview ? '错题复盘' : '知识点例题', module: item.module || '言语理解',
    source: item.source, sourceUrl: item.sourceUrl, correct: item.correct,
    gradingNote: item.gradingNote || '',
    stemHtml: html(item.stem),
    options: item.options.map((option) => ({ label: option.label, html: inline(option.text) })),
    materialTitle: material ? '阅读材料' : '', materialHtml: material ? html(material) : '',
    reviewUrl: item.reviewUrl, origin: isReview ? '历史错题与复盘' : '知识点例题',
  }, page)
}
for (const item of JSON.parse(read('retest/knowledge-source-matches.json')).questions) {
  addVerifiedLesson(item, 'retest/knowledge-source-matches.json')
}

const lessonFile = 'xingce/大宝小宝言语体系-正文.md'
const lesson = read(lessonFile)
const examples = [...lesson.matchAll(/^#{4,5}\s+例\s*(\d+\.\d+)[^\n]*\n/gm)]
for (let index = 0; index < examples.length; index++) {
  const current = examples[index]
  const block = lesson.slice(current.index + current[0].length, examples[index + 1]?.index ?? lesson.length)
  const tag = block.match(/^> 🏷️ 出处：([^\n]+)/m)
  if (!tag) continue
  const line = tag[1]
  if (!/(?:19|20)\d{2}\s*年/.test(line) || !/国考|省考|市考|公务员|多省联考|事业单位/.test(line)
      || /未查明|模拟|真题答案：[A-D]{2}/.test(line)) {
    fail(lessonFile, current[1], '例题来源或题型待核')
    continue
  }
  const beforeTag = block.slice(0, tag.index)
  const afterTag = block.slice(tag.index + tag[0].length).split(/\n(?=#{2,5}\s)/)[0]
  if (/⚠️[^\n]*(?:讲义|真题|答案|选项|问法|对调|次序)|答案存疑|参考答案有争议/.test(afterTag)) {
    fail(lessonFile, current[1], '例题问法或答案待核')
    continue
  }
  const answer = line.match(/真题答案：([A-D])(?:\b|（)/)?.[1]
  const choices = parseOptions(beforeTag)
  if (!answer || !choices || !choices.stem || choices.stem.includes('<')) {
    fail(lessonFile, current[1], '例题题面或答案待核')
    continue
  }
  const stem = choices.stem.replace(/^>\s?/gm, '').trim()
  add({
    id: 'lesson-' + crypto.createHash('sha256').update(line + stem).digest('hex').slice(0, 16),
    number: '例 ' + current[1], type: '知识点例题',
    module: '言语理解', correct: answer,
    source: line.split('｜')[0].trim() + '（讲义题源标注，参考答案来自题库）',
    stemHtml: html(stem), options: choices.options, materialTitle: '', materialHtml: '',
    reviewUrl: '/xingce/大宝小宝言语体系-正文', origin: '知识点例题',
  }, lessonFile)
}

// Preserve IDs already used by browser records; new matches follow existing imports.
for (const item of JSON.parse(read('retest/lesson-source-matches.json')).questions) {
  addVerifiedLesson(item, 'retest/lesson-source-matches.json')
}
for (const item of JSON.parse(read('retest/recovered-lesson-fragments.json')).questions) {
  addVerifiedLesson(item, 'retest/recovered-lesson-fragments.json')
}
for (const item of JSON.parse(read('retest/fenbi-verified.json')).questions) {
  if (item.automaticGrading === false) continue
  addVerifiedLesson(item, 'retest/fenbi-verified.json')
}

const origins = Object.fromEntries([...new Set(questions.map((q) => q.origin))]
  .map((name) => [name, questions.filter((q) => q.origin === name).length]))
if (questions.length < 20) throw new Error('题库只有 ' + questions.length + ' 题，未生成')
fs.writeFileSync(output, JSON.stringify({
  imported: questions.length, origins, skippedCount: skipped.length, excluded: skipped, questions,
}, null, 2) + '\n', 'utf8')
console.log('已导入 ' + questions.length + ' 题：' + JSON.stringify(origins) + '；' + skipped.length + ' 条重复或待核。')
console.log('已写入 ' + path.relative(root, output))
