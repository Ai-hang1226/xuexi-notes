<script setup>
import { computed, ref } from 'vue'
import { withBase } from 'vitepress'
import questions from '../review-catalog.json'

const modules = ['政治理论', '常识判断', '言语理解', '数量关系', '图形推理', '定义判断', '类比推理', '逻辑判断', '资料分析']
const types = ['错题', '不确定', '猜题', '耗时较长', '未作答', '答对复习', '待复盘']
const module = ref('全部')
const type = ref('全部')
const keyword = ref('')
const onlyPending = ref(false)
const sort = ref('date-desc')

const isPending = q => /待验证|未验证|独立迁移/.test(q.note || '') || q.types.includes('待复盘')
const stats = computed(() => ({
  total: questions.length,
  wrong: questions.filter(q => q.types.includes('错题')).length,
  guess: questions.filter(q => q.types.includes('猜题')).length,
  slow: questions.filter(q => q.types.includes('耗时较长')).length,
  pending: questions.filter(isPending).length,
}))
const moduleBars = computed(() => {
  const max = Math.max(...modules.map(n => questions.filter(q => q.module === n).length))
  return modules.map(name => {
    const count = questions.filter(q => q.module === name).length
    return { name, count, pct: Math.round((count / max) * 100) }
  }).sort((a, b) => b.count - a.count)
})
const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  const list = questions.filter(q =>
    (module.value === '全部' || q.module === module.value) &&
    (type.value === '全部' || q.types.includes(type.value)) &&
    (!onlyPending.value || isPending(q)) &&
    (!kw || (q.title + ' ' + (q.note || '')).toLowerCase().includes(kw)))
  const sorted = [...list]
  if (sort.value === 'date-asc') sorted.sort((a, b) => (a.date || '').localeCompare(b.date || ''))
  else if (sort.value === 'time-desc') sorted.sort((a, b) => (b.seconds || 0) - (a.seconds || 0))
  else sorted.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  return sorted
})
const groups = computed(() => modules.map(name => ({
  name, questions: filtered.value.filter(q => q.module === name),
})).filter(g => g.questions.length))
const title = q => q.title.replace(/^\d+ 粉笔专项-(?:数量关系|判断推理|资料分析)-/, '').replace(/（原卷第(\d+)题）/, '（第$1题）')
const tagClass = t => ({ 错题: 'wrong', 不确定: 'uncertain', 猜题: 'guess', 耗时较长: 'slow' }[t] || 'neutral')
const reset = () => { module.value = '全部'; type.value = '全部'; keyword.value = ''; onlyPending.value = false }
</script>

<template>
  <section class="review-catalog" aria-label="行测复盘题目">
    <!-- 统计条：先看到规模，再决定从哪下手 -->
    <div class="catalog-stats">
      <div><b>{{ stats.total }}</b><span>题记录</span></div>
      <div><b>{{ stats.wrong }}</b><span>错题</span></div>
      <div><b>{{ stats.guess }}</b><span>猜题</span></div>
      <div><b>{{ stats.slow }}</b><span>慢题</span></div>
      <div class="is-pending"><b>{{ stats.pending }}</b><span>待验证 / 待复盘</span></div>
    </div>

    <div class="module-bars" aria-label="模块沉淀分布">
      <span v-for="m in moduleBars" :key="m.name" class="module-bar" :title="`${m.name} ${m.count} 条`">
        <i :style="{ height: m.pct + '%' }"></i>
        <small>{{ m.name.slice(0, 2) }} {{ m.count }}</small>
      </span>
    </div>

    <!-- 筛选 -->
    <div class="filters">
      <label class="search-field">搜索题目 / 错因
        <input v-model="keyword" type="search" placeholder="如：分母、交叉关系、独立迁移" aria-label="搜索题目与错因" />
      </label>
      <label>模块
        <select v-model="module" aria-label="按模块筛选">
          <option>全部</option><option v-for="name in modules" :key="name">{{ name }}</option>
        </select>
      </label>
      <label>复盘类型
        <select v-model="type" aria-label="按复盘类型筛选">
          <option>全部</option><option v-for="name in types" :key="name">{{ name }}</option>
        </select>
      </label>
      <label>排序
        <select v-model="sort" aria-label="按日期或用时排序">
          <option value="date-desc">日期 · 新到旧</option>
          <option value="date-asc">日期 · 旧到新</option>
          <option value="time-desc">用时 · 长到短</option>
        </select>
      </label>
      <button class="pending-toggle" :class="{ active: onlyPending }" type="button" @click="onlyPending = !onlyPending">
        只看待验证
      </button>
      <button v-if="module !== '全部' || type !== '全部' || keyword || onlyPending" class="reset" type="button" @click="reset">清除筛选</button>
    </div>

    <p class="result-count" role="status" aria-live="polite">
      当前 {{ filtered.length }} 条 / 共 {{ stats.total }} 条 · 按模块展开。标签可叠加，条目数不等于新做题量。
    </p>
    <p v-if="!filtered.length" class="empty">这一类暂时没有记录，可以换关键词或清除筛选。</p>

    <details v-for="group in groups" :key="group.name" class="review-group" :open="module !== '全部' || type !== '全部' || onlyPending || !!keyword">
      <summary>{{ group.name }} <span>{{ group.questions.length }} 条</span></summary>
      <ul class="question-list">
        <li v-for="q in group.questions" :key="q.id">
          <div class="question-tags"><span v-for="tag in q.types" :key="tag" :class="['review-tag', tagClass(tag)]">{{ tag }}</span></div>
          <a class="question-link" :href="withBase(q.url)">{{ title(q) }}</a>
          <div class="question-meta">{{ q.date }} 记录<span aria-hidden="true"> · </span>用时：{{ q.time }}</div>
          <p v-if="q.note" class="question-note">{{ q.note }}</p>
        </li>
      </ul>
    </details>
  </section>
