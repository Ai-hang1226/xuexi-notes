// 静态资源引用审计：找出 public/ 下没有被任何页面/组件/配置引用的文件。
// 运行：node scripts/audit-assets.mjs            （只报告，不改动）
//       node scripts/audit-assets.mjs --park     （把零引用文件移到 .vitepress/parked-assets/，可逆）
// 判定方式：全文搜索文件名、相对路径、所属目录名；目录名命中视为该目录资源被动态引用。
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const pub = path.join(root, 'public')
const park = process.argv.includes('--park')

// 收集所有可能包含引用文本的文件
const textFiles = []
const walkSrc = (dir) => {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    if (fs.statSync(p).isDirectory()) {
      if (!['node_modules', '.git', 'public', 'dist', 'dist-stale', 'parked-assets', '.temp'].includes(name)) walkSrc(p)
    } else if (/\.(md|vue|mjs|js|json|css|html)$/.test(name)) textFiles.push(p)
  }
}
walkSrc(root)
let corpus = ''
for (const f of textFiles) {
  try { corpus += fs.readFileSync(f, 'utf8') + '\n' } catch {}
}

const assets = []
const walkPub = (dir) => {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    if (fs.statSync(p).isDirectory()) walkPub(p)
    else assets.push(p)
  }
}
walkPub(pub)

const unused = []
for (const p of assets) {
  const rel = path.relative(pub, p).replace(/\\/g, '/')
  const name = path.basename(p)
  const dir = path.dirname(rel)
  if (corpus.includes(rel) || corpus.includes(name) || corpus.includes(dir + '/')) continue
  unused.push({ p, rel, size: fs.statSync(p).size })
}

const total = assets.reduce((s, a) => s + fs.statSync(a).size, 0)
const freed = unused.reduce((s, u) => s + u.size, 0)
console.log(`public 共 ${assets.length} 个文件 / ${(total / 1048576).toFixed(1)}MB`)
console.log(`零引用 ${unused.length} 个 / ${(freed / 1048576).toFixed(1)}MB`)
const byDir = {}
for (const u of unused) {
  const d = u.rel.split('/')[0]
  byDir[d] = (byDir[d] || 0) + u.size
}
console.log('按目录：')
Object.entries(byDir).sort((a, b) => b[1] - a[1]).slice(0, 12)
  .forEach(([d, s]) => console.log(`  ${d.padEnd(34)} ${(s / 1048576).toFixed(2)}MB`))

if (park && unused.length) {
  const dest = path.join(root, '.vitepress/parked-assets')
  let moved = 0
  for (const u of unused) {
    const to = path.join(dest, u.rel)
    fs.mkdirSync(path.dirname(to), { recursive: true })
    fs.renameSync(u.p, to)
    moved++
  }
  console.log(`\n已移出 ${moved} 个文件到 .vitepress/parked-assets/（未删除，可原样移回）`)
  console.log('还原：node scripts/audit-assets.mjs --restore')
}

if (process.argv.includes('--restore')) {
  const dest = path.join(root, '.vitepress/parked-assets')
  if (!fs.existsSync(dest)) {
    console.log('无待还原文件')
  } else {
    let n = 0
    const walkBack = (dir) => {
      for (const name of fs.readdirSync(dir)) {
        const p = path.join(dir, name)
        if (fs.statSync(p).isDirectory()) walkBack(p)
        else {
          const to = path.join(pub, path.relative(dest, p))
          fs.mkdirSync(path.dirname(to), { recursive: true })
          fs.renameSync(p, to)
          n++
        }
      }
    }
    walkBack(dest)
    console.log(`已还原 ${n} 个文件到 public/`)
  }
}
