// 题目三色高亮批量标注引擎。
// 读取 data/question-ledger.json，只对「题干无任何高亮」的题块，在题干段落内插入
// <mark class="rv-object">（对象/范围，蓝）、rv-period（时间/条件/转折/陷阱词，橙）、
// rv-target（问题/要求，绿）三类高亮。原文零删除：只包裹标签，不改任何字符。
//
// 安全设计：
//  - 默认 dry-run，只有 --apply 才写文件；写前把原文件备份到 .workbuddy/backup/question-annotate/
//  - 写入后自动校验：剥离三类 mark 标签后与原文件逐行比对，任何字符差异即回滚该文件并报错
//  - 支持 --file <路径> 只处理单文件、--limit N 限量，便于分批验证
//
// 用法：
//   node scripts/annotate-questions.mjs                      # dry-run 全部
//   node scripts/annotate-questions.mjs --file daily-quizzes/2026-11-05.md
//   node scripts/annotate-questions.mjs --apply --file ...
//   node scripts/annotate-questions.mjs --apply              # 全量应用
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const argv = process.argv.slice(2)
const APPLY = argv.includes('--apply')
const LIMIT = (() => {
  const i = argv.indexOf('--limit')
  return i >= 0 ? parseInt(argv[i + 1], 10) : Infinity
})()
const FILE = (() => {
  const i = argv.indexOf('--file')
  return i >= 0 ? argv[i + 1] : null
})()

const ledger = JSON.parse(fs.readFileSync(path.join(root, 'data/question-ledger.json'), 'utf8'))
const BACKUP = path.join(root, '.workbuddy/backup/question-annotate')

// ---------- 高亮规则（高置信度） ----------

// 绿：问法/要求——整句固定句式，命中即整句标绿
const TARGET_PATTERNS = [
  /(?:根据|从|结合)(?:上述|这段|以上|给定|材料)(?:文字|材料|资料)?[，,]?\s*(?:下列|以下)?[^。？\n]{0,40}(?:正确|错误|最恰当|最符合|最能|不属于|属于|可以推出|无法推出|强调|主要说明|意在|主旨|概括)[^。？\n]{0,20}[。？]?/,
  /(?:下列|以下)[^。？\n]{0,30}(?:说法|理解|表述|判断|选项)[^。？\n]{0,20}(?:正确|错误|不正确|符合|不符合|恰当|准确)[^。？\n]{0,12}[。？]?/,
  /依次填入(?:画横线部分|括号处|横线处)?[^。？\n]{0,20}(?:最恰当|最合适|正确)?[^。？\n]{0,8}[。？]?/,
  /最适合(?:做)?[^。？\n]{0,20}(?:标题|概括|选项)[^。？\n]{0,12}[。？]?/,
  /将以上\s*\d+\s*个句子重新排列[^。？\n]{0,20}[。？]?/,
  /(?:这段文字|上文|文段)(?:主要|意在|强调|说明|讲述|介绍)[^。？\n]{0,30}[。？]?/,
  /(?:以下哪项|下列哪项)[^。？\n]{0,40}(?:如果为真|最能|最能说明|可以|无法|是)[^。？\n]{0,20}[。？]?/,
  /(?:问|求|则|那么)[^。？\n]{0,30}(?:是|为|多少|几|之比|分别是)[^。？\n]{0,12}[。？]?/,
  /(?:关于|针对)[^。？\n]{0,30}(?:下列|以下)[^。？\n]{0,20}(?:正确|错误|准确|符合)[^。？\n]{0,10}[。？]?/,
  /(?:请|试|要求)[^。？\n]{0,30}(?:概括|分析|提出|指出|说明|归纳|拟写|撰写)[^。？\n]{0,20}[。？]?/,
  /(?:下列说法|以下说法)[^。？\n]{0,30}[。？]?/,
  /(?:填入|补写)[^。？\n]{0,30}(?:最恰当|最合适|正确)?[^。？\n]{0,8}[。？]?/,
]

