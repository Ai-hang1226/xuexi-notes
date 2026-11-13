// 通用板块章节导航生成器：把「言语体系 · 16 章导航」的做法推广到所有内容板块。
// 从各模块体系页的标题确定性抽取「章节 → 要点」，输出统一数据与同版式导航页。
// 运行：node scripts/gen-section-nav.mjs（旧入口 gen-chapter-index.mjs 会转发到这里）
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const dataDir = path.join(root, 'data')

// 与 VitePress 内部 markdown-it-anchor 完全一致的锚点规则，保证卡片跳转不失效。
const rControl = /[\u0000-\u001f]/g
const rSpecial = /[\s~`!@#$%^&*()\-_+=[\]{}|\\;:"'“”‘’<>,.?/]+/g
const rCombining = /[\u0300-\u036F]/g
const slug = (s) => s.normalize('NFKD')
  .replace(rCombining, '').replace(rControl, '').replace(rSpecial, '-')
  .replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '')
  .replace(/^(\d)/, '_$1').toLowerCase()

const cn = (n) => {
  const d = '零一二三四五六七八九'
  if (n < 10) return d[n]
  if (n < 20) return '十' + (n % 10 ? d[n % 10] : '')
  return d[Math.floor(n / 10)] + '十' + (n % 10 ? d[n % 10] : '')
}
const numFromTitle = (title) => {
  const m = title.match(/^第(.+?)章/) || title.match(/^([一二三四五六七八九十]+)、/)
  return m ? m[1] : null
}
// 章节标题可能自带 VitePress 自定义锚点 {#id}，优先使用它并去掉显示后缀。
const parseTitle = (raw) => {
  const m = raw.match(/\s*\{#([^}]+)\}\s*$/)
  return { title: m ? raw.replace(m[0], '').trim() : raw.trim(), customAnchor: m ? m[1] : null }
}
const headsOf = (text) => text.split(/\r?\n/).map((line, i) => {
  const m = line.match(/^(#{1,3})\s+(.+)$/)
  return m ? { level: m[1].length, ...parseTitle(m[2]), line: i } : null
}).filter(Boolean)
// 章节正文里的列表项 / 加粗小标题，作为「要点」的补充来源，避免卡片空荡。
const extrasOf = (lines, start, end) => {
  const out = []
  for (let j = start + 1; j < end && out.length < 6; j++) {
    const s = lines[j].trim()
    if (/^#{1,6}\s/.test(s) || /^[-|>]{3,}\s*$/.test(s)) continue
    const m = s.match(/^(?:[-*]|\d+[.)])\s+(.+)$/) || s.match(/^\*\*(.+?)\*\*/)
    if (!m) continue
    let t = m[1].replace(/\*\*/g, '')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/[：:].*$/, '').trim()
    if (t.length > 20) t = t.slice(0, 18) + '…'
    if (t.length >= 2 && !out.includes(t)) out.push(t)
  }
  return out
}
// 表格型章节（如「考察范围」「常见材料类型」）用首列作为要点，跳过表头与分隔行。
const tableCells = (lines, start, end) => {
  const out = []
  let seenHeader = false
  for (let j = start + 1; j < end && out.length < 6; j++) {
    const s = lines[j].trim()
    if (!/^\|/.test(s)) continue
    const cells = s.split('|').map((x) => x.trim()).filter(Boolean)
    if (!cells.length || /^[-:| ]+$/.test(cells[0])) continue
    if (!seenHeader) { seenHeader = true; continue }
    const t = cells[0].replace(/\*\*/g, '').trim()
    if (t && t.length <= 20 && !out.includes(t)) out.push(t)
  }
  return out
}
// 章节既无小节也无列表时，退而取正文首句，保证每张卡片都有可记忆的线索。
const fallbackOf = (lines, start, end) => {
  for (let j = start + 1; j < end; j++) {
    const s = lines[j].trim()
    if (!s || /^(>|来源[:：]|注[:：]|https?:)/.test(s)) continue
    if (/^#{1,6}\s/.test(s) || /^[-|>]{3,}\s*$/.test(s) || /^(\$\$|<!--|\||:::|!\[|\{)/.test(s)) continue
    let t = s.replace(/\*\*/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/`([^`]+)`/g, '$1').replace(/^[>*+-]\s*/, '').trim()
    if (t.length < 4) continue
    if (t.length > 20) t = t.slice(0, 18) + '…'
    return [t]
  }
  return []
}
const mergePoints = (a, b) => [...new Set([...a, ...b])].slice(0, 6)
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')
const skip = ['看图复习', '概述', '来源与边界']

