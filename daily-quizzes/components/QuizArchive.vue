<script setup>
import { withBase } from 'vitepress'
import archive from '../archive-data.json'

const { assessments: assessmentRecords, months } = archive

const statusClass = (status) => status === '已批改' ? 'is-reviewed' : status === '休息存档' ? 'is-rest' : 'is-pending'
</script>

<template>
  <div class="quiz-archive">
    <section aria-labelledby="assessment-heading">
      <h2 id="assessment-heading">阶段测评与整卷结果</h2>
      <div class="assessment-grid">
        <article v-for="item in assessmentRecords" :key="item.date" class="assessment-card">
          <header class="assessment-card__heading">
            <div><time :datetime="item.date">{{ item.date }}</time><h3>{{ item.title }}</h3></div>
            <strong>{{ item.result }}</strong>
          </header>
          <p class="assessment-card__time">{{ item.time }}</p>
          <p class="assessment-card__note">{{ item.note }}</p>
          <nav class="record-links" :aria-label="`${item.title}相关记录`">
            <a v-for="link in item.links" :key="link.href" :href="withBase(link.href)">{{ link.label }}</a>
          </nav>
        </article>
      </div>
    </section>

    <section aria-labelledby="quiz-records-heading">
      <h2 id="quiz-records-heading">正式测验</h2>
      <p class="archive-note">按归档日期查看。未作答旧卷不记零分，也不形成补答任务。</p>
      <section v-for="month in months" :key="month.label" class="month-section" :aria-label="month.label">
        <h3>{{ month.label }}</h3>
        <div class="quiz-grid">
          <article v-for="item in month.records" :key="item.date" class="quiz-card">
            <div class="quiz-card__heading">
              <time :datetime="item.date">{{ item.date }}</time>
              <span class="quiz-status" :class="statusClass(item.status)">{{ item.status }}</span>
            </div>
            <p v-if="item.detail" class="quiz-card__detail">{{ item.detail }}</p>
            <nav class="record-links" :aria-label="`${item.date}测验相关记录`">
              <a v-for="[label, href] in item.links" :key="href" :href="withBase(href)">{{ label }}</a>
            </nav>
          </article>
        </div>
      </section>
    </section>
  </div>
</template>

<style scoped>
.quiz-archive { display: grid; gap: 30px; margin: 24px 0 36px; }
.quiz-archive h2 { margin: 0 0 12px; border: 0; padding: 0; }
.assessment-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.assessment-card, .quiz-card { min-width: 0; padding: 16px; border: 1px solid var(--vp-c-divider); border-radius: 12px; background: var(--vp-c-bg-soft); }
.assessment-card__heading { display: grid; gap: 6px; }
.assessment-card__heading > div { display: flex; align-items: baseline; flex-wrap: wrap; gap: 5px 12px; }
.assessment-card__heading time, .quiz-card__heading time { color: var(--vp-c-text-2); font-size: 14px; font-variant-numeric: tabular-nums; }
.assessment-card__heading h3 { margin: 0; font-size: 17px; line-height: 1.45; }
.assessment-card__heading strong { color: var(--vp-c-brand-1); font-size: 16px; line-height: 1.55; }
.assessment-card__time { margin: 8px 0 3px; font-size: 14px; font-weight: 650; line-height: 1.55; }
.assessment-card__note { margin: 0; color: var(--vp-c-text-2); font-size: 14px; line-height: 1.65; }
.archive-note { margin: 0 0 12px; color: var(--vp-c-text-2); font-size: 14px; line-height: 1.6; }
.month-section + .month-section { margin-top: 18px; }
.month-section > h3 { margin: 0 0 10px; font-size: 17px; }
.quiz-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.quiz-card__heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.quiz-status { display: inline-flex; align-items: center; min-height: 26px; padding: 2px 9px; border-radius: 7px; font-size: 13px; font-weight: 650; white-space: nowrap; }
.quiz-status::before { width: 6px; height: 6px; margin-right: 6px; border-radius: 50%; background: currentColor; content: ""; }
.quiz-status.is-reviewed { color: #236b4f; background: #e4f4eb; }
.quiz-status.is-pending { color: var(--vp-c-text-2); background: var(--vp-c-default-soft); }
.quiz-status.is-rest { color: #445995; background: #e9edfa; }
.quiz-card__detail { margin: 9px 0 0; font-size: 15px; font-weight: 650; line-height: 1.5; }
.record-links { display: flex; flex-wrap: wrap; gap: 7px 12px; margin-top: 11px; padding-top: 10px; border-top: 1px solid var(--vp-c-divider); }
.record-links a { color: var(--vp-c-brand-1); font-size: 14px; font-weight: 650; line-height: 1.5; text-decoration: none; }
.record-links a:hover { text-decoration: underline; text-underline-offset: 3px; }
.record-links a:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 3px; border-radius: 2px; }
.dark .quiz-status.is-reviewed { color: #bce6cf; background: #244936; }
.dark .quiz-status.is-rest { color: #cbd6ff; background: #293458; }

@media (max-width: 700px) {
  .assessment-grid, .quiz-grid { grid-template-columns: minmax(0, 1fr); }
  .assessment-card, .quiz-card { padding: 14px; }
}
</style>
