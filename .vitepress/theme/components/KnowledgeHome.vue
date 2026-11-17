<script setup>
import { withBase } from 'vitepress'
import d from '../../../data/dashboard.json'
import quizArchive from '../../../daily-quizzes/archive-data.json'
import skillPool from '../../../retest/xingcezhenti-pool.json'

const base = (path) => withBase(path)
const latest = d.quizzes.latest
const latestAssessment = [...quizArchive.assessments].sort((a, b) => b.date.localeCompare(a.date))[0]
const latestAssessmentReview = latestAssessment?.links.find(({ label }) => /题.*复盘/.test(label))?.href
  || latestAssessment?.links.find(({ label }) => label === '结果与批改')?.href
  || '/guide/archive'
const skillYears = `${skillPool.fromYear}—${skillPool.throughYear} 年 · 六大模块技能真题`

const modules = [
  { name: '政治理论', path: '/xingce/zhengzhi-lilun', hint: '章节导航 · 重点表述' },
  { name: '言语理解', path: '/xingce/yanyu-lijie', hint: '体系导航 · 方法库' },
  { name: '数量关系', path: '/xingce/shuliang-guanxi', hint: '章节导航 · 考场选法' },
  { name: '判断推理', path: '/xingce/panduan-tuili', hint: '图形 · 定义 · 类比 · 逻辑' },
  { name: '资料分析', path: '/xingce/ziliao-fenxi', hint: '方法体系 · 读数速查' },
  { name: '常识判断', path: '/xingce/changshi-panduan', hint: '知识范围 · 积累笔记' },
]

const essayLinks = [
  { name: '归纳概括', path: '/shenlun/guina-gaikuo' },
  { name: '综合分析', path: '/shenlun/zonghe-fenxi' },
  { name: '问题对策', path: '/shenlun/wenti-duice' },
  { name: '公文写作', path: '/shenlun/gongwen-geshi' },
  { name: '文章写作', path: '/shenlun/wenzhang-xiezuo' },
]

const quickActions = [
  { name: '每日测验', hint: '试卷与批改', path: '/daily-quizzes/' },
  { name: '错题复盘', hint: '按模块筛选', path: '/cuotiben/' },
  { name: '最近整卷复盘', hint: latestAssessment ? `${latestAssessment.date} · ${latestAssessment.title}` : '查看整卷与阶段测评', path: latestAssessmentReview },
]
</script>