// 每个板块只声明「源页面 / 标题层级 / 相关入口」，章节与要点全部自动抽取。
const sections = [
  {
    key: 'yanyu', icon: '📖', title: '言语体系 · 16 章导航',
    page: 'xingce/言语体系章节导航.md', component: 'ChapterNav',
    intro: '本页按章列出要点，点任意章节直接跳到正文对应位置；正文原文一字未删。',
    source: 'xingce/大宝小宝言语体系-正文.md',
    sourceLink: '/xingce/大宝小宝言语体系-正文',
    sourceLabel: '打开完整正文（约 519KB，建议电脑阅读）',
    chapterLevel: 1, pointLevel: 2, chapterFilter: /^第.+章/,
    related: [
      { icon: '🧭', title: '言语理解学习路径', desc: '体系 → 方法 → 速查', link: '/guide/yanyu' },
      { icon: '🗣️', title: '言语理解方法库', desc: '本模块的方法沉淀', link: '/xingce/yanyu-lijie' },
      { icon: '🧠', title: '言语类错题复盘', desc: '按模块与错因检索', link: '/cuotiben/' },
    ],
  },
  {
    key: 'shuliang', icon: '🔢', title: '数量关系 · 16 章导航',
    page: 'xingce/数量关系章节导航.md',
    intro: '按高照 16 章体系列出要点，点任意章节直接跳到体系正文对应位置。',
    source: 'xingce/shuliang-guanxi.md',
    sourceLink: '/xingce/shuliang-guanxi',
    sourceLabel: '打开完整体系（高照 16 章 · 约 41KB）',
    chapterLevel: 1, pointLevel: 2, skipTitles: ['数量关系'],
    related: [
      { icon: '🧭', title: '数量学习路径', desc: '体系 → 方法 → 速查', link: '/guide/shuliang' },
      { icon: '🎯', title: '考场选法与适用边界', desc: '先判断题型再选方法', link: '/xingce/数量考场选法速查-2026-10-27' },
      { icon: '🧠', title: '数量类错题复盘', desc: '按模块与错因检索', link: '/cuotiben/' },
    ],
  },
  {
    key: 'panduan', icon: '🧩', title: '判断推理 · 四大题型导航',
    page: 'xingce/判断推理章节导航.md',
    intro: '按官方大纲的四大题型列出要点，每张卡片进入对应题型的完整方法页。',
    sourceLink: '/xingce/panduan-tuili',
    sourceLabel: '打开判断推理总览（四大题型）',
    multiSource: [
      { title: '图形推理', file: 'xingce/panduan-tuxing.md', link: '/xingce/panduan-tuxing' },
      { title: '定义判断', file: 'xingce/panduan-dingyi.md', link: '/xingce/panduan-dingyi' },
      { title: '类比推理', file: 'xingce/panduan-leibi.md', link: '/xingce/panduan-leibi' },
      { title: '逻辑判断', file: 'xingce/panduan-luoji.md', link: '/xingce/panduan-luoji' },
    ],
    related: [
      { icon: '🧭', title: '判断学习路径', desc: '四大题型的先后顺序', link: '/guide/panduan' },
      { icon: '🔺', title: '图推特征与操作速查', desc: '考前快速回看', link: '/xingce/图推特征与操作速查' },
      { icon: '🧠', title: '判断类错题复盘', desc: '按模块与错因检索', link: '/cuotiben/' },
    ],
  },
  {
    key: 'ziliao', icon: '📊', title: '资料分析 · 方法体系导航',
    page: 'xingce/资料分析章节导航.md',
    intro: '按公式、速算与读数分章，点任意章节直接跳到方法库对应位置。',
    source: 'xingce/ziliao-fenxi.md',
    sourceLink: '/xingce/ziliao-fenxi',
    sourceLabel: '打开完整方法库',
    chapterLevel: 2, pointLevel: 3,
    related: [
      { icon: '🧭', title: '资料学习路径', desc: '体系 → 方法 → 速查', link: '/guide/ziliao' },
      { icon: '🔢', title: '读数与百化分 1—20', desc: '常背分数速查', link: '/xingce/资料分析读数与百化分速查' },
      { icon: '🧮', title: '速算工具箱', desc: '增长率 / 基期 / 比重', link: '/tools/' },
    ],
  },
  {
    key: 'zhengzhi', icon: '🚩', title: '政治理论 · 章节导航',
    page: 'xingce/政治理论章节导航.md',
    intro: '2025 年起行测单列模块（20 题）：党的创新理论、方针政策、马原与党规党纪。按章跳到知识页对应位置。',
    source: 'xingce/zhengzhi-lilun.md',
    sourceLink: '/xingce/zhengzhi-lilun',
    sourceLabel: '打开完整知识页',
    chapterLevel: 2, pointLevel: 3,
    skipTitles: ['相关', '为什么单独成块', '与常识判断的分工'],
    related: [
      { icon: '🚩', title: '政治理论知识页', desc: '考查范围 / 高频考点 / 作答技巧', link: '/xingce/zhengzhi-lilun' },
      { icon: '🌍', title: '常识判断', desc: '法律 / 科技 / 文史 / 经济', link: '/xingce/常识判断章节导航' },
      { icon: '🗺️', title: '全站地图', desc: '按逻辑关系找页', link: '/guide/' },
    ],
  },
  {
    key: 'changshi', icon: '🌍', title: '常识判断 · 知识范围导航',
    page: 'xingce/常识判断章节导航.md',
    intro: '按考察范围分章，点任意章节直接跳到知识页对应位置。',
    source: 'xingce/changshi-panduan.md',
    sourceLink: '/xingce/changshi-panduan',
    sourceLabel: '打开完整知识页',
    chapterLevel: 2, pointLevel: 3,
    related: [
      { icon: '🧭', title: '常识学习路径', desc: '体系 → 方法 → 速查', link: '/guide/changshi' },
      { icon: '🗺️', title: '全站地图', desc: '按逻辑关系找页', link: '/guide/' },
      { icon: '🧠', title: '错题本', desc: '常识类错题归档', link: '/cuotiben/' },
    ],
  },
  {
    key: 'shenlun', icon: '✍️', title: '申论 · 五大题型导航',
    page: 'shenlun/五大题型导航.md',
    intro: 'Kiwi 框架是覆盖五大题型的总纲；本页按讲义章节列出要点，点卡片直接跳到对应位置。',
    source: 'shenlun/kiwi-framework.md',
    sourceLink: '/shenlun/kiwi-framework',
    sourceLabel: '打开 Kiwi 申论总纲',
    chapterLevel: 2, pointLevel: 3,
    related: [
      { icon: '🧭', title: '申论学习路径', desc: '总纲 → 五大题型 → 练习', link: '/guide/shenlun' },
      { icon: '📈', title: '评分与进步记录', desc: '首答基线 / 改写 / 验证', link: '/shenlun/scores' },
      { icon: '✨', title: '精选导读', desc: '归纳概括五要素专题', link: '/share/' },
    ],
  },
]

