import fs from 'node:fs'
import path from 'node:path'
import pathPosix from 'node:path/posix'
import crypto from 'node:crypto'

const root = process.cwd()
const indexFile = path.join(root, 'retest', 'xingcezhenti-index.json')
const index = JSON.parse(fs.readFileSync(indexFile, 'utf8'))
const modules = {
  politics: '01-政治理论',
  general: '02-常识判断',
  language: '03-言语理解与表达',
  quantity: '04-数量关系',
  reasoning: '05-判断推理',
  data: '06-资料分析',
}
const args = process.argv.slice(2)

function option(name, fallback = '') {
  const position = args.indexOf(name)
  return position < 0 ? fallback : args[position + 1] || ''
}

function has(name) {
  return args.includes(name)
}

function safeTarget(destination, relative) {
  if (!relative || relative.startsWith('/') || relative.includes('\\')
      || relative.includes(':') || relative.split('/').includes('..')) {
    throw new Error('题库目录路径不安全，已停止。')
  }
  const base = path.resolve(destination)
  const target = path.resolve(base, ...relative.split('/'))
  if (!target.startsWith(base + path.sep)) throw new Error('目标目录超出缓存目录。')
  return target
}

function gitBlobSha(bytes) {
  return crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')
}

function upstreamUrl(relative) {
  return `https://raw.githubusercontent.com/${index.repository}/${index.commit}/${relative.split('/').map(encodeURIComponent).join('/')}`
}

async function readPinned(relative, expectedSha) {
  const response = await fetch(upstreamUrl(relative), { headers: { 'User-Agent': 'Codex-Xingce-ReadOnly' } })
  if (!response.ok) throw new Error(`读取上游文件失败：HTTP ${response.status} (${relative})`)
  const bytes = Buffer.from(await response.arrayBuffer())
  if (expectedSha && gitBlobSha(bytes) !== expectedSha) throw new Error(`上游文件哈希不匹配，未保存：${relative}`)
  return bytes
}

async function list() {
  const modulePath = modules[option('--module')]
  if (option('--module') && !modulePath) throw new Error('模块应为 politics/general/language/quantity/reasoning/data。')
  const filters = [modulePath, option('--year'), option('--region'), option('--query')].filter(Boolean)
  const matched = index.entries.filter((entry) => filters.every((term) => entry.path.toLocaleLowerCase().includes(term.toLocaleLowerCase())))
  const limit = Math.max(1, Math.min(200, Number(option('--limit', '30')) || 30))
  process.stdout.write(JSON.stringify({
    repository: index.repository,
    commit: index.commit,
    count: matched.length,
    shown: Math.min(matched.length, limit),
    matches: matched.slice(0, limit),
  }, null, 2) + '\n')
}

function imageRefs(text, sourcePath) {
  const refs = [
    ...[...text.matchAll(/!\[[^\]]*\]\(([^)\n]+)\)/g)].map((match) => match[1]),
    ...[...text.matchAll(/!\[\[([^\]\n]+)\]\]/g)].map((match) => match[1]),
    ...[...text.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/gi)].map((match) => match[1]),
  ]
  return [...new Set(refs.map((raw) => raw.split('|')[0].trim().replace(/^<|>$/g, '')))]
    .filter((ref) => !/^(?:[a-z]+:|\/\/|data:)/i.test(ref))
    .map((ref) => pathPosix.normalize(pathPosix.join(pathPosix.dirname(sourcePath), decodeURIComponent(ref))))
}

async function fetchPaper() {
  const relative = option('--path')
  const entry = index.entries.find((item) => item.path === relative)
  if (!entry) throw new Error('必须使用 list 返回的完整题库路径。')
  const destination = path.resolve(option('--dest', path.join(root, 'work', 'xingcezhenti-cache')))
  const target = safeTarget(destination, relative)
  let bytes
  if (fs.existsSync(target)) {
    bytes = fs.readFileSync(target)
    if (gitBlobSha(bytes) !== entry.sha) throw new Error(`缓存与固定版本不一致；原文件已保留：${target}`)
  } else {
    bytes = await readPinned(relative, entry.sha)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, bytes)
  }

  const downloadedImages = []
  if (has('--images')) {
    const imageIndex = new Map(index.entries.map((item) => [item.path, item]))
    for (const imagePath of imageRefs(bytes.toString('utf8'), relative)) {
      if (!imagePath.startsWith('90-图片/')) throw new Error(`图片路径超出技能资源目录：${imagePath}`)
      const imageEntry = imageIndex.get(imagePath)
      const imageTarget = safeTarget(destination, imagePath)
      if (fs.existsSync(imageTarget)) {
        const existing = fs.readFileSync(imageTarget)
        if (imageEntry?.sha && gitBlobSha(existing) !== imageEntry.sha) throw new Error(`图片缓存哈希不匹配；原文件已保留：${imageTarget}`)
      } else {
        const imageBytes = await readPinned(imagePath, imageEntry?.sha)
        fs.mkdirSync(path.dirname(imageTarget), { recursive: true })
        fs.writeFileSync(imageTarget, imageBytes)
      }
      downloadedImages.push(imagePath)
    }
  }

  process.stdout.write(JSON.stringify({
    repository: index.repository,
    commit: index.commit,
    path: relative,
    sha: gitBlobSha(bytes),
    localPath: path.relative(root, target),
    verified: true,
    downloadedImages,
  }, null, 2) + '\n')
}

try {
  if (args[0] === 'list') await list()
  else if (args[0] === 'fetch') await fetchPaper()
  else {
    console.log('用法：')
    console.log('  node scripts/xingcezhenti-source.mjs list --module language --year 2024 --region 江苏 --query A类')
    console.log('  node scripts/xingcezhenti-source.mjs fetch --path "题库返回的完整路径" --images')
    console.log('fetch 默认只写入 work/xingcezhenti-cache，不改动原题和网站内容。')
  }
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
