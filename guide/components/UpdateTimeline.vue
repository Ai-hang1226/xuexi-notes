<script setup>
import { computed, ref } from 'vue'
import { withBase } from 'vitepress'
import updates from '../../data/updates.json'

const base = (p) => withBase(p)
const active = ref('全部')
const tags = computed(() => ['全部', ...new Set(updates.map((u) => u.tag))])
const shown = computed(() => active.value === '全部' ? updates : updates.filter((u) => u.tag === active.value))
const months = computed(() => {
  const map = new Map()
  for (const u of shown.value) {
    const key = u.date.slice(0, 7)
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(u)
  }
  return [...map.entries()].map(([key, list]) => {
    const [y, m] = key.split('-')
    return { key, label: `${y} 年 ${Number(m)} 月`, list }
  })
})
</script>

<template>
  <section class="changelog" aria-label="全站更新日志">
    <div class="cl-head">
      <div>
        <span class="cl-kicker">CHANGELOG</span>
        <h1>🕘 更新日志</h1>
        <p>与首页「最近更新」共用同一份数据，按月份分组。共 <b>{{ updates.length }}</b> 条，不再手数。</p>
      </div>
      <div class="cl-note">数据源 · <code>data/updates.json</code><br />由 <code>node scripts/build-dashboard.mjs</code> 生成</div>
    </div>

    <div class="cl-tags" role="group" aria-label="按标签筛选更新">
      <button v-for="t in tags" :key="t" type="button" :class="{ active: active === t }" @click="active = t">{{ t }}</button>
      <span>{{ shown.length }} 条</span>
    </div>

    <div v-for="month in months" :key="month.key" class="cl-month">
      <h2>{{ month.label }} <small>{{ month.list.length }} 条</small></h2>
      <ul>
        <li v-for="(u, i) in month.list" :key="u.date + u.title + i">
          <div class="cl-meta">
            <time>{{ u.date }}</time>
            <span class="cl-tag" :class="'t-' + u.tone">{{ u.tag }}</span>
          </div>
          <div class="cl-body">
            <a :href="base(u.links[0]?.url || '/guide/')">{{ u.title }}</a>
            <p>{{ u.summary }}</p>
            <div v-if="u.links.length > 1" class="cl-links">
              <a v-for="(l, j) in u.links.slice(1)" :key="l.url + j" :href="base(l.url)">{{ l.text }} ↗</a>
            </div>
          </div>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.changelog { font-family: var(--vp-font-family-base); color: var(--vp-c-text-1); }
.cl-head { display: flex; align-items: end; justify-content: space-between; gap: 20px; margin-bottom: 24px; padding: 0 0 22px; border-bottom: 2px solid var(--vp-c-divider); }
.cl-kicker { color: #6d63d6; font-size: 11px; font-weight: 700; letter-spacing: .14em; }
.cl-head h1 { margin: 6px 0 10px; font-size: 30px; }
.cl-head p { margin: 0; color: var(--vp-c-text-2); font-size: 14px; }
.cl-head p b { color: #4f46e5; }
.cl-note { color: var(--vp-c-text-2); font-size: 11px; line-height: 1.8; text-align: right; }
.cl-note code { font-size: 11px; }
.cl-tags { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 28px; }
.cl-tags button { padding: 6px 12px; border: 1px solid var(--vp-c-divider); border-radius: 999px; background: var(--vp-c-bg-soft); color: var(--vp-c-text-2); font: inherit; font-size: 13px; cursor: pointer; }
.cl-tags button:hover { border-color: #a5a0ea; color: #4f46e5; }
.cl-tags button.active { border-color: #4f46e5; background: #4f46e5; color: #fff; }
.cl-tags span { margin-left: auto; color: var(--vp-c-text-2); font-size: 12px; }
.cl-month { margin-bottom: 30px; }
.cl-month h2 { margin: 0 0 12px; font-size: 19px; }
.cl-month h2 small { margin-left: 8px; color: var(--vp-c-text-2); font-size: 12px; font-weight: 400; }
.cl-month ul { margin: 0; padding: 0; list-style: none; }
.cl-month li { display: grid; grid-template-columns: 128px minmax(0, 1fr); gap: 16px; padding: 16px 0; border-top: 1px dashed var(--vp-c-divider); }
.cl-meta { display: grid; justify-items: start; gap: 7px; }
.cl-meta time { color: var(--vp-c-text-2); font-size: 12px; font-variant-numeric: tabular-nums; }
.cl-tag { padding: 3px 9px; border-radius: 999px; background: rgba(79, 70, 229, .1); color: #4f46e5; font-size: 11px; font-weight: 700; white-space: nowrap; }
.cl-tag.t-shenlun { background: #e0f2fe; color: #0369a1; }
.cl-tag.t-quiz { background: #fef3c7; color: #92400e; }
.cl-tag.t-tool { background: #dcfce7; color: #166534; }
.cl-tag.t-judge { background: #f3e8ff; color: #7e22ce; }
.cl-tag.t-math, .cl-tag.t-data { background: #ffedd5; color: #9a3412; }
.cl-body a { color: var(--vp-c-text-1); font-size: 15px; font-weight: 700; }
.cl-body a:hover { color: #4f46e5; }
.cl-body p { margin: 6px 0 0; color: var(--vp-c-text-2); font-size: 13px; line-height: 1.75; }
.cl-links { display: flex; flex-wrap: wrap; gap: 6px 14px; margin-top: 8px; }
.cl-links a { color: #4f46e5; font-size: 12px; font-weight: 600; }
:global(.dark) .cl-tags button.active { background: #6366f1; }
@media (max-width: 720px) {
  .cl-head { flex-direction: column; align-items: flex-start; }
  .cl-note { text-align: left; }
  .cl-month li { grid-template-columns: 1fr; gap: 8px; }
  .cl-meta { display: flex; align-items: center; gap: 10px; }
}
</style>