const buildChapters = (cfg) => {
  if (cfg.multiSource) {
    return cfg.multiSource.map((s, i) => ({
      no: cn(i + 1), title: s.title, anchor: '', link: s.link,
      points: headsOf(read(s.file))
        .filter((h) => h.level === 2 && !skip.includes(h.title))
        .slice(0, 6).map((h) => h.title),
    }))
  }
  const text = read(cfg.source)
  const lines = text.split(/\r?\n/)
  const hs = headsOf(text)
  const excluded = [...skip, ...(cfg.skipTitles || [])]
  const marks = hs.filter((h) => h.level === cfg.chapterLevel)
  const chapters = []
  marks.forEach((h, idx) => {
    if (excluded.includes(h.title) || (cfg.chapterFilter && !cfg.chapterFilter.test(h.title))) return
    const end = idx + 1 < marks.length ? marks[idx + 1].line : lines.length
    const sub = hs
      .filter((x) => x.level === cfg.pointLevel && x.line > h.line && x.line < end && !excluded.includes(x.title))
      .slice(0, 6).map((x) => x.title)
    const anchor = h.customAnchor || slug(h.title)
    // 卡片编号统一用连续中文数字，章名里重复的「一、」前缀去掉，避免「二 · 一、核心公式」这类错位。
    // 言语体系正文已于 2026-11-13 把 3 部分 16 章连续重编为第一章～第十六章，编号直接按正文顺序生成。
    const title = cfg.numMode === 'fromTitle'
      ? h.title
      : h.title.replace(/^[一二三四五六七八九十]+、\s*/, '')
    const no = cfg.numMode === 'fromTitle'
      ? (numFromTitle(h.title) || cn(chapters.length + 1))
      : cn(chapters.length + 1)
    // 小节标题足够时不掺入正文列表，保持原有体系的干净要点。
    const extras = sub.length >= 2
      ? []
      : mergePoints(extrasOf(lines, h.line, end), tableCells(lines, h.line, end))
    let points = mergePoints(sub, extras)
    if (!points.length) points = fallbackOf(lines, h.line, end)
    chapters.push({
      no, title, anchor,
      link: cfg.sourceLink + '#' + anchor,
      points,
    })
  })
  return chapters
}