// 橙：时间/条件/转折/陷阱词——高置信度关键词与结构
// 橙色：只标「高置信度的命题机关词块」，宁少勿滥。
// 单字虚词（都/却/也/就/还）不单独成标，避免满篇噪声；
// 多字转折/条件/程度/时间词才标，且要求是完整词块。
const PERIOD_PATTERNS = [
  // 转折/让步（完整词块）
  /但是|然而|不过|虽然|尽管|即使|固然|反而|相反|事实上|实际上|其实|换言之|与此同时|另一方面|更重要的是|尤其是/,
  // 条件（完整词块）
  /如果|倘若|假如|只有|只要|除非|一旦|必须|必然|一定会|必要条件|充分条件/,
  // 范围/程度（扩大缩小陷阱，完整词块）
  /全部|所有|任何|唯一|仅仅|只是|完全|绝对|一定|从不|绝不|无一例外|无一不是|并非|并不是|未必|可能|或许|大概|预计|有望|至少|至多|超过|不足/,
  // 时间/数据条件（完整词块）
  /\d{4}年|\d{1,2}月|\d{1,2}日|第[一二三四五六七八九十\d]+(?:季度|期|次|阶段|天|年)|同比|环比|较上年|比上年|增长率|增长量|下降率|下降量|增速|比重|占比|年均增长|翻一番/,
  // 顺序/比较（完整词块）
  /首先|其次|最后|之前|之后|以前|以后|此前|随后|最终|截至|截止|目前|当前|现阶段|先后|依次/,
]