<template>
  <div class="knowledge-home">
    <div class="home-hero">
      <header class="home-intro">
        <span class="home-kicker">公考知识库 · 学习入口</span>
        <h1>把知识找到，把练习接上</h1>
        <p>行测六大模块、申论五类题型，学习和复盘从这里继续。</p>
      </header>

      <a class="home-practice" :href="base('/retest/?start=1')" aria-label="开始20题行测真题复测">
        <span class="practice-label">随时开始 · 交卷自动判分</span>
        <strong>行测真题复测 <span>20 题</span></strong>
        <span class="practice-detail">{{ skillYears }} · 曾错题优先</span>
        <span class="practice-action">开始作答 <span aria-hidden="true">→</span></span>
      </a>
    </div>

    <nav class="home-quick-access" aria-label="其他常用入口">
      <a v-for="item in quickActions" :key="item.name" class="quick-action" :href="base(item.path)">
        <span class="quick-action__copy"><b>{{ item.name }}</b><small>{{ item.hint }}</small></span>
        <span class="quick-action__arrow" aria-hidden="true">↗</span>
      </a>
    </nav>

    <div class="home-layout">
      <div class="home-directory" aria-label="知识目录">
        <section class="home-section home-section--xingce">
          <div class="section-heading">
            <h2>行测知识</h2>
            <a class="section-more" :href="base('/xingce/图解速查')">跨模块图解速查 <span aria-hidden="true">↗</span></a>
          </div>
          <div class="module-grid">
            <a v-for="item in modules" :key="item.name" class="module-link" :href="base(item.path)">
              <span class="module-link__name">{{ item.name }} <span aria-hidden="true">↗</span></span>
              <span class="module-link__hint">{{ item.hint }}</span>
            </a>
          </div>
        </section>

        <div class="home-section-grid">
          <section class="home-section">
            <div class="section-heading">
              <h2>申论训练</h2>
              <a class="section-more" :href="base('/shenlun/kiwi-framework')">学习总纲 <span aria-hidden="true">↗</span></a>
            </div>
            <div class="essay-links">
              <a v-for="item in essayLinks" :key="item.name" :href="base(item.path)">{{ item.name }}<span aria-hidden="true">→</span></a>
            </div>
            <div class="section-foot-links">
              <a :href="base('/shenlun/五大题型导航')">五大题型导航</a>
              <a :href="base('/shenlun/scores')">评分与进步</a>
            </div>
          </section>

          <section class="home-section">
            <div class="section-heading"><h2>阶段回看</h2></div>
            <div class="stage-links">
              <a :href="base('/daily-quizzes/2026-11-04-jiangsu-a-assessment-review')">
                <b>江苏 A 类阶段测评</b><span>结果、用时与复盘边界</span>
              </a>
              <a :href="base('/shenlun/scores')">
                <b>申论评分与进步</b><span>首答、改写和迁移分别记录</span>
              </a>
            </div>
          </section>
        </div>

        <section class="home-section home-section--resources">
          <div class="section-heading"><h2>工具与资料</h2></div>
          <div class="resource-links">
            <a :href="base('/tools/')">速算工具箱</a>
            <a :href="base('/jiangsu/printable.html')">江苏 A4 打印讲义</a>
            <a :href="base('/guide/')">全站地图</a>
            <a :href="base('/guide/help')">使用指南</a>
            <a :href="base('/guide/changelog')">内容更新记录</a>
            <a :href="base('/share/')">精选导读</a>
          </div>
        </section>
      </div>

      <aside class="home-status" aria-labelledby="recent-status-title">
        <div class="status-heading">
          <h2 id="recent-status-title">最近状态</h2>
          <span>更新于 {{ d.generatedAt }}</span>
        </div>

        <div v-if="latest" class="latest-quiz">
          <div class="latest-quiz__top"><span>最新日常测验</span><strong>{{ latest.date }}</strong></div>
          <p>{{ latest.status }}</p>
          <a :href="base(latest.testUrl || '/daily-quizzes/')">查看本卷 <span aria-hidden="true">↗</span></a>
        </div>
        <div v-else class="latest-quiz latest-quiz--empty">
          <span>日常测验记录</span>
          <strong>暂无记录</strong>
          <a :href="base('/daily-quizzes/')">打开测验目录 <span aria-hidden="true">↗</span></a>
        </div>

        <div class="status-stats" aria-label="学习记录统计">
          <div><b>{{ d.quizzes.reviewed }}</b><span>已批改测验</span></div>
          <div><b>{{ d.quizzes.pending }}</b><span>可回看旧卷</span></div>
          <div><b>{{ d.questions.total }}</b><span>错题记录</span></div>
        </div>

        <div class="status-progress">
          <strong>复测验证</strong><b>完成 {{ d.retests.done }} 项</b>
        </div>
        <p class="status-note">未作答旧卷不计欠账；复测完成不代表独立掌握。</p>
        <a class="status-link" :href="base('/daily-quizzes/#复测安排')">查看复测安排 <span aria-hidden="true">→</span></a>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.knowledge-home {
  --home-accent: #4f46e5;
  --home-accent-soft: rgba(79, 70, 229, .08);
  --home-accent-border: rgba(79, 70, 229, .24);
  width: min(1280px, 100%);
  margin: 0 auto;
  padding: 28px clamp(18px, 2.5vw, 36px) 0;
  color: var(--vp-c-text-1);
  font-family: var(--vp-font-family-base);
}
.knowledge-home a { color: inherit; text-decoration: none; }
.home-hero { display: grid; grid-template-columns: minmax(0, 1fr) minmax(310px, .82fr); align-items: center; gap: 34px; margin-bottom: 18px; }
.home-intro { min-width: 0; }
.home-kicker { color: var(--home-accent); font-size: 12px; font-weight: 700; }
.home-intro h1 { margin: 9px 0 8px; border: 0; padding: 0; font-size: clamp(29px, 3vw, 38px); line-height: 1.25; letter-spacing: -.025em; }
.home-intro p { max-width: 640px; margin: 0; color: var(--vp-c-text-2); font-size: 15px; line-height: 1.7; }
.home-practice { display: grid; gap: 8px; min-width: 0; padding: 17px 19px; border: 1px solid var(--home-accent-border); border-radius: 14px; background: #f7f7ff; transition: background .16s, border-color .16s; }
.home-practice:hover { border-color: var(--home-accent); background: #f1f0ff; }
.practice-label { color: var(--home-accent); font-size: 12px; font-weight: 700; }
.home-practice > strong { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; font-size: 20px; line-height: 1.35; }
.home-practice > strong span { color: var(--home-accent); font-size: 15px; font-variant-numeric: tabular-nums; }
.practice-detail { color: var(--vp-c-text-2); font-size: 12px; line-height: 1.5; }
.practice-action { display: flex; align-items: center; justify-content: space-between; margin-top: 2px; padding: 9px 11px; border-radius: 8px; color: #fff; background: var(--home-accent); font-size: 13px; font-weight: 700; }
.home-practice:hover .practice-action { background: #4338ca; }
.home-quick-access { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); margin: 0 0 16px; border-top: 1px solid var(--vp-c-divider); border-bottom: 1px solid var(--vp-c-divider); }
.quick-action { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-width: 0; min-height: 56px; padding: 8px 14px; }
.quick-action + .quick-action { border-left: 1px solid var(--vp-c-divider); }
.quick-action:hover { color: var(--home-accent); background: var(--home-accent-soft); }
.quick-action__copy { display: grid; gap: 2px; min-width: 0; }
.quick-action__copy b { font-size: 14px; line-height: 1.4; }
.quick-action__copy small { overflow: hidden; color: var(--vp-c-text-2); font-size: 11px; line-height: 1.35; text-overflow: ellipsis; white-space: nowrap; }
.quick-action__arrow { flex: 0 0 auto; color: var(--home-accent); font-size: 13px; }
.home-layout { display: grid; grid-template-columns: minmax(0, 1fr) 276px; align-items: start; gap: 20px; }
.home-directory { display: grid; gap: 14px; min-width: 0; }
.home-section { min-width: 0; padding: 19px 20px; border: 1px solid var(--vp-c-divider); border-radius: 13px; background: var(--vp-c-bg); }
.section-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 13px; }
.section-heading h2 { margin: 0; font-size: 19px; line-height: 1.35; }
.section-more { flex: 0 0 auto; color: var(--home-accent) !important; font-size: 12px; font-weight: 650; }
.module-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.module-link { display: grid; gap: 4px; min-width: 0; padding: 10px 12px; border: 1px solid var(--vp-c-divider); border-radius: 9px; background: var(--vp-c-bg); transition: border-color .16s, background .16s; }
.module-link:hover, .essay-links a:hover { border-color: var(--home-accent-border); background: var(--home-accent-soft); }
.module-link__name { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 15px; font-weight: 700; }
.module-link__name > span { color: var(--home-accent); font-size: 12px; }
.module-link__hint { color: var(--vp-c-text-2); font-size: 12px; line-height: 1.45; }
.home-section-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.essay-links { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }
.essay-links a { display: flex; align-items: center; justify-content: space-between; gap: 7px; padding: 8px 10px; border: 1px solid var(--vp-c-divider); border-radius: 8px; font-size: 13px; font-weight: 650; transition: border-color .16s, background .16s; }
.essay-links a span { color: var(--home-accent); }
.section-foot-links { display: flex; flex-wrap: wrap; gap: 7px 15px; margin-top: 11px; padding-top: 10px; border-top: 1px solid var(--vp-c-divider); }
.section-foot-links a, .status-link { color: var(--home-accent) !important; font-size: 12px; font-weight: 650; }
.stage-links { display: grid; }
.stage-links a { display: grid; gap: 3px; padding: 9px 0; border-bottom: 1px solid var(--vp-c-divider); }
.stage-links a:first-child { padding-top: 1px; }
.stage-links a:last-child { padding-bottom: 0; border-bottom: 0; }
.stage-links a:hover b { color: var(--home-accent); }
.stage-links b { font-size: 13px; }
.stage-links span { color: var(--vp-c-text-2); font-size: 11px; line-height: 1.45; }
.resource-links { display: flex; flex-wrap: wrap; gap: 6px 18px; }
.resource-links a { color: var(--vp-c-text-2); font-size: 12px; }
.resource-links a:hover { color: var(--home-accent); }
.home-status { position: sticky; top: calc(var(--vp-nav-height) + 20px); padding: 17px 18px; border: 1px solid var(--vp-c-divider); border-radius: 13px; background: var(--vp-c-bg); }
.status-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; padding-bottom: 11px; border-bottom: 1px solid var(--vp-c-divider); }
.status-heading h2 { margin: 0; font-size: 18px; }
.status-heading > span { color: var(--vp-c-text-2); font-size: 10px; white-space: nowrap; }
.latest-quiz { display: grid; gap: 5px; padding: 13px 0; border-bottom: 1px solid var(--vp-c-divider); }
.latest-quiz__top { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.latest-quiz__top > span, .latest-quiz--empty > span { color: var(--vp-c-text-2); font-size: 11px; }
.latest-quiz__top strong { font-size: 16px; font-variant-numeric: tabular-nums; }
.latest-quiz p { margin: 0; font-size: 12px; line-height: 1.5; }
.latest-quiz > a { margin-top: 2px; color: var(--home-accent) !important; font-size: 12px; font-weight: 650; }
.latest-quiz--empty strong { font-size: 15px; }
.status-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); padding: 12px 0; border-bottom: 1px solid var(--vp-c-divider); }
.status-stats > div { display: grid; align-content: start; gap: 3px; min-width: 0; padding: 0 7px; }
.status-stats > div:first-child { padding-left: 0; }
.status-stats > div + div { border-left: 1px solid var(--vp-c-divider); }
.status-stats b { color: var(--home-accent); font-size: 18px; line-height: 1.15; font-variant-numeric: tabular-nums; }
.status-stats span { color: var(--vp-c-text-2); font-size: 10px; line-height: 1.4; }
.status-progress { display: flex; justify-content: space-between; gap: 8px; margin: 12px 0 4px; font-size: 12px; }
.status-progress b { font-variant-numeric: tabular-nums; }
.status-note { margin: 0 0 8px; color: var(--vp-c-text-2); font-size: 11px; line-height: 1.5; }
.status-link { display: inline-flex; align-items: center; gap: 6px; }
.knowledge-home a:focus-visible { outline: 3px solid var(--home-accent); outline-offset: 3px; border-radius: 4px; }
:global(.dark .knowledge-home) { --home-accent: #a5b4fc; --home-accent-soft: rgba(165, 180, 252, .12); --home-accent-border: rgba(165, 180, 252, .35); }
:global(.dark .home-practice) { background: #202139; }
:global(.dark .home-practice:hover) { background: #282849; }
@media (max-width: 1040px) {
  .home-layout { grid-template-columns: minmax(0, 1fr); }
  .home-status { position: static; }
}
@media (max-width: 760px) {
  .knowledge-home { padding: 20px 16px 0; }
  .home-hero { grid-template-columns: minmax(0, 1fr); gap: 14px; }
  .home-intro h1 { font-size: clamp(27px, 6vw, 34px); }
  .home-quick-access { margin-bottom: 13px; }
  .home-layout, .home-directory { gap: 12px; }
  .home-section { padding: 16px; }
  .home-section-grid { gap: 12px; }
  .module-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 480px) {
  .knowledge-home { padding-right: 13px; padding-left: 13px; }
  .home-intro h1 { font-size: 27px; }
  .home-practice { padding: 15px; }
  .quick-action { min-height: 52px; padding: 7px 8px; }
  .quick-action__copy b { font-size: 12px; }
  .quick-action__copy small { display: none; }
  .quick-action__arrow { font-size: 11px; }
  .home-section { padding: 14px 12px; border-radius: 11px; }
  .section-heading { align-items: flex-start; }
  .section-heading h2 { font-size: 18px; }
  .section-more { padding-top: 3px; font-size: 11px; }
  .module-grid { gap: 7px; }
  .module-link { padding: 9px 8px; }
  .module-link__name { font-size: 13px; }
  .module-link__hint { font-size: 11px; }
  .essay-links { gap: 6px; }
  .essay-links a { padding: 8px; font-size: 12px; }
  .home-status { padding: 15px 13px; }
}
@media (prefers-reduced-motion: reduce) {
  .knowledge-home *, .knowledge-home *::before, .knowledge-home *::after { scroll-behavior: auto !important; transition-duration: .01ms !important; }
}
</style>
