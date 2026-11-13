<script setup>
import { withBase } from 'vitepress'
import dashboard from '../../data/dashboard.json'

const latest = dashboard.quizzes.latest
const base = (path) => withBase(path)
</script>

<template>
  <section class="latest-card" aria-label="最近正式测验">
    <div class="latest-card__copy">
      <span class="latest-card__eyebrow">最近登记的正式卷</span>
      <template v-if="latest">
        <strong class="latest-card__date">{{ latest.date }}</strong>
        <p>{{ latest.status }}</p>
      </template>
      <template v-else>
        <strong class="latest-card__date">暂无正式测验记录</strong>
        <p>打开测验目录查看已发布的试卷。</p>
      </template>
    </div>
    <div class="latest-card__actions">
      <a v-if="latest?.testUrl" class="latest-card__primary" :href="base(latest.testUrl)">回看最近试卷 <span>↗</span></a>
      <a class="latest-card__secondary" :href="base('/daily-quizzes/')">查看全部测验记录</a>
    </div>
  </section>
</template>

<style scoped>
.latest-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin: 20px 0 24px;
  padding: 20px 22px;
  border: 1px solid #d9dcf7;
  border-radius: 14px;
  background: linear-gradient(115deg, var(--vp-c-bg-soft), var(--vp-c-bg));
}
.latest-card__eyebrow { color: var(--vp-c-text-2); font-size: 13px; }
.latest-card__date { display: block; margin: 4px 0 2px; font-size: 22px; line-height: 1.35; font-variant-numeric: tabular-nums; }
.latest-card p { margin: 0; font-size: 14px; }
.latest-card__actions { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; }
.latest-card__actions a { text-decoration: none; font-size: 14px; font-weight: 700; }
.latest-card__primary { padding: 10px 14px; border-radius: 9px; color: #fff !important; background: #4f46e5; }
.latest-card__primary:hover { background: #4338ca; }
.latest-card__secondary { color: #4f46e5; }
:global(.dark .latest-card){ border-color: #454b78; }
:global(.dark .latest-card__secondary){ color: #b8b5ff; }
@media (max-width: 640px) {
  .latest-card { align-items: stretch; flex-direction: column; gap: 14px; margin: 16px 0 20px; padding: 17px; }
  .latest-card__actions { align-items: flex-start; }
}
</style>
