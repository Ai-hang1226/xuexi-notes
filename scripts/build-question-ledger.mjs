// 题目台账生成器：扫描 cuotiben/ 与 daily-quizzes/ 下所有 md，识别每一道题块，
// 精确定位「题干段落」（标题后、第一个选项前的正文），统计题干内三色高亮。
// 输出 data/question-ledger.json，供批量标注引擎消费。只读脚本：不修改任何 md。
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const dirs = ['cuotiben', 'daily-quizzes']

// 题块起始：## 第N题 / ### 第N题
const HEAD_RE = /^(#{2,3})\s+第\s*(\d+)\s*题([^\n]*)$/
// 选项行：Markdown 列表选项 / 裸选项 / HTML 选项
const OPTION_RE =
  /^\s*(?:[-*]\s+)?\*\*?[（(]?[A-D][）)]?[.．、:：]?\*\*?\s|<div class="exam-option"|^\s*[A-D]\s*[．.、]\s*\S/

// 解析标志
const ANALYSIS_MARKERS = [
  /最终正确解析/, /最终解析/, /讨论后的参考解析/, /参考解析/, /本轮解析/,
  /正确答案[：:]/, /参考[ABCDE][。．，,]/, /答案[：:]\s*[ABCDE]/,
  /^\*\*解析[：:]?\*\*/m, /^###\s*(最终)?解析/m,
]

// 题型分类
const TYPE_RULES = [
  ['申论', /申论|归纳概括|综合分析|提出对策|贯彻执行|文章写作|作答要求/],
  ['言语·逻辑填空', /逻辑填空|依次填入|填入画横线|成语|实词/],
  ['言语·中心理解', /中心理解|主旨概括|意图判断|意在说明|这段文字主要/],
  ['言语·细节判断', /细节判断|细节理解|下列说法.{0,6}(正确|错误)|不符合|符合原文/],
  ['言语·语句表达', /语句排序|语句填空|语序|衔接|下文推断|标题填入|病句|语句表达/],
  ['资料分析', /资料分析|增长率|增长量|比重|平均数|倍数|基期|现期|同比|环比/],
  ['数量关系', /数量关系|工程问题|行程|浓度|利润|排列组合|概率|几何|容斥|经济利润|倍数特性/],
  ['判断·图形推理', /图形推理|图推|图形|折叠|对称|面数量|笔画/],
  ['判断·定义判断', /定义判断|根据.{0,8}定义|属于.{0,8}定义/],
  ['判断·类比推理', /类比推理|词项|类比/],
  ['判断·逻辑判断', /逻辑判断|加强|削弱|前提|假设|翻译推理|真假|论证/],
  ['常识/政治', /常识判断|政治理论|时政|法律|科技常识|历史|地理|物理|化学/],
]

function detectType(text) {
  for (const [name, re] of TYPE_RULES) if (re.test(text)) return name
  return '未分类'
}

function countMarks(text) {
  return {
    object: (text.match(/class="rv-object"/g) || []).length,
    period: (text.match(/class="rv-period"/g) || []).length,
    target: (text.match(/class="rv-target"/g) || []).length,
  }
}

const files = []
for (const d of dirs) {
  for (const name of fs.readdirSync(path.join(root, d))) {
    if (name.endsWith('.md')) files.push(`${d}/${name}`)
  }
}

const ledger = []

for (const rel of files) {
  const text = fs.readFileSync(path.join(root, rel), 'utf8')
  const lines = text.split(/\r?\n/)
  const heads = []
  lines.forEach((line, i) => {
    const m = line.match(HEAD_RE)
    if (m) heads.push({ line: i + 1, level: m[1].length, no: +m[2], rest: m[3].trim() })
  })

  for (let k = 0; k < heads.length; k++) {
    const h = heads[k]
    const next = heads[k + 1]
    const endLine = next ? next.line - 1 : lines.length
    const block = lines.slice(h.line, endLine)
    const full = block.join('\n')

    // 定位题干段落：从标题后开始，跳过空行/来源行/图解链接/标记行，
    // 到第一个选项行或「完整原题/题目回顾」等显式标记前为止。
    let stemStart = -1
    let stemEnd = -1
    for (let i = 0; i < block.length; i++) {
      const line = block[i]
      const t = line.trim()
      if (!t) continue
      // 跳过来源、题源、章节标记、图解说明、details 开合
      if (/^(来源[：:]|题源.*http|<a class="compact-flow|图解|图：|\*\*复盘类型|\*\*原[卷答]|<\/?details>|<\/?summary>|\*\*题目回顾\*\*|\*\*完整原题|\*\*原题与|###\s*原题)/.test(t)) continue
      // 跳过以「本人思路/最终解析/易错/知识点关联/记录边界」等解析段起始
      if (/^\*\*(本人思路|最终|讨论|易错|知识点|记录|题源)/.test(t)) break
      if (OPTION_RE.test(line)) break
      if (/^[A-D]\s*$/.test(t)) break
      if (stemStart < 0) stemStart = i
      stemEnd = i
    }

    const stem = stemStart >= 0 ? block.slice(stemStart, Math.min(stemEnd + 1, block.length)).join('\n') : ''
    const stemMarks = countMarks(stem)
    const blockMarks = countMarks(full)
    const hasAnalysis = ANALYSIS_MARKERS.some((re) => re.test(full))
    const hasCard = /<BreakPointCard/.test(full)
    const type = detectType(h.rest + '\n' + stem + '\n' + full.slice(0, 1000))
    const kind = rel.startsWith('daily-quizzes/') ? '原卷页' : rel.startsWith('cuotiben/') ? '复盘页' : '其他'
    // 有题干：题干段落有一定文字量（>=12 字）或是 HTML exam-question
    const hasStem = stem.replace(/<[^>]+>/g, '').replace(/\s/g, '').length >= 12 || /<div class="exam-question"/.test(full)

    ledger.push({
      id: `${rel.replace('/', '-').replace(/\.md$/, '')}-q${h.no}`,
      file: rel,
      line: h.line,
      stemLine: stemStart >= 0 ? h.line + stemStart : null,
      no: h.no,
      level: h.level,
      title: h.rest.replace(/\s*\{#.*$/, '').trim(),
      kind,
      type,
      hasStem,
      hasAnalysis,
      hasCard,
      stemChars: stem.replace(/<[^>]+>/g, '').replace(/\s/g, '').length,
      stemMarks,
      blockMarks,
      needMarks: hasStem && stemMarks.object + stemMarks.period + stemMarks.target === 0,
      stemPreview: stem.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').slice(0, 90),
    })
  }
}

const need = ledger.filter((q) => q.needMarks)
const payload = {
  generated: new Date().toISOString().slice(0, 10),
  summary: {
    files: files.length,
    totalQuestionBlocks: ledger.length,
    withStem: ledger.filter((q) => q.hasStem).length,
    withAnalysis: ledger.filter((q) => q.hasAnalysis).length,
    needMarks: need.length,
    withCard: ledger.filter((q) => q.hasCard).length,
  },
  byType: {},
  needByFile: {},
  questions: ledger,
}
for (const q of ledger) payload.byType[q.type] = (payload.byType[q.type] || 0) + 1
for (const q of need) {
  payload.needByFile[q.file] = payload.needByFile[q.file] || { total: 0, withAnalysis: 0 }
  payload.needByFile[q.file].total++
  if (q.hasAnalysis) payload.needByFile[q.file].withAnalysis++
}

fs.mkdirSync(path.join(root, 'data'), { recursive: true })
fs.writeFileSync(path.join(root, 'data/question-ledger.json'), JSON.stringify(payload, null, 2))

console.log('题目台账已生成：data/question-ledger.json')
console.log('摘要：', JSON.stringify(payload.summary, null, 2))
console.log('\n题型分布：')
for (const [k, v] of Object.entries(payload.byType).sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(18)} ${v}`)
console.log('\n需补题干高亮的文件 TOP20（题数 / 其中有解析）：')
for (const [f, s] of Object.entries(payload.needByFile).sort((a, b) => b[1].total - a[1].total).slice(0, 20)) {
  console.log(`  ${String(s.total).padStart(3)} / ${String(s.withAnalysis).padStart(3)}  ${f}`)
}
