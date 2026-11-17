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

const xingceModules = [
  { name: '政治理论', hint: '重点表述与章节导航', path: '/xingce/zhengzhi-lilun' },
  { name: '言语理解', hint: '体系导航与方法库', path: '/xingce/yanyu-lijie' },
  { name: '数量关系', hint: '题型方法与考场选法', path: '/xingce/shuliang-guanxi' },
  { name: '判断推理', hint: '图形、定义、类比、逻辑', path: '/xingce/panduan-tuili' },
  { name: '资料分析', hint: '方法体系与读数速查', path: '/xingce/ziliao-fenxi' },
  { name: '常识判断', hint: '知识范围与积累笔记', path: '/xingce/changshi-panduan' },
]

const shenlunTopics = [
  { name: '归纳概括', path: '/shenlun/guina-gaikuo' },
  { name: '综合分析', path: '/shenlun/zonghe-fenxi' },
  { name: '问题对策', path: '/shenlun/wenti-duice' },
  { name: '公文写作', path: '/shenlun/gongwen-geshi' },
  { name: '文章写作', path: '/shenlun/wenzhang-xiezuo' },
]

</script>

<template>
  <main class="knowledge-home">
    <header class="home-intro">
      <span class="home-kicker">公考知识库 · 学习入口</span>
      <h1>今天，想复习哪一块？</h1>
      <p>上方开始测验或复盘，下方按行测模块、申论题型查阅知识。</p>
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

    <section class="home-library" aria-labelledby="library-title">
      <div class="library-heading">
        <div>
          <span class="home-kicker">知识库查阅</span>
          <h2 id="library-title">按模块继续学习</h2>
        </div>
        <p>复习入口在上方；需要找方法、例题和讲解时，从这里进入。</p>
      </div>

      <div class="library-grid">
        <section class="library-section" aria-labelledby="xingce-library-title">
          <div class="library-section__heading">
            <h3 id="xingce-library-title">行测知识</h3>
            <a :href="base('/xingce/图解速查')">跨模块图解 <span aria-hidden="true">↗</span></a>
          </div>
          <nav class="knowledge-links" aria-label="行测知识模块">
            <a v-for="item in xingceModules" :key="item.name" :href="base(item.path)" class="knowledge-link">
              <span><strong>{{ item.name }}</strong><small>{{ item.hint }}</small></span>
              <span class="knowledge-link__arrow" aria-hidden="true">↗</span>
            </a>
          </nav>
        </section>

        <section class="library-section" aria-labelledby="shenlun-library-title">
          <div class="library-section__heading">
            <h3 id="shenlun-library-title">申论知识</h3>
            <a :href="base('/shenlun/kiwi-framework')">学习总纲 <span aria-hidden="true">↗</span></a>
          </div>
          <nav class="knowledge-links knowledge-links--essay" aria-label="申论题型知识">
            <a v-for="item in shenlunTopics" :key="item.name" :href="base(item.path)" class="knowledge-link">
              <span><strong>{{ item.name }}</strong><small>方法梳理与真题训练</small></span>
              <span class="knowledge-link__arrow" aria-hidden="true">↗</span>
            </a>
            <a :href="base('/shenlun/scores')" class="knowledge-link knowledge-link--progress">
              <span><strong>评分与进步</strong><small>首答、改写和迁移记录</small></span>
              <span class="knowledge-link__arrow" aria-hidden="true">↗</span>
            </a>
          </nav>
        </section>
      </div>
    </section>

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
.home-library { margin-top: 2px; }
.library-heading { display: flex; align-items: end; justify-content: space-between; gap: 18px; margin-bottom: 12px; }
.library-heading h2 { margin: 4px 0 0; font-size: 19px; line-height: 1.35; }
.library-heading > p { margin: 0 0 2px; color: var(--vp-c-text-2); font-size: 12px; line-height: 1.5; }
.library-grid { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(300px, .85fr); gap: 13px; }
.library-section { min-width: 0; padding: 15px 16px 16px; border: 1px solid var(--vp-c-divider); border-radius: 13px; background: var(--vp-c-bg); }
.library-section__heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.library-section__heading h3 { margin: 0; font-size: 15px; line-height: 1.4; }
.library-section__heading > a { flex: 0 0 auto; color: var(--home-accent); font-size: 11px; font-weight: 700; text-decoration: none; }
.knowledge-links { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }
.knowledge-link { display: flex; align-items: center; justify-content: space-between; gap: 9px; min-width: 0; min-height: 49px; padding: 7px 9px; border: 1px solid var(--vp-c-divider); border-radius: 9px; transition: border-color .16s, background .16s, transform .16s; }
.knowledge-link:hover { transform: translateY(-1px); border-color: var(--home-accent-border); background: var(--home-accent-soft); }
.knowledge-link > span:first-child { display: grid; gap: 2px; min-width: 0; }
.knowledge-link strong { overflow: hidden; font-size: 12px; line-height: 1.35; text-overflow: ellipsis; }
.knowledge-link small { overflow: hidden; color: var(--vp-c-text-2); font-size: 10px; line-height: 1.35; text-overflow: ellipsis; white-space: nowrap; }
.knowledge-link__arrow { flex: 0 0 auto; color: var(--home-accent); font-size: 11px; }
.knowledge-link--progress { grid-column: 1 / -1; }
.knowledge-home a:focus-visible { outline: 3px solid var(--home-accent); outline-offset: 3px; border-radius: 5px; }
:global(.dark .knowledge-home) { --home-action: #315DCB; }
:global(.dark .practice-card--primary:hover) { background: #274eae; }
@media (max-width: 760px) {
  .knowledge-home { padding: 23px 16px 10px; }
  .home-practices { grid-template-columns: 1fr; gap: 9px; margin-bottom: 23px; }
  .practice-card { min-height: 0; padding: 14px 15px 12px; }
  .practice-card__detail { min-height: 0; }
  .practice-card__action { padding-top: 2px; }
  .library-grid { grid-template-columns: minmax(0, 1fr); gap: 10px; }
}
@media (max-width: 480px) {
  .knowledge-home { padding-right: 13px; padding-left: 13px; }
  .home-intro h1 { font-size: 26px; }
  .home-intro p { font-size: 13px; }
  .library-heading { align-items: flex-start; flex-direction: column; gap: 4px; }
  .library-section { padding: 13px 11px; }
  .knowledge-links { gap: 6px; }
  .knowledge-link { min-height: 46px; padding: 7px 8px; }
  .knowledge-link strong { font-size: 11px; }
  .knowledge-link small { font-size: 9px; }
}
@media (prefers-reduced-motion: reduce) {
  .knowledge-home *, .knowledge-home *::before, .knowledge-home *::after { scroll-behavior: auto !important; transition-duration: .01ms !important; }
}
</style>
