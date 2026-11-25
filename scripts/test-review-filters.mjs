import assert from 'node:assert/strict'
import fs from 'node:fs'
import { reviewModules, moduleFromSearch } from '../cuotiben/components/review-filters.mjs'

const catalog = JSON.parse(fs.readFileSync(new URL('../cuotiben/review-catalog.json', import.meta.url), 'utf8'))
for (const module of reviewModules) {
  const query = '?module=' + encodeURIComponent(module)
  assert.equal(moduleFromSearch(query), module, module)
  assert.ok(catalog.some(q => q.module === module), module + ' should have actual recorded questions')
}
assert.equal(moduleFromSearch(''), '全部')
assert.equal(moduleFromSearch('?module=未知模块'), '全部')
assert.equal(moduleFromSearch('?module=__proto__'), '全部')
assert.equal(moduleFromSearch('?module=%E5%9B%BE%E5%BD%A2%E6%8E%A8%E7%90%86&other=1'), '图形推理')
console.log('复盘直达筛选：9 个模块、默认值和无效参数检查通过。')