// 蓝：对象/范围——保守策略，只标明显的"指向性名词短语"
// 用「的」字结构 + 引号强调 + 反复出现的核心名词，宁可少标不乱标
const OBJECT_PATTERNS = [
  // 引号强调的对象
  /[“"][^”"]{2,16}[”"]/g,
  // 学科/领域/主体名词（作为定位锚点）
  /(?:本文|文段|文章|材料|文段中|文中|题干|原文)(?:的)?[^，。；\n]{0,12}/,
]

// ---------- 工具函数 ----------

// 选项行识别：覆盖实际全部格式
//   - **A**. ②①④⑥⑤③      （列表 + 粗体 + 点）
//   - **A．** 扭曲 限制
//   - **A.** 扭曲
//   **A**．扭曲
//   A. 除了酪氨酸酶 / A 369万件 / A．5：2
//   <div class="exam-option">
function isMarkdownOptionLine(line) {
  const t = line.trim()
  if (/<div class="exam-option"/.test(t)) return true
  // 去掉列表前缀与粗体标记后，看是否以「A-D + 分隔符」开头
  const bare = t
    .replace(/^[-*]\s+/, '')
    .replace(/\*\*/g, '')
    .trim()
  return /^[（(]?[A-D][）)]?\s*[.．、:：]\s*\S/.test(bare) || /^[A-D]\s+[0-9０-９]/.test(bare) || /^[A-D]\s*$/.test(bare)
}
function isHtmlOptionLine(line) {
  return /<div class="exam-option"/.test(line)
}
function isMetaLine(t) {
  return (
    /^(来源[：:]|题源[：:]|题源见|题源[:：]|\[题源\])/.test(t) ||
    /^<a class="compact-flow/.test(t) ||
    /^图解(?:依据|根据|见)/.test(t) ||
    /^\*\*复盘类型/.test(t) ||
    /^\*\*(?:原卷|原答|答对|首答|参考|得分|正确率|用时|未作答)/.test(t) ||
    /^\*\*(?:错题|不确定|答对|答错|未答)/.test(t) ||
    /^\*\*(?:本人思路|最终|讨论|易错|知识点|记录|题源|来源|难度|掌握)/.test(t) ||
    /^<\/?(?:details|summary|p|div|figure)/.test(t) ||
    /^\|.*\|$/.test(t) || // 表格行（题干很少是表格；材料题另说）
    /^#+\s/.test(t) ||
    /^>\s/.test(t) ||
    // 列表项：排除选项行（选项已由 isMarkdownOptionLine 先行拦截）、排除 ①②③ 与数字编号的题干句子
    (/^[-*]\s+/.test(t) && !/^[-*]\s+\d/.test(t) && !isMarkdownOptionLine(t))
  )
}

// 定位题干行的起止（返回 0-based 索引，相对文件所有行）
function locateStem(lines, headLine, nextLine) {
  const start = headLine // headLine 为 0-based 标题行索引
  const end = nextLine >= 0 ? nextLine : lines.length
  let s = -1
  let e = -1
  for (let i = start + 1; i < end; i++) {
    const raw = lines[i]
    const t = raw.trim()
    if (!t) continue
    if (isHtmlOptionLine(raw) || isMarkdownOptionLine(raw)) break
    if (/^\s*(?:A|B|C|D)\s*[.．、]\s*\S/.test(raw)) break
    if (/^\*\*(?:本人思路|最终|讨论|易错|知识点|记录|题源|来源|答案|解析)/.test(t)) break
    if (/^###?\s*(?:本人|最终|讨论|易错|解析|参考|答案|题源)/.test(t)) break
    if (isMetaLine(t)) continue
    if (s < 0) s = i
    e = i
  }
  return { s, e }
}

// 在一段纯文本里做三色标注；返回 { html, groups }，groups 记录每类命中数
function annotateText(text) {
  if (!text || text.length < 12) return { html: text, groups: { target: 0, period: 0, object: 0 } }
  const groups = { target: 0, period: 0, object: 0 }
  // 保护已有标签
  if (/<mark|<\/?span|<\/?a\s|<\/?strong|<\/?em|<\/?br/.test(text)) return { html: text, groups, skipped: '含HTML标签' }

  let out = text

  // 1) 绿：问法整句（最高优先），用占位符保护
  const targets = []
  out = out.replace(new RegExp(TARGET_PATTERNS.map((r) => `(${r.source})`).join('|'), 'g'), (m) => {
    if (!m.trim()) return m
    const key = `\u0000T${targets.length}\u0000`
    targets.push(m)
    groups.target++
    return key
  })

  // 2) 橙：条件/时间/转折/陷阱词（避免与绿色占位符冲突）
  const periods = []
  out = out.replace(new RegExp(PERIOD_PATTERNS.map((r) => `(${r.source})`).join('|'), 'g'), (m) => {
    if (!m.trim()) return m
    const key = `\u0000P${periods.length}\u0000`
    periods.push(m)
    groups.period++
    return key
  })

  // 3) 蓝：引号对象（保守）
  const objects = []
  out = out.replace(OBJECT_PATTERNS[0], (m) => {
    const key = `\u0000O${objects.length}\u0000`
    objects.push(m)
    groups.object++
    return key
  })

  // 还原占位符：一次遍历，按类型分派到对应数组，避免误用其它类型的数组
  const pools = { T: { arr: targets, cls: 'target' }, P: { arr: periods, cls: 'period' }, O: { arr: objects, cls: 'object' } }
  out = out.replace(/\u0000([TPO])(\d+)\u0000/g, (m, type, idx) => {
    const pool = pools[type]
    const val = pool.arr[+idx]
    if (val === undefined) return '' // 理论上不会发生；一旦发生宁可丢弃占位符也不污染正文
    return `<mark class="rv-${pool.cls}">${val}</mark>`
  })

  return { html: out, groups }
}

// 整个题块的题干定位 + 高亮
// headIdx: 0-based 标题行；内部自动向后寻找下一个同级/更高级标题作为题块边界，
// 不依赖台账行号，因此多次插入 mark 造成的行号偏移不会影响定位。
function annotateBlock(lines, headIdx, nextIdx) {
  let blockEnd = lines.length
  for (let i = headIdx + 1; i < lines.length; i++) {
    if (/^#{1,3}\s/.test(lines[i])) { blockEnd = i; break }
  }
  const { s, e } = locateStem(lines, headIdx, blockEnd)
  if (s < 0 || e < s) return { lines, hit: false, reason: '未定位到题干' }
  // 题干可能跨多行，逐行标注（每行独立，避免跨行正则误伤）
  const before = lines.slice(s, e + 1)
  const joined = before.join('\n')
  if (/<mark\s/.test(joined)) return { lines, hit: false, reason: '题干已有高亮' }
  // 只在"看起来是题干"的行上标注：排除纯数字/符号行
  const marked = []
  const groups = { target: 0, period: 0, object: 0 }
  for (const line of before) {
    const t = line.trim()
    if (!t || t.length < 8 || /^[\d\s.．、①②③④⑤⑥⑦]+$/.test(t)) {
      marked.push(line)
      continue
    }
    // 题干行：以句号/问号/分号结尾的段落，或句子编号行（①②③）
    const r = annotateText(line)
    marked.push(r.html)
    groups.target += r.groups.target
    groups.period += r.groups.period
    groups.object += r.groups.object
  }
  if (groups.target + groups.period + groups.object === 0) return { lines, hit: false, reason: '规则未命中' }
  const out = lines.slice()
  out.splice(s, e - s + 1, ...marked)
  return { lines: out, hit: true, groups, line: s }
}

// ---------- 主流程 ----------

const targets = ledger.questions.filter((q) => {
  if (q.file === FILE) return q.needMarks
  if (FILE) return false
  return q.needMarks
})
// 按文件分组，并给每个文件建立「下一题行号」边界，避免题干定位扫到后续题目
const byFileQuestion = new Map()
for (const q of targets) {
  if (!byFileQuestion.has(q.file)) byFileQuestion.set(q.file, [])
  byFileQuestion.get(q.file).push(q)
}
for (const arr of byFileQuestion.values()) arr.sort((a, b) => a.line - b.line)

const byFile = new Map()
let processed = 0
let hit = 0
let skipped = 0
const failures = []

for (const [file, qs] of byFileQuestion) {
  const text = fs.readFileSync(path.join(root, file), 'utf8')
  const fileName = file.replace(/[\\/]/g, '-')
  const rec = { orig: text, lines: text.split('\n'), edits: [], report: [] }
  byFile.set(file, rec)

  // 倒序处理：从文件末尾往前改，前面的题块行号不会因插入 mark 标签而偏移。
  // 每道题独占一段行区间，倒序保证后续定位仍指向原始行号。
  for (let idx = qs.length - 1; idx >= 0; idx--) {
    if (processed >= LIMIT) break
    const q = qs[idx]
    const prevQ = qs[idx - 1]
    // q.line 是 1-based 标题行；annotateBlock 需要 0-based 的标题与下一题边界。
    // 倒序时用「上一题标题行」作为本题的下界（即本题题块结束处）。
    const headIdx0 = q.line - 1
    const nextIdx0 = prevQ ? prevQ.line - 1 : rec.lines.length
    const res = annotateBlock(rec.lines, headIdx0, nextIdx0)
    if (res.hit) {
      rec.lines = res.lines
      rec.edits.push({ q: q.no, line: res.line + 1, groups: res.groups })
      hit++
    } else {
      skipped++
    }
    rec.report.push({ q: q.no, line: q.line, hit: res.hit, reason: res.reason || '', groups: res.groups || {} })
    processed++
  }
  // 输出 dry-run 报告
  const repPath = path.join(root, 'data/annotate-report', fileName + '.json')
  fs.mkdirSync(path.dirname(repPath), { recursive: true })
  fs.writeFileSync(repPath, JSON.stringify(rec.report, null, 2))
}

// 校验 + 输出
const stripMark = (s) => s.replace(/<\/?mark[^>]*>/g, '')
let filesChanged = 0
for (const [file, rec] of byFile) {
  if (!rec.edits.length) continue
  const next = rec.lines.join('\n')
  // 原文零删除校验：剥离 mark 后必须与原文逐字符一致
  if (stripMark(next) !== rec.orig) {
    failures.push({ file, reason: '剥离mark后与原文不一致' })
    continue
  }
  filesChanged++
  const short = file.replace(/[\\/]/g, '-')
  console.log(`${APPLY ? '写入' : '预览'} ${file}  题数=${rec.edits.length}  详情见 dry-report`)
  if (APPLY) {
    fs.mkdirSync(path.dirname(path.join(BACKUP, short)), { recursive: true })
    fs.writeFileSync(path.join(BACKUP, short), rec.orig)
    fs.writeFileSync(path.join(root, file), next)
  }
}

console.log('\n=== 标注引擎结果 ===')
console.log(`扫描题块 ${processed} / 命中 ${hit} / 跳过 ${skipped} / 涉及文件 ${filesChanged}`)
if (failures.length) {
  console.log('失败：')
  failures.forEach((f) => console.log('  ', f.file, f.reason))
  process.exit(1)
}
if (!APPLY) console.log('（dry-run，未写入任何文件；加 --apply 生效）')
