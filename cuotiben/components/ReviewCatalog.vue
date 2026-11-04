<script setup>
import { computed, ref } from 'vue'
import { withBase } from 'vitepress'
import questions from '../review-catalog.json'

const modules = ['言语理解', '数量关系', '图形推理', '定义判断', '类比推理', '逻辑判断', '资料分析']
const types = ['错题', '不确定', '猜题', '耗时较长', '未作答', '答对复习', '待复盘']
const module = ref('全部')
const type = ref('全部')
const filtered = computed(() => questions.filter(q =>
  (module.value === '全部' || q.module === module.value) &&
  (type.value === '全部' || q.types.includes(type.value))))
const groups = computed(() => modules.map(name => ({ name, questions: filtered.value.filter(q => q.module === name) })).filter(g => g.questions.length))
const title = q => q.title.replace(/^\d+ 粉笔专项-(?:数量关系|判断推理|资料分析)-/, '').replace(/（原卷第(\d+)题）/, '（第$1题）')
const tagClass = t => ({ 错题: 'wrong', 不确定: 'uncertain', 猜题: 'guess', 耗时较长: 'slow' }[t] || 'neutral')
</script>

<template>
  <section class="review-catalog" aria-label="行测复盘题目">
    <div class="filters">
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
      <button v-if="module !== '全部' || type !== '全部'" class="reset" @click="module = '全部'; type = '全部'">清除筛选</button>
    </div>
    <p class="result-count" role="status" aria-live="polite">{{ filtered.length }} 条题目记录，按模块展开查看。标签可叠加。</p>
    <p v-if="!filtered.length">这一类暂时没有记录，可以切换模块或类型。</p>
    <details v-for="group in groups" :key="group.name" class="review-group" :open="module !== '全部' || type !== '全部'">
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
.review-catalog { margin: 28px 0; }
.filters { display: flex; align-items: end; flex-wrap: wrap; gap: 18px 24px; padding-bottom: 18px; border-bottom: 2px solid var(--vp-c-divider); }
.filters label { display: grid; gap: 8px; font-size: 18px; font-weight: 700; }
.filters select { min-width: 170px; padding: 10px 36px 10px 12px; border: 1px solid var(--vp-c-text-2); border-radius: 6px; color: var(--vp-c-text-1); background: var(--vp-c-bg); font: inherit; appearance: auto; }
.reset { color: var(--vp-c-brand-1); padding: 10px 0; font: inherit; font-size: 18px; text-decoration: underline; }
.filters :focus-visible, summary:focus-visible, .question-link:focus-visible { outline: 3px solid var(--vp-c-brand-1); outline-offset: 4px; }
.result-count { color: var(--vp-c-text-2); font-size: 18px; }
.review-group { margin: 0; border-bottom: 1px solid var(--vp-c-divider); }
.review-group summary { cursor: pointer; padding: 20px 8px; font-size: 24px; font-weight: 700; }
.review-group summary span { margin-left: 12px; color: var(--vp-c-text-2); font-size: 18px; font-weight: 400; }
.question-list { list-style: none; margin: 0; padding: 0 8px 12px; }
.question-list li { padding: 20px 0; margin: 0; border-top: 1px solid var(--vp-c-divider); }
.question-tags { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; }
.review-tag { display: inline-block; padding: 2px 9px; border: 1px solid currentColor; border-radius: 4px; font-size: 17px; line-height: 1.6; font-weight: 700; }
.wrong { color: #b42318; }.uncertain { color: #7a4d00; }.guess { color: #6b46a1; }.slow { color: #175d64; }.neutral { color: var(--vp-c-text-2); }
.question-link { display: block; font-size: 22px; line-height: 1.65; overflow-wrap: anywhere; }
.question-meta, .question-note { color: var(--vp-c-text-2); font-size: 17px; line-height: 1.7; margin: 6px 0 0; }
:global(.dark) .wrong { color: #ffb4ab; }:global(.dark) .uncertain { color: #f4ce83; }:global(.dark) .guess { color: #d4b8ff; }:global(.dark) .slow { color: #97d7dc; }
@media (max-width: 640px) { .filters { display: grid; grid-template-columns: 1fr 1fr; gap: 16px 12px; }.filters select { width: 100%; min-width: 0; }.reset { text-align: left; }.review-group summary { padding: 18px 2px; }.question-list { padding-left: 2px; padding-right: 2px; } }
</style>
