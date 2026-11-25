import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createMarkdownRenderer } from 'vitepress'
import { moduleFromSearch } from '../cuotiben/components/review-filters.mjs'

const root = process.cwd()
const guides = ['zhengzhi', 'yanyu', 'shuliang', 'panduan', 'ziliao', 'changshi', 'shenlun'].map(name => `guide/${name}.md`)
const methods = [
  'xingce/zhengzhi-lilun.md', 'xingce/yanyu-lijie.md', 'xingce/shuliang-guanxi.md',
  'xingce/panduan-tuili.md', 'xingce/panduan-tuxing.md', 'xingce/panduan-dingyi.md',
  'xingce/panduan-leibi.md', 'xingce/panduan-luoji.md', 'xingce/ziliao-fenxi.md',
  'xingce/changshi-panduan.md', 'shenlun/index.md', 'shenlun/guina-gaikuo.md',
  'shenlun/zonghe-fenxi.md', 'shenlun/wenti-duice.md', 'shenlun/gongwen-geshi.md',
  'shenlun/wenzhang-xiezuo.md',
]
const md = await createMarkdownRenderer(root, {})
const anchorCache = new Map()
const issues = []
let count = 0

function anchorsFor(file) {
  if (!anchorCache.has(file)) {
    const html = md.render(fs.readFileSync(path.join(root, file), 'utf8'))
    anchorCache.set(file, new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1])))
  }
  return anchorCache.get(file)
}

function checkLinks(file, contents) {
  const current = '/' + file.replace(/(?:^|\/)index\.md$/, '/').replace(/\.md$/, '')
  for (const match of contents.matchAll(/\[[^\]]+\]\(([^\s)]+)\)/g)) {
    const href = match[1]
    const url = new URL(href, 'https://example.invalid' + current)
    if (url.origin !== 'https://example.invalid') continue
    count++
    const pathname = decodeURIComponent(url.pathname).replace(/^\//, '')
    let target = pathname.endsWith('/') ? pathname + 'index.md' : pathname + '.md'
    if (!fs.existsSync(path.join(root, target))) {
      issues.push(`${file}: 目标页面不存在 ${href}`)
      continue
    }
    if (url.hash) {
      const anchor = decodeURIComponent(url.hash.slice(1))
      if (!anchorsFor(target).has(anchor)) issues.push(`${file}: 目标锚点不存在 ${href}`)
    }
    if (url.searchParams.has('module') && moduleFromSearch(url.search) === '全部') {
      issues.push(`${file}: 无效的模块筛选 ${href}`)
    }
  }
}

for (const file of guides) {
  const text = fs.readFileSync(path.join(root, file), 'utf8')
  assert.ok(text.includes('## 系统知识与图解'), `${file} 缺少系统知识`)
  assert.ok(text.includes(file.endsWith('shenlun.md') ? '## 我的易错与练习' : '## 我的易错与错题'), `${file} 缺少个人复盘`)
  assert.ok(text.includes('## 技巧与特殊题型'), `${file} 缺少技巧专题`)
  checkLinks(file, text)
}
checkLinks('guide/index.md', fs.readFileSync(path.join(root, 'guide/index.md'), 'utf8'))
for (const file of methods) {
  const text = fs.readFileSync(path.join(root, file), 'utf8')
  const tip = text.match(/::: tip [^\n]+\n[\s\S]*?\n:::/)
  assert.ok(tip, `${file} 缺少三类直达入口`)
  checkLinks(file, tip[0])
}
if (issues.length) throw new Error(issues.join('\n'))
console.log(`学习入口检查通过：全站地图、${guides.length} 个总入口、${methods.length} 个内容页、${count} 个链接及目标锚点。`)
