// 构建产物体积守卫：防止搜索索引或静态资源无限膨胀。
// 运行：node scripts/check-size.mjs（构建之后）
import fs from 'node:fs'
import path from 'node:path'

const dist = path.resolve('.vitepress/dist')
if (!fs.existsSync(dist)) {
  console.error('构建产物不存在，请先执行 npm run docs:build')
  process.exit(1)
}

const MAX_DIST_MB = 90
const MAX_JS_MB = 3.5

let total = 0
const big = []
const walk = (dir) => {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    if (fs.statSync(p).isDirectory()) walk(p)
    else {
      const s = fs.statSync(p).size
      total += s
      if (name.endsWith('.js') && s > MAX_JS_MB * 1048576) big.push({ name, mb: s / 1048576 })
    }
  }
}
walk(dist)

const distMB = total / 1048576
const index = fs.readdirSync(path.join(dist, 'assets'))
  .filter((f) => f.startsWith('@localSearchIndex'))
  .map((f) => ({ name: f, mb: fs.statSync(path.join(dist, 'assets', f)).size / 1048576 }))

console.log(`dist 总体积 ${distMB.toFixed(1)}MB（上限 ${MAX_DIST_MB}MB）`)
index.forEach((i) => console.log(`  搜索索引 ${i.mb.toFixed(2)}MB  ${i.name}`))
big.forEach((b) => console.log(`  超限 JS ${b.mb.toFixed(2)}MB  ${b.name}`))

const failures = []
if (distMB > MAX_DIST_MB) failures.push(`dist ${distMB.toFixed(1)}MB 超过 ${MAX_DIST_MB}MB`)
if (big.length) failures.push(`${big.length} 个 JS 超过 ${MAX_JS_MB}MB`)
if (index.length > 1) failures.push(`存在 ${index.length} 份搜索索引副本，说明 dist 未清空就构建`)

if (failures.length) {
  console.log('\n体积守卫未通过：')
  failures.forEach((f) => console.log('  ✗ ' + f))
  process.exit(1)
}
console.log('\n体积守卫通过')
