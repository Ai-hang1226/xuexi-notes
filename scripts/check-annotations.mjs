// 题目标注守卫：确认「三色高亮 + 破题点卡片」改动没有删改任何原文。
// 校验口径：
//   1) 剥离 <mark>、<BreakPointCard>、并把 <ReadingLegend /> 还原为原文字图例行后，
//      与原文件（git HEAD）的「非空行序列」逐行一致
//   2) 三色 mark 标签开闭成对
//   3) 无嵌套 mark
//   4) 输出蓝/橙/绿与卡片数量统计
// 用法：
//   node scripts/check-annotations.mjs                     # 校验全部改动过的 md
//   node scripts/check-annotations.mjs cuotiben/xxx.md      # 校验指定文件
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const LEGEND = '<p><strong>读题标记：</strong>蓝色＝对象或范围　·　橙色＝时间或条件　·　绿色＝问题或要求。</p>'
const root = process.cwd()

function changedMarkdownFiles() {
  const out = execSync('git status --porcelain', { encoding: 'utf8', cwd: root })
  return out
    .split('\n')
    .filter(Boolean)
    .map((l) => l.slice(3).trim())
    .map((p) => p.replace(/^"|"$/g, ''))
    .filter((p) => p.endsWith('.md'))
}

function relToGitPath(p) {
  // git status 对中文名会输出八进制转义或带引号；用 git diff --name-only 更稳
  return p
}

const args = process.argv.slice(2)
let files = args.length ? args : []
if (!files.length) {
  // -z 以 NUL 分隔且不做路径转义，能正确取到中文文件名；排除备份/构建产物目录
  const run = (cmd) => {
    try {
      return execSync(cmd, { encoding: 'utf8', cwd: root }).split('\0').filter(Boolean)
    } catch {
      return []
    }
  }
  const tracked = run('git diff --name-only -z')
  const untracked = run('git ls-files --others --exclude-standard -z')
  files = [...new Set([...tracked, ...untracked])].filter(
    (p) =>
      p.endsWith('.md') &&
      !p.startsWith('.workbuddy/') &&
      !p.startsWith('.vitepress/') &&
      !p.startsWith('node_modules/') &&
      !p.startsWith('docs/') // 规范文档里的示例标签不算题目标注
  )
}
if (!files.length) {
  console.log('没有改动过的 md 文件需要校验')
  process.exit(0)
}

let allOK = true
const totals = { object: 0, period: 0, target: 0, cards: 0 }
const failList = []

for (const f of files) {
  const abs = path.join(root, f)
  if (!fs.existsSync(abs)) continue
  let orig = ''
  try {
    orig = execSync(`git show HEAD:${f}`, { encoding: 'utf8', cwd: root }).replace(/\r\n/g, '\n')
  } catch {
    // 新文件：跳过原文比对，只做标签合法性检查
    orig = null
  }
  const now = fs.readFileSync(abs, 'utf8').replace(/\r\n/g, '\n')
  const strip = (s) =>
    s
      .replace(/<BreakPointCard[\s\S]*?\/>/g, '')
      .replace(/<ReadingLegend[^>]*?\/>/g, '')
      .replace(/<\/?mark[^>]*>/g, '')
      .split('\n')
      .map((x) => x.trimEnd())
      // 图例既可能是组件的渲染位，也可能是早期写死的文字行；两者都不属于题目原文
      .filter((x) => x.trim() && !/^<p><strong>读题标记：<\/strong>/.test(x.trim()))

  const bare = strip(now)
  let origOK = true
  let firstBad = -1
  if (orig !== null) {
    const a = strip(orig)
    for (let i = 0; i < Math.max(a.length, bare.length); i++) {
      if (a[i] !== bare[i]) { firstBad = i; origOK = false; break }
    }
  }

  const marks = now.match(/<mark class="rv-(object|period|target)">/g) || []
  const closes = (now.match(/<\/mark>/g) || []).length
  const paired = marks.length === closes
  const nested = /<mark[^>]*>[^<]*<mark/.test(now)
  const o = (now.match(/rv-object/g) || []).length
  const p = (now.match(/rv-period/g) || []).length
  const t = (now.match(/rv-target/g) || []).length
  const cards = (now.match(/<BreakPointCard/g) || []).length
  totals.object += o; totals.period += p; totals.target += t; totals.cards += cards

  const ok = origOK && paired && !nested
  if (!ok) { allOK = false; failList.push({ f, origOK, paired, nested, firstBad }) }
  console.log(
    `${ok ? 'OK  ' : 'FAIL'} 原文${origOK ? '零改动' : '有改动'} 标签${String(marks.length).padStart(3)}${paired ? '成对' : '不成对!'} 嵌套${nested ? '有!' : '无'} 蓝${String(o).padStart(3)}/橙${String(p).padStart(3)}/绿${String(t).padStart(3)} 卡${String(cards).padStart(2)}  ${f}`
  )
  if (!origOK && firstBad >= 0 && orig !== null) {
    const a = strip(orig)
    console.log(`     首个差异行 ${firstBad}`)
    console.log(`       原: ${JSON.stringify((a[firstBad] || '').slice(0, 100))}`)
    console.log(`       现: ${JSON.stringify((bare[firstBad] || '').slice(0, 100))}`)
  }
}

console.log('\n=== 汇总 ===')
console.log(`文件 ${files.length} 个 · 蓝 ${totals.object} · 橙 ${totals.period} · 绿 ${totals.target} · 破题点卡片 ${totals.cards}`)
if (!allOK) {
  console.log('存在失败项：')
  failList.forEach((x) => console.log('  ', x.f, JSON.stringify(x)))
  process.exit(1)
}
console.log('全部通过：原文零改动、标签成对、无嵌套')
