<script setup>
import { withBase } from 'vitepress'
import d from '../../../data/dashboard.json'

const base = (path) => withBase(path)
const latest = d.quizzes.latest
const retestProgress = d.retests.total ? Math.round((d.retests.done / d.retests.total) * 100) : 0

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
</script>

<template>
  <div class="knowledge-home">
    <header class="home-intro">
      <span class="home-kicker">PERSONAL EXAM KNOWLEDGE BASE</span>
      <h1>把知识找到，把练习接上</h1>
      <p>行测六大模块、申论五类题型，以及真题练习和复盘记录。先按目录进入，需要时再看最近状态。</p>
    </header>

    <div class="home-layout">
      <div class="home-directory" aria-label="知识目录">
        <section class="home-section home-section--xingce">
          <div class="section-heading">
            <div><span class="section-index">01</span><h2>行测知识</h2></div>
            <a class="section-more" :href="base('/xingce/图解速查')">跨模块图解速查 <span>↗</span></a>
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
              <div><span class="section-index">02</span><h2>申论训练</h2></div>
              <a class="section-more" :href="base('/shenlun/kiwi-framework')">先看总纲 <span>↗</span></a>
            </div>
            <div class="essay-links">
              <a v-for="item in essayLinks" :key="item.name" :href="base(item.path)">{{ item.name }}<span>→</span></a>
            </div>
            <div class="section-foot-links">
              <a :href="base('/shenlun/五大题型导航')">五大题型导航</a>
              <a :href="base('/shenlun/scores')">评分与进步</a>
            </div>
          </section>

          <section class="home-section">
            <div class="section-heading">
              <div><span class="section-index">03</span><h2>练习与复盘</h2></div>
            </div>
            <div class="action-links">
              <a :href="base('/daily-quizzes/')"><span class="action-mark">测</span><span><b>每日测验</b><small>真题练习、首答与批改记录</small></span><i>→</i></a>
              <a :href="base('/cuotiben/')"><span class="action-mark">错</span><span><b>行测错题本</b><small>按模块、错因和待验证状态筛选</small></span><i>→</i></a>
              <a :href="base('/cuotiben/135题混合真题批改-2026-11-07')"><span class="action-mark">卷</span><span><b>135题整卷复盘</b><small>按模块直达42道已讨论错题</small></span><i>→</i></a>
            </div>
          </section>
        </div>

        <section class="home-section home-section--resources">
          <div class="section-heading">
            <div><span class="section-index">04</span><h2>工具与资料</h2></div>
          </div>
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
        <div class="status-topline"><span class="status-dot"></span>学习记录概览</div>
        <h2 id="recent-status-title">最近状态</h2>
        <p class="status-updated">数据快照生成于 {{ d.generatedAt }}</p>

        <div v-if="latest" class="latest-quiz">
          <span class="latest-quiz__label">最近一条正式测验记录</span>
          <strong>{{ latest.date }}</strong>
          <span class="latest-quiz__result">{{ latest.status }}</span>
          <a :href="base(latest.testUrl || '/daily-quizzes/')">回看这份试卷 <span>↗</span></a>
        </div>
        <div v-else class="latest-quiz latest-quiz--empty">
          <span class="latest-quiz__label">正式测验记录</span>
          <strong>暂无记录</strong>
          <a :href="base('/daily-quizzes/')">打开测验目录 <span>↗</span></a>
        </div>

        <div class="status-stats">
          <div><b>{{ d.quizzes.reviewed }}</b><span>已批改正式测验</span></div>
          <div><b>{{ d.quizzes.pending }}</b><span>待作答历史卷</span></div>
          <div><b>{{ d.questions.total }}</b><span>错题本记录</span></div>
        </div>
        <div class="status-progress">
          <div class="status-progress__label"><span>已完成复测记录</span><b>{{ d.retests.done }} / {{ d.retests.total }}</b></div>
          <div class="status-progress__track" role="progressbar" :aria-valuenow="d.retests.done" aria-valuemin="0" :aria-valuemax="d.retests.total" aria-label="已完成复测记录">
            <span :style="{ width: `${retestProgress}%` }"></span>
          </div>
          <p>{{ d.retests.pending }} 项待验证 · {{ d.retests.needsRetry }} 项需再测</p>
        </div>
        <a class="status-cta" :href="base('/cuotiben/')">进入错题筛选 <span>→</span></a>
        <p class="status-note">仅统计已登记的数据；完成复测不等于独立掌握，未登记进展不会推测。</p>
      </aside>
    </div>

    <footer class="home-footer">
      <a :href="base('/guide/')">浏览完整知识地图</a>
      <span>·</span>
      <a :href="base('/guide/changelog')">查看更新记录</a>
    </footer>
  </div>