</template>

<style scoped>
.review-catalog { margin: 28px 0; font-family: var(--vp-font-family-base); }
.catalog-stats { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; margin-bottom: 14px; }
.catalog-stats div { display: grid; gap: 2px; padding: 12px 14px; border: 1px solid var(--vp-c-divider); border-radius: 12px; background: var(--vp-c-bg-soft); }
.catalog-stats b { font-size: 24px; font-variant-numeric: tabular-nums; line-height: 1.1; }
.catalog-stats span { color: var(--vp-c-text-2); font-size: 13px; }
.catalog-stats .is-pending { border-color: #f0b357; background: rgba(245, 158, 11, .09); }
.catalog-stats .is-pending b { color: #b45309; }
.module-bars { display: flex; align-items: end; gap: 10px; height: 78px; margin: 0 0 20px; padding: 10px 14px 0; border: 1px solid var(--vp-c-divider); border-radius: 12px; }
.module-bar { position: relative; display: flex; flex: 1; align-items: end; justify-content: center; height: 100%; }
.module-bar i { display: block; width: 100%; max-width: 46px; min-height: 4px; border-radius: 6px 6px 0 0; background: linear-gradient(180deg, #6d64f0, #4f46e5); opacity: .82; }
.module-bar small { position: absolute; bottom: -2px; color: var(--vp-c-text-2); font-size: 11px; white-space: nowrap; }

.filters { display: flex; align-items: end; flex-wrap: wrap; gap: 14px 20px; padding-bottom: 18px; border-bottom: 2px solid var(--vp-c-divider); }
.filters label { display: grid; gap: 8px; font-size: 16px; font-weight: 700; }
.search-field { flex: 1 1 220px; }
.filters input, .filters select { min-width: 150px; padding: 9px 12px; border: 1px solid var(--vp-c-text-2); border-radius: 6px; color: var(--vp-c-text-1); background: var(--vp-c-bg); font: inherit; font-size: 16px; }
.search-field input { width: 100%; }
.pending-toggle { padding: 10px 14px; border: 1px solid #e0a94a; border-radius: 8px; color: #92400e; background: #fff8e8; font: inherit; font-size: 16px; font-weight: 700; cursor: pointer; }
.pending-toggle.active { color: #fff; background: #b45309; border-color: #b45309; }
.reset { color: var(--vp-c-brand-1); padding: 10px 0; font: inherit; font-size: 16px; text-decoration: underline; cursor: pointer; }
.filters :focus-visible, summary:focus-visible, .question-link:focus-visible { outline: 3px solid var(--vp-c-brand-1); outline-offset: 4px; }
.result-count { color: var(--vp-c-text-2); font-size: 16px; }
.empty { padding: 24px; color: var(--vp-c-text-2); text-align: center; }
.review-group { margin: 0; border-bottom: 1px solid var(--vp-c-divider); }
.review-group summary { cursor: pointer; padding: 20px 8px; font-size: 24px; font-weight: 700; }
.review-group summary span { margin-left: 12px; color: var(--vp-c-text-2); font-size: 18px; font-weight: 400; }
.question-list { list-style: none; margin: 0; padding: 0 8px 12px; }
.question-list li { padding: 20px 0; margin: 0; border-top: 1px solid var(--vp-c-divider); }
.question-tags { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; }
.review-tag { display: inline-block; padding: 2px 9px; border: 1px solid currentColor; border-radius: 4px; font-size: 17px; line-height: 1.6; font-weight: 700; }
.wrong { color: #b42318; }.uncertain { color: #7a4d00; }.guess { color: #6b46a1; }.slow { color: #175d64; }.neutral { color: var(--vp-c-text-2); }
.question-link { display: block; font-size: 22px; line-height: 1.65; overflow-wrap: anywhere; }
.question-link:hover { color: var(--vp-c-brand-1); }
.question-meta, .question-note { color: var(--vp-c-text-2); font-size: 17px; line-height: 1.7; margin: 6px 0 0; }
:global(.dark) .wrong { color: #ffb4ab; }:global(.dark) .uncertain { color: #f4ce83; }:global(.dark) .guess { color: #d4b8ff; }:global(.dark) .slow { color: #97d7dc; }
:global(.dark) .pending-toggle { color: #f4ce83; background: rgba(245, 158, 11, .12); }
:global(.dark) .pending-toggle.active { color: #1f1a10; }

@media (max-width: 900px) {
  .catalog-stats { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .module-bars { overflow-x: auto; }
  .module-bar { min-width: 58px; }
}
@media (max-width: 640px) {
  .catalog-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .filters { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 12px; }
  .search-field { grid-column: 1 / -1; }
  .pending-toggle, .reset { text-align: left; }
  .filters select, .filters input { width: 100%; min-width: 0; }
  .review-group summary { padding: 18px 2px; }
  .question-list { padding-left: 2px; padding-right: 2px; }
}
</style>