const payload = { generated: new Date().toISOString().slice(0, 10), sections: {} }
const pageLines = (cfg) => [
  '---',
  `title: ${cfg.title}`,
  `description: ${cfg.title}：按章节列出要点，可快速跳转到原文`,
  '---',
  '',
  `# ${cfg.icon} ${cfg.title}`,
  '',
  cfg.intro,
  '',
  cfg.component ? '<ChapterNav />' : `<SectionNav section="${cfg.key}" />`,
  '',
  '## 相关入口',
  '',
  '<LinkCards :columns="3" :items="[',
  ...cfg.related.map((r, i) =>
    `  { icon: '${r.icon}', title: '${r.title}', desc: '${r.desc}', link: '${r.link}' }${i < cfg.related.length - 1 ? ',' : ''}`),
  ']" />',
  '',
]

fs.mkdirSync(dataDir, { recursive: true })
for (const cfg of sections) {
  const chapters = buildChapters(cfg)
  payload.sections[cfg.key] = {
    title: cfg.title, icon: cfg.icon, intro: cfg.intro,
    sourceLabel: cfg.sourceLabel, sourceLink: cfg.sourceLink,
    sourceFile: cfg.source || null, page: cfg.page,
    chapters,
  }
  const out = path.join(root, cfg.page)
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, pageLines(cfg).join('\n'))
  const pts = chapters.reduce((s, c) => s + c.points.length, 0)
  console.log(`${cfg.key.padEnd(10)} ${String(chapters.length).padStart(2)} 章 / ${String(pts).padStart(3)} 要点  →  ${cfg.page}`)
}

fs.writeFileSync(path.join(dataDir, 'section-nav.json'), JSON.stringify(payload, null, 2) + '\n')
// 兼容既有守卫与言语页组件：chapters.json 仍是言语模块的章节数据。
fs.writeFileSync(path.join(dataDir, 'chapters.json'), JSON.stringify(payload.sections.yanyu.chapters, null, 2) + '\n')
console.log(`已生成 data/section-nav.json（${Object.keys(payload.sections).length} 个板块）与 data/chapters.json`)
