import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const skillRoot = process.env.XINGCEZHENTI_SKILL_ROOT
  || 'C:/Users/Administrator/.codex/skills/xingcezhenti-trainer'
const source = path.join(skillRoot, 'references', 'papers-index.json')
const target = path.join(root, 'retest', 'xingcezhenti-index.json')
const index = JSON.parse(fs.readFileSync(source, 'utf8'))

if (index.repository !== 'ERRRC/xingcezhenti' || !/^[a-f0-9]{40}$/.test(index.commit || '')
    || !Array.isArray(index.entries) || index.entries.length < 100) {
  throw new Error('行测真题技能目录不符合预期，未写入项目。')
}

fs.writeFileSync(target, JSON.stringify(index, null, 2) + '\n', 'utf8')
const publicTarget = path.join(root, 'public', 'retest', 'xingcezhenti-index.json')
fs.mkdirSync(path.dirname(publicTarget), { recursive: true })
fs.copyFileSync(target, publicTarget)
console.log(`已同步 ${index.entries.length} 条目录记录（${index.repository}@${index.commit}）`)
console.log(path.relative(root, target))