</template>

<style scoped>
.knowledge-home {
  --home-accent: #4f46e5;
  --home-accent-soft: rgba(79, 70, 229, .08);
  --home-cta: #4f46e5;
  width: min(1360px, 100%);
  margin: 0 auto;
  padding: 30px clamp(18px, 3vw, 42px) 0;
  color: var(--vp-c-text-1);
  font-family: var(--vp-font-family-base);
}
.knowledge-home a { color: inherit; text-decoration: none; }
.home-intro { margin: 0 0 26px; }
.home-kicker { color: var(--home-accent); font-size: 12px; font-weight: 750; letter-spacing: .1em; }
.home-intro h1 { margin: 8px 0 8px; border: 0; padding: 0; font-size: clamp(28px, 3vw, 38px); line-height: 1.3; letter-spacing: -.025em; }
.home-intro p { max-width: 760px; margin: 0; color: var(--vp-c-text-2); font-size: 16px; line-height: 1.75; }
.home-layout { display: grid; grid-template-columns: minmax(0, 1fr) 286px; align-items: start; gap: 24px; }
.home-directory { display: grid; gap: 18px; min-width: 0; }
.home-section { min-width: 0; padding: 22px 24px; border: 1px solid var(--vp-c-divider); border-radius: 16px; background: var(--vp-c-bg); }
.home-section--xingce { background: linear-gradient(145deg, var(--vp-c-bg), var(--vp-c-bg-soft)); }
.section-heading { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-bottom: 17px; }
.section-heading > div { display: flex; align-items: center; gap: 10px; }
.section-index { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 9px; color: var(--home-accent); background: var(--home-accent-soft); font-size: 12px; font-weight: 800; font-variant-numeric: tabular-nums; }
.section-heading h2 { margin: 0; font-size: 21px; line-height: 1.35; }
.section-more { color: var(--home-accent) !important; font-size: 14px; font-weight: 650; white-space: nowrap; }
.module-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.module-link { display: grid; gap: 5px; min-width: 0; padding: 13px 14px; border: 1px solid var(--vp-c-divider); border-radius: 11px; background: var(--vp-c-bg); transition: border-color .18s, transform .18s, background .18s; }
.module-link:hover, .essay-links a:hover, .resource-links a:hover { border-color: var(--home-accent); background: var(--home-accent-soft); transform: translateY(-1px); }
.module-link__name { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 16px; font-weight: 720; }
.module-link__name > span { color: var(--home-accent); font-size: 13px; }
.module-link__hint { color: var(--vp-c-text-2); font-size: 13px; line-height: 1.5; }
.home-section-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
.essay-links { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.essay-links a { display: flex; justify-content: space-between; gap: 8px; padding: 10px 11px; border: 1px solid var(--vp-c-divider); border-radius: 9px; font-size: 14px; font-weight: 650; transition: .18s; }
.essay-links a span { color: var(--home-accent); }
.section-foot-links { display: flex; flex-wrap: wrap; gap: 8px 16px; margin-top: 13px; padding-top: 12px; border-top: 1px solid var(--vp-c-divider); }
.section-foot-links a { color: var(--home-accent); font-size: 13px; font-weight: 650; }
.action-links { display: grid; }
.action-links > a { display: grid; grid-template-columns: 34px minmax(0, 1fr) 16px; align-items: center; gap: 10px; padding: 12px 0; border-top: 1px solid var(--vp-c-divider); }
.action-links > a:first-child { padding-top: 0; border-top: 0; }
.action-links > a:last-child { padding-bottom: 0; }
.action-mark { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 10px; color: var(--home-accent); background: var(--home-accent-soft); font-size: 14px; font-weight: 800; }
.action-links b, .action-links small { display: block; }
.action-links b { font-size: 15px; }
.action-links small { margin-top: 2px; color: var(--vp-c-text-2); font-size: 12px; line-height: 1.45; }
.action-links i { color: var(--home-accent); font-style: normal; }
.resource-links { display: flex; flex-wrap: wrap; gap: 8px; }
.resource-links a { padding: 8px 12px; border: 1px solid var(--vp-c-divider); border-radius: 999px; color: var(--vp-c-text-2); font-size: 13px; transition: .18s; }
.home-status { position: sticky; top: calc(var(--vp-nav-height) + 24px); padding: 20px; border: 1px solid #d9dcf7; border-radius: 16px; background: linear-gradient(155deg, var(--vp-c-bg), var(--vp-c-bg-soft)); }
.status-topline { display: flex; align-items: center; gap: 8px; color: var(--vp-c-text-2); font-size: 12px; font-weight: 650; }
.status-dot { width: 8px; height: 8px; border-radius: 50%; background: #22a06b; box-shadow: 0 0 0 4px rgba(34, 160, 107, .12); }
.home-status h2 { margin: 9px 0 0; font-size: 22px; }
.status-updated { margin: 3px 0 15px; color: var(--vp-c-text-2); font-size: 12px; }
.latest-quiz { display: grid; gap: 5px; padding: 14px; border: 1px solid #d9dcf7; border-radius: 12px; background: var(--vp-c-bg); }
.latest-quiz__label { color: var(--vp-c-text-2); font-size: 12px; }
.latest-quiz strong { font-size: 20px; font-variant-numeric: tabular-nums; }
.latest-quiz__result { font-size: 13px; line-height: 1.5; }
.latest-quiz > a { margin-top: 4px; color: var(--home-accent); font-size: 13px; font-weight: 700; }
.latest-quiz--empty strong { font-size: 16px; }
.status-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 12px 0; }
.status-stats > div { display: grid; gap: 2px; padding: 10px; border: 1px solid var(--vp-c-divider); border-radius: 10px; background: var(--vp-c-bg); }
.status-stats > div:last-child { grid-column: 1 / -1; }
.status-stats b { color: var(--home-accent); font-size: 21px; line-height: 1.2; font-variant-numeric: tabular-nums; }
.status-stats span { color: var(--vp-c-text-2); font-size: 11px; }
.status-progress { margin: 4px 0 12px; }
.status-progress__label { display: flex; justify-content: space-between; gap: 8px; color: var(--vp-c-text-2); font-size: 11px; }
.status-progress__label b { color: var(--vp-c-text-1); font-variant-numeric: tabular-nums; }
.status-progress__track { height: 7px; margin: 6px 0; overflow: hidden; border-radius: 999px; background: var(--vp-c-divider); }
.status-progress__track span { display: block; height: 100%; border-radius: inherit; background: var(--home-accent); transition: width .2s; }
.status-progress p { margin: 0; color: var(--vp-c-text-2); font-size: 10px; line-height: 1.45; }
.status-cta { display: flex; align-items: center; justify-content: space-between; padding: 11px 13px; border-radius: 10px; color: #fff !important; background: var(--home-cta); font-size: 14px; font-weight: 700; }
.status-cta:hover { background: #4338ca; }
.status-note { margin: 12px 0 0; color: var(--vp-c-text-2); font-size: 11px; line-height: 1.55; }
.home-footer { display: flex; justify-content: center; gap: 10px; padding: 23px 0 4px; color: var(--vp-c-text-2); font-size: 13px; }
.home-footer a:hover { color: var(--home-accent); }
:global(.dark .knowledge-home){ --home-accent: #a5b4fc; --home-accent-soft: rgba(165, 180, 252, .12); --home-cta: #4f46e5; }
:global(.dark .home-status){ border-color: #454b78; }
:global(.dark .latest-quiz){ border-color: #454b78; }

@media (max-width: 1100px) {
  .home-layout { grid-template-columns: minmax(0, 1fr); }
  .home-status { position: static; order: -1; }
  .status-stats { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .status-stats > div:last-child { grid-column: auto; }
}
@media (max-width: 760px) {
  .knowledge-home { padding: 20px 16px 0; }
  .home-intro { margin-bottom: 18px; }
  .home-intro p { font-size: 15px; }
  .home-layout, .home-directory { gap: 13px; }
  .home-section { padding: 18px 16px; }
  .home-section-grid { grid-template-columns: 1fr; gap: 13px; }
  .module-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 480px) {
  .home-intro h1 { font-size: 28px; }
  .home-section { padding: 16px 13px; border-radius: 13px; }
  .section-heading { align-items: flex-start; }
  .section-heading h2 { font-size: 19px; }
  .section-more { padding-top: 5px; font-size: 12px; }
  .module-grid { gap: 8px; }
  .module-link { padding: 11px 10px; }
  .module-link__name { font-size: 14px; }
  .module-link__hint { font-size: 12px; }
  .essay-links { grid-template-columns: 1fr 1fr; }
  .essay-links a { padding: 9px; font-size: 13px; }
  .status-stats { grid-template-columns: 1fr 1fr; }
  .status-stats > div:last-child { grid-column: 1 / -1; }
  .home-footer { font-size: 12px; }
}
</style>
