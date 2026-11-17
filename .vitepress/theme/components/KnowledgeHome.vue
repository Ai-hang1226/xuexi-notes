<script setup>
import { withBase } from 'vitepress'
import skillPool from '../../../retest/xingcezhenti-pool.json'

const base = (path) => withBase(path)
const skillYears = `${skillPool.fromYear}—${skillPool.throughYear} 年技能真题`

const practices = [
  {
    name: '行测测验',
    label: '20 题 · 交卷自动判分',
    detail: `已做题、本站题库与${skillYears}`,
    action: '开始测验',
    path: '/retest/?start=1',
    primary: true,
  },
  {
    name: '申论复测',
    label: '重写已做过的题',
    detail: '保存每次作答，回看自己的变化',
    action: '选择题目',
    path: '/retest/essay.html',
  },
  {
    name: '错题复盘',
    label: '按模块查看错题',
    detail: '从错因和知识点回到对应原题',
    action: '打开错题本',
    path: '/cuotiben/',
  },
]

</script>

<template>
  <main class="knowledge-home">
    <header class="home-intro">
      <span class="home-kicker">公考知识库 · 学习入口</span>
      <h1>今天，想复习哪一块？</h1>
      <p>三个入口：行测混合测验、申论重写复测、错题逐题回看。</p>
    </header>

    <nav class="home-practices" aria-label="测验与复习入口">
      <a
        v-for="item in practices"
        :key="item.name"
        class="practice-card"
        :class="{ 'practice-card--primary': item.primary }"
        :href="base(item.path)"
      >
        <span class="practice-card__label">{{ item.label }}</span>
        <strong>{{ item.name }}</strong>
        <span class="practice-card__detail">{{ item.detail }}</span>
        <span class="practice-card__action">{{ item.action }} <span aria-hidden="true">→</span></span>
      </a>
    </nav>

  </main>
</template>

<style scoped>
.knowledge-home {
  --home-accent: var(--vp-c-brand-1);
  --home-accent-soft: var(--vp-c-brand-soft);
  --home-accent-border: color-mix(in srgb, var(--home-accent) 24%, var(--vp-c-divider));
  --home-action: var(--vp-c-brand-1);
  display: flex;
  flex-direction: column;
  justify-content: center;
  width: min(1120px, 100%);
  min-height: calc(100svh - var(--vp-nav-height) - 100px);
  margin: 0 auto;
  padding: 30px clamp(18px, 2.5vw, 36px) 28px;
  color: var(--vp-c-text-1);
  font-family: var(--vp-font-family-base);
}
.knowledge-home a { color: inherit; text-decoration: none; }
.home-intro { margin-bottom: 20px; }
.home-kicker { color: var(--home-accent); font-size: 12px; font-weight: 750; letter-spacing: .025em; }
.home-intro h1 { margin: 8px 0 7px; border: 0; padding: 0; font-size: clamp(27px, 3vw, 36px); line-height: 1.25; letter-spacing: -.025em; }
.home-intro p { margin: 0; color: var(--vp-c-text-2); font-size: 14px; line-height: 1.7; }
.home-practices { display: grid; grid-template-columns: 1.12fr 1fr 1fr; gap: 12px; margin-bottom: 30px; }
.practice-card { display: grid; align-content: start; gap: 7px; min-width: 0; min-height: 166px; padding: 18px 19px 15px; border: 1px solid var(--vp-c-divider); border-radius: 13px; background: var(--vp-c-bg); transition: transform .16s ease, border-color .16s ease, background .16s ease, box-shadow .16s ease; }
.practice-card:hover { transform: translateY(-2px); border-color: var(--home-accent); background: var(--home-accent-soft); box-shadow: 0 8px 20px color-mix(in srgb, var(--home-accent) 10%, transparent); }
.practice-card__label { color: var(--home-accent); font-size: 11px; font-weight: 700; }
.practice-card > strong { font-size: 20px; line-height: 1.3; }
.practice-card__detail { min-height: 34px; color: var(--vp-c-text-2); font-size: 12px; line-height: 1.5; }
.practice-card__action { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: auto; padding-top: 8px; color: var(--home-accent); font-size: 12px; font-weight: 750; }
.practice-card--primary { border-color: var(--home-accent); color: #fff; background: var(--home-action); box-shadow: 0 8px 22px color-mix(in srgb, var(--home-action) 18%, transparent); }
.practice-card--primary:hover { background: var(--vp-c-brand-2); }
.practice-card--primary > strong, .practice-card--primary .practice-card__label, .practice-card--primary .practice-card__detail, .practice-card--primary .practice-card__action { color: #fff !important; }
.knowledge-home a:focus-visible { outline: 3px solid var(--home-accent); outline-offset: 3px; border-radius: 5px; }
:global(.dark .knowledge-home) { --home-action: #315DCB; }
:global(.dark .practice-card--primary:hover) { background: #274eae; }
@media (max-width: 760px) {
  .knowledge-home { padding: 23px 16px 10px; }
  .home-practices { grid-template-columns: 1fr; gap: 9px; margin-bottom: 23px; }
  .practice-card { min-height: 0; padding: 14px 15px 12px; }
  .practice-card__detail { min-height: 0; }
  .practice-card__action { padding-top: 2px; }
}
@media (max-width: 480px) {
  .knowledge-home { padding-right: 13px; padding-left: 13px; }
  .home-intro h1 { font-size: 26px; }
  .home-intro p { font-size: 13px; }
}
@media (prefers-reduced-motion: reduce) {
  .knowledge-home *, .knowledge-home *::before, .knowledge-home *::after { scroll-behavior: auto !important; transition-duration: .01ms !important; }
}
</style>
