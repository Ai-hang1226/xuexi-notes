<script setup>
import { computed } from 'vue'
import { withBase } from 'vitepress'
import CoverHero from './CoverHero.vue'
import d from '../../../data/dashboard.json'
import updates from '../../../data/updates.json'

const base = (p) => withBase(p)
const days = computed(() =>
  Math.max(0, Math.floor((Date.now() - Date.parse(d.streak.since + 'T00:00:00Z')) / 86400000)))

const ring = { r: 26, c: 2 * Math.PI * 26 }
const toneColor = { todo: '#a3b0e0', start: '#7d8fd2', mid: '#5a6fc0', done: '#37499f' }
const typeColors = {
  错题: '#e11d48', 耗时较长: '#f59e0b', 猜题: '#8b5cf6', 不确定: '#0ea5e9',
  答对复习: '#0d9488', 待复盘: '#dc2626', 未作答: '#94a3b8',
}
const typeBars = computed(() => Object.entries(d.questions.byType)
  .sort((a, b) => b[1] - a[1])
  .map(([name, count]) => ({
    name, count,
    pct: Math.round((count / d.questions.total) * 100),
    color: typeColors[name] || '#64748b',
  })))
const shenlunRates = computed(() => d.shenlun.baselines.map((s) => ({
  ...s, rate: Math.round((s.score / s.max) * 100),
})))
const recent = updates.slice(0, 6)
const moduleMax = Math.max(...d.modules.map((m) => m.沉淀))
const queue = d.retests.list.slice(0, 4)
const statusTone = (s) => /待作答|待复测/.test(s) ? 'warn' : /未通过|不稳/.test(s) ? 'bad' : 'good'
</script>

<template>
  <div class="db">
    <!-- ============ 首屏封面：与分享图同版式，模块标签可直接进入 ============ -->
    <CoverHero />

    <!-- ============ 驾驶舱快捷条：封面之下，保留原有统计与入口 ============ -->
    <section id="dashboard" class="db-quickbar">
      <div class="db-quickbar__lead">
        <span class="db-kicker">TODAY'S PANEL</span>
        <h2>学习驾驶舱</h2>
        <p>下面按「今天做什么 → 沉淀到哪 → 证据是什么」展开，数字由原笔记自动生成。</p>
      </div>
      <div class="db-quickbar__side">
        <div class="db-streak">
          <div class="db-streak__num">{{ days }}<small>天</small></div>
          <div class="db-streak__label">自 {{ d.streak.since }} 起持续记录</div>
        </div>
        <div class="db-hero__stats">
          <div><b>{{ d.questions.total }}</b><span>题复盘记录</span></div>
          <div><b>{{ d.updates.total }}</b><span>次内容更新</span></div>
          <div><b>{{ d.quizzes.reviewed }}/{{ d.quizzes.total }}</b><span>卷已批改</span></div>
        </div>
      </div>
      <div class="db-quickbar__actions">
        <a class="db-btn db-btn--primary" :href="base('/daily-quizzes/')">开始今日测验 <span>→</span></a>
        <a class="db-btn db-btn--line" :href="base('/cuotiben/')">进入错题本</a>
        <a class="db-btn db-btn--plain" :href="base('/guide/')">全站地图 ↗</a>
      </div>
    </section>

    <!-- ============ 今日 ============ -->
    <section id="today" class="db-section">
      <header class="db-head">
        <div>
          <span class="db-kicker">TODAY'S FOCUS</span>
          <h2>今天先做这三件事</h2>
        </div>
        <span class="db-head__note">数字由原笔记自动生成，不是手填</span>
      </header>

      <div class="db-today">
        <a class="db-task db-task--quiz" :href="base('/daily-quizzes/')">
          <div class="db-task__top"><span class="db-task__icon">📝</span><span class="db-task__tag">每日 18:00</span></div>
          <h3>今日测验</h3>
          <p>8 道行测 ＋ 1 道申论，先留首答再看解析</p>
          <div class="db-task__foot"><b>{{ d.quizzes.pending }}</b> 份待作答 <span>→</span></div>
        </a>
        <a class="db-task db-task--retest" :href="base('/daily-quizzes/')">
          <div class="db-task__top"><span class="db-task__icon">🔁</span><span class="db-task__tag">闭环关键</span></div>
          <h3>到期复测</h3>
          <p>换同考点真题验证，完成前不记为掌握</p>
          <div class="db-task__foot"><b>{{ d.retests.pending }}</b> 条待执行 · {{ d.retests.needsRetry }} 条未通过 <span>→</span></div>
        </a>
        <a class="db-task db-task--wrong" :href="base('/cuotiben/')">
          <div class="db-task__top"><span class="db-task__icon">🧠</span><span class="db-task__tag">错因归档</span></div>
          <h3>错题复盘</h3>
          <p>按模块与错因类型找题，猜对和慢题也单独看</p>
          <div class="db-task__foot"><b>{{ d.questions.awaitingReview }}</b> 条待复盘 · {{ d.questions.pendingVerification }} 条待验证 <span>→</span></div>
        </a>
      </div>

      <div class="db-queue">
        <div class="db-queue__head"><b>最早到期的复测</b><span>按日期排序 · 点「查看安排」进入每日测验</span></div>
        <ul>
          <li v-for="(r, i) in queue" :key="r.date + r.task + i">
            <span class="db-queue__date">{{ r.date.slice(5) }}</span>
            <span class="db-queue__task">{{ r.task }}</span>
            <span class="db-queue__status" :class="'is-' + statusTone(r.status)">{{ r.status }}</span>
          </li>
        </ul>
        <a class="db-queue__more" :href="base('/daily-quizzes/')">查看全部 {{ d.retests.total }} 条复测安排 →</a>
      </div>
    </section>

    <!-- ============ 进度 ============ -->
    <section class="db-section">
      <header class="db-head">
        <div>
          <span class="db-kicker">MODULE PROGRESS</span>
          <h2>五大模块 · 内容沉淀度</h2>
        </div>
        <span class="db-head__note">按错题目录归档条数自动计算，非手填；不代表掌握程度</span>
      </header>
      <div class="db-modules">
        <a v-for="m in d.modules" :key="m.name" class="db-module" :href="base(m.link)">
          <div class="db-module__top">
            <span class="db-module__icon">{{ m.icon }}</span>
            <span class="db-module__status" :class="'is-' + m.tone">{{ m.status }}</span>
          </div>
          <h3>{{ m.name }}</h3>
          <div class="db-module__mid">
            <div class="db-ring" :style="{ '--ring-color': toneColor[m.tone] }">
              <svg viewBox="0 0 60 60" aria-hidden="true">
                <circle class="db-ring__bg" cx="30" cy="30" :r="ring.r" />
                <circle class="db-ring__fg" cx="30" cy="30" :r="ring.r"
                  :stroke-dasharray="ring.c" :stroke-dashoffset="ring.c * (1 - m.progress / 100)" />
              </svg>
              <span class="db-ring__text">{{ m.progress }}<small>%</small></span>
            </div>
            <div class="db-module__meta">
              <div><b>{{ m.沉淀 }}</b><span>条沉淀</span></div>
              <div class="db-module__mini">
                <i :style="{ width: Math.round((m.沉淀 / moduleMax) * 100) + '%', background: toneColor[m.tone] }"></i>
              </div>
              <small>方法库 / 速查 / 复盘已归位</small>
            </div>
          </div>
        </a>
      </div>
    </section>

    <!-- ============ 数据 ============ -->
    <section class="db-section">
      <header class="db-head">
        <div>
          <span class="db-kicker">EVIDENCE BOARD</span>
          <h2>让数据说话</h2>
        </div>
        <span class="db-head__note">复盘类型可叠加，合计不等于题数</span>
      </header>
      <div class="db-insights">
        <div class="db-card">
          <h3>错因分布 <small>共 {{ d.questions.total }} 条记录</small></h3>
          <div v-for="t in typeBars" :key="t.name" class="db-bar">
            <span class="db-bar__name" :title="t.name">{{ t.name }}</span>
            <div class="db-bar__track"><i :style="{ width: t.pct + '%', background: t.color }"></i></div>
            <b>{{ t.count }}</b>
          </div>
        </div>
        <div class="db-card">
          <h3>申论首答基线 <small>5 题 · 不同题型不可直接比较</small></h3>
          <div v-for="s in shenlunRates" :key="s.name" class="db-score">
            <span class="db-score__name" :title="s.name">{{ s.name }}</span>
            <b class="db-score__value">{{ s.score }}/{{ s.max }}</b>
            <div class="db-score__track"><i :style="{ width: s.rate + '%' }"></i></div>
          </div>
          <p class="db-card__note">改写 {{ d.shenlun.rewrites }} 份 · 陌生题验证 {{ d.shenlun.transfers }} 份，暂不判断进退。</p>
        </div>
        <div class="db-card db-card--stat">
          <h3>测验与闭环</h3>
          <div class="db-big"><b>{{ d.quizzes.reviewed }}</b><span>/ {{ d.quizzes.total }} 份正式卷已批改</span></div>
          <div class="db-mini">
            <div><b>{{ d.quizzes.assessments }}</b><span>阶段测评</span></div>
            <div><b>{{ d.retests.done }}</b><span>复测已验证</span></div>
            <div><b>{{ d.retests.needsRetry }}</b><span>未通过 / 不稳</span></div>
            <div><b>{{ d.quizzes.pending }}</b><span>待作答</span></div>
          </div>
          <p class="db-card__note">未作答不记零分；归档不等于独立掌握。</p>
        </div>
      </div>
    </section>

    <!-- ============ 四象限入口 ============ -->
    <section class="db-section">
      <header class="db-head">
        <div>
          <span class="db-kicker">GO BY SCENE</span>
          <h2>按场景进入，不再翻长目录</h2>
        </div>
      </header>
      <div class="db-quad">
        <div class="db-quad__col">
          <h3><i>📖</i> 学方法</h3>
          <a :href="base('/guide/yanyu')">言语学习路径</a>
          <a :href="base('/guide/shuliang')">数量学习路径</a>
          <a :href="base('/guide/panduan')">判断学习路径</a>
          <a :href="base('/guide/ziliao')">资料学习路径</a>
          <a :href="base('/guide/changshi')">常识学习路径</a>
          <a :href="base('/shenlun/kiwi-framework')">📘 申论总纲 · Kiwi 五题型</a>
        </div>
        <div class="db-quad__col">
          <h3><i>✍️</i> 动手练</h3>
          <a :href="base('/daily-quizzes/')">每日测验</a>
          <a :href="base('/daily-quizzes/real-exam-rules')">只做真题 · 出题规则</a>
          <a :href="base('/guide/archive')">按月份归档</a>
          <a :href="base('/jiangsu/printable.html')">江苏 A4 打印讲义</a>
        </div>
        <div class="db-quad__col">
          <h3><i>🔍</i> 考前查</h3>
          <a :href="base('/xingce/图解速查')">图解速查</a>
          <a :href="base('/tools/')">🧮 速算工具箱</a>
          <a :href="base('/xingce/资料分析读数与百化分速查')">百化分 1—20</a>
          <a :href="base('/xingce/言语词义辨析积累表')">词义辨析 115 词</a>
          <a :href="base('/xingce/图推特征与操作速查')">图推特征与操作</a>
        </div>
        <div class="db-quad__col">
          <h3><i>🧠</i> 做复盘</h3>
          <a :href="base('/cuotiben/')">全部题目 · 筛选</a>
          <a :href="base('/cuotiben/repeated-issues')">按问题回看</a>
          <a :href="base('/cuotiben/学习闭环')">学习闭环方法</a>
          <a :href="base('/cuotiben/135题混合真题批改-2026-11-07')">135 题整卷批改</a>
          <a :href="base('/shenlun/scores')">申论评分与进步</a>
        </div>
      </div>
    </section>

    <!-- ============ 更新 ============ -->
    <section class="db-section">
      <header class="db-head">
        <div>
          <span class="db-kicker">RECENT UPDATES</span>
          <h2>最近更新</h2>
        </div>
        <a class="db-head__link" :href="base('/guide/changelog')">查看全部 {{ d.updates.total }} 条 →</a>
      </header>
      <ol class="db-timeline">
        <li v-for="(u, i) in recent" :key="u.date + u.title + i">
          <time>{{ u.date.slice(5) }}</time>
          <span class="db-tag" :class="'t-' + u.tone">{{ u.tag }}</span>
          <div class="db-timeline__body">
            <a :href="base(u.links[0]?.url || '/guide/changelog')">{{ u.title }}</a>
            <p>{{ u.summary.slice(0, 96) }}{{ u.summary.length > 96 ? '…' : '' }}</p>
          </div>
        </li>
      </ol>
    </section>

    <!-- ============ 闭环 ============ -->
    <section class="db-flow">
      <div class="db-flow__title">
        <span class="db-kicker">THE LOOP</span>
        <h2>每道题都走完这五步，知识才会长成体系</h2>
      </div>
      <div class="db-flow__steps">
        <div><b>01</b><span>做题</span><small>闭卷、留首答、记真实用时</small></div>
        <div><b>02</b><span>对答案</span><small>试卷 / 解析 / 本人首答分栏</small></div>
        <div><b>03</b><span>归因</span><small>按模块与错因归档到错题本</small></div>
        <div><b>04</b><span>沉淀</span><small>方法库、速查表、图解补缺口</small></div>
        <div><b>05</b><span>验证</span><small>换同考点真题，约 2 / 7 天复测</small></div>
      </div>
      <div class="db-flow__foot">📌 <a :href="base('/guide/help')">完整使用指南</a> · <a :href="base('/cuotiben/学习闭环')">错题复盘怎么走</a></div>
    </section>

    <p class="db-footnote">本页数据由 <code>scripts/build-dashboard.mjs</code> 从原始笔记生成；内容与链接均沿用原站，未删除任何笔记。</p>
  </div>
</template>

<style scoped>
.db { color: var(--vp-c-text-1); font-family: var(--vp-font-family-base); }
.db a { color: inherit; text-decoration: none; }
.db h1, .db h2, .db h3 { margin: 0; font-weight: 700; }

/* ---------- 封面之下的快捷条 ---------- */
.db-quickbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 330px;
  gap: 18px 28px;
  align-items: center;
  margin: 0 0 46px;
  padding: 24px 28px;
  border: 1px solid #e3e5f4;
  border-radius: 18px;
  background: rgba(255, 255, 255, .7);
  scroll-margin-top: 84px;
}
.db-quickbar__lead h2 { margin-top: 8px; padding-top: 0; border-top: 0; font-size: 24px; line-height: 1.4; }
.db-quickbar__lead p { margin: 7px 0 0; color: var(--vp-c-text-2); font-size: 13px; line-height: 1.65; }
.db-quickbar__side {
  display: grid;
  grid-template-columns: 106px minmax(0, 1fr);
  gap: 18px;
  align-items: center;
  padding: 14px 18px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 14px;
  background: var(--vp-c-bg-soft);
}
.db-quickbar .db-streak { padding-bottom: 0; border-bottom: 0; }
.db-quickbar .db-streak__num { font-size: 32px; }
.db-quickbar .db-streak__label { font-size: 11px; }
.db-quickbar .db-hero__stats { margin-top: 0; }
.db-quickbar__actions { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 10px; }
:global(.dark) .db-quickbar { border-color: #3d4266; background: rgba(255, 255, 255, .04); }

/* ---------- Hero（封面启用后保留样式供历史类名复用） ---------- */
.db-hero {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 32px;
  align-items: center;
  overflow: hidden;
  margin-bottom: 56px;
  padding: 56px 52px;
  border: 1px solid #dfe1f5;
  border-radius: 24px;
  background: linear-gradient(135deg, #f7f8ff 0%, #eef0ff 55%, #e8ecff 100%);
}
.db-hero__grid {
  position: absolute;
  inset: 0;
  background-image: linear-gradient(rgba(79, 70, 229, .045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(79, 70, 229, .045) 1px, transparent 1px);
  background-size: 28px 28px;
  mask-image: linear-gradient(90deg, transparent, #000 45%, #000);
  pointer-events: none;
}
.db-hero__main, .db-hero__side { position: relative; z-index: 1; }
.db-eyebrow {
  display: inline-flex; align-items: center; gap: 8px;
  max-width: 100%;
  padding: 7px 13px; border: 1px solid #cfd3f5; border-radius: 999px;
  background: rgba(255, 255, 255, .7);
  color: #4f46e5; font-size: 11px; font-weight: 700; letter-spacing: .04em;
  white-space: nowrap;
}
.db-eyebrow__dot { flex: 0 0 auto; width: 7px; height: 7px; border-radius: 50%; background: #4f46e5; box-shadow: 0 0 0 4px rgba(79, 70, 229, .14); }
.db-hero h1 { margin: 22px 0 14px; font-size: clamp(28px, 2.9vw, 40px); line-height: 1.34; letter-spacing: -.02em; }
.db-hero h1 > span { display: block; }
.db-hero h1 span { color: #4338ca; }
.db-hero__sub { margin: 0; color: #555e77; font-size: 17px; line-height: 1.8; }
.db-hero__actions { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-top: 28px; }
.db-btn { display: inline-flex; align-items: center; gap: 10px; padding: 12px 20px; border-radius: 10px; font-size: 15px; font-weight: 700; transition: transform .18s, box-shadow .18s, background .18s; }
.db-btn:hover { transform: translateY(-2px); }
.db-btn--primary { background: #4f46e5; color: #fff; box-shadow: 0 8px 20px rgba(79, 70, 229, .25); }
.db-btn--primary:hover { background: #4338ca; box-shadow: 0 10px 26px rgba(79, 70, 229, .32); }
.db-btn--line { border: 1px solid #b9bff0; background: rgba(255, 255, 255, .75); color: #3730a3; }
.db-btn--plain { padding-inline: 6px; color: #5b6280; }
.db-hero__side { padding: 24px; border: 1px solid rgba(255, 255, 255, .9); border-radius: 18px; background: rgba(255, 255, 255, .78); box-shadow: 0 12px 32px rgba(67, 56, 202, .1); backdrop-filter: blur(8px); }
.db-streak { padding-bottom: 18px; border-bottom: 1px solid #e2e4f2; }
.db-streak__num { color: #3730a3; font-size: 48px; font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; }
.db-streak__num small { margin-left: 6px; font-size: 16px; font-weight: 600; }
.db-streak__label { margin-top: 8px; color: #6b7290; font-size: 13px; }
.db-hero__stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 18px; }
.db-hero__stats div { display: grid; gap: 3px; }
.db-hero__stats b { color: #1f2540; font-size: 20px; font-variant-numeric: tabular-nums; }
.db-hero__stats span { color: #7b8199; font-size: 11px; white-space: nowrap; }

/* ---------- 通用区块 ---------- */
.db-section { margin-bottom: 56px; }
.db-head { display: flex; align-items: end; justify-content: space-between; gap: 20px; margin-bottom: 22px; padding-bottom: 14px; border-bottom: 2px solid var(--vp-c-divider); }
.db-kicker { display: block; margin-bottom: 6px; color: #6d63d6; font-size: 11px; font-weight: 700; letter-spacing: .14em; }
.db-head h2 { font-size: clamp(21px, 2vw, 26px); line-height: 1.35; }
.db-head__note, .db-head__link { color: var(--vp-c-text-2); font-size: 13px; white-space: nowrap; }
.db-head__link { color: #4f46e5; font-weight: 700; }

/* ---------- 今日 ---------- */
.db-today { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.db-task { display: flex; flex-direction: column; min-height: 196px; padding: 20px; border: 1px solid var(--vp-c-divider); border-radius: 16px; background: var(--vp-c-bg-soft); transition: transform .18s, box-shadow .18s, border-color .18s; }
.db-task:hover { transform: translateY(-3px); border-color: #a5a0ea; box-shadow: 0 12px 28px rgba(60, 60, 120, .1); }
.db-task__top { display: flex; align-items: center; justify-content: space-between; }
.db-task__icon { font-size: 26px; }
.db-task__tag { padding: 4px 9px; border-radius: 999px; background: rgba(79, 70, 229, .1); color: #5a52cf; font-size: 11px; font-weight: 700; }
.db-task h3 { margin-top: 14px; font-size: 19px; }
.db-task p { margin: 8px 0 0; color: var(--vp-c-text-2); font-size: 13px; line-height: 1.7; }
.db-task__foot { display: flex; align-items: baseline; gap: 5px; margin-top: auto; padding-top: 16px; color: var(--vp-c-text-2); font-size: 13px; }
.db-task__foot b { color: #c2410c; font-size: 21px; font-variant-numeric: tabular-nums; }
.db-task__foot span { margin-left: auto; color: #4f46e5; font-size: 17px; }
.db-task--retest .db-task__foot b { color: #b45309; }
.db-task--wrong .db-task__foot b { color: #be123c; }

.db-queue { margin-top: 18px; padding: 18px 22px; border: 1px solid var(--vp-c-divider); border-left: 4px solid #f59e0b; border-radius: 12px; background: var(--vp-c-bg-soft); }
.db-queue__head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.db-queue__head b { font-size: 15px; }
.db-queue__head span { color: var(--vp-c-text-2); font-size: 12px; }
.db-queue ul { margin: 0; padding: 0; list-style: none; }
.db-queue li { display: grid; grid-template-columns: 62px minmax(0, 1fr) auto; gap: 12px; align-items: baseline; padding: 8px 0; border-top: 1px dashed var(--vp-c-divider); font-size: 14px; }
.db-queue__date { color: #a16207; font-weight: 700; font-variant-numeric: tabular-nums; }
.db-queue__task { color: var(--vp-c-text-1); line-height: 1.55; }
.db-queue__status { padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; white-space: nowrap; }
.db-queue__status.is-warn { background: #fef3c7; color: #92400e; }
.db-queue__status.is-bad { background: #ffe4e6; color: #9f1239; }
.db-queue__status.is-good { background: #d1fae5; color: #065f46; }
.db-queue__more { display: inline-block; margin-top: 12px; color: #4f46e5; font-size: 13px; font-weight: 700; }

/* ---------- 模块 ---------- */
/* 列宽自适应：容器较窄时自动降列数，避免卡片被压到 100px 出头导致中文逐字换行 */
.db-modules { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; }
.db-module { padding: 18px 16px; border: 1px solid var(--vp-c-divider); border-radius: 16px; background: var(--vp-c-bg); transition: transform .18s, box-shadow .18s, border-color .18s; }
.db-module:hover { transform: translateY(-3px); border-color: #a5a0ea; box-shadow: 0 12px 26px rgba(60, 60, 120, .1); }
.db-module__top { display: flex; align-items: center; justify-content: space-between; }
.db-module__icon { font-size: 24px; }
.db-module__status { padding: 3px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; background: var(--vp-c-default-soft); }
.db-module__status.is-todo { color: #6b7290; }
.db-module__status.is-start { color: #5a6fc0; }
.db-module__status.is-mid { color: #37499f; }
.db-module__status.is-done { color: #2b3675; background: #e0e4fb; }
.db-module h3 { margin: 12px 0 14px; font-size: 16px; }
.db-module__mid { display: flex; align-items: center; gap: 12px; }
.db-ring { position: relative; flex: 0 0 62px; width: 62px; height: 62px; }
.db-ring svg { width: 100%; height: 100%; transform: rotate(-90deg); }
.db-ring circle { fill: none; stroke-width: 5; }
.db-ring__bg { stroke: var(--vp-c-divider); }
.db-ring__fg { stroke: var(--ring-color); stroke-linecap: round; transition: stroke-dashoffset .6s ease; }
.db-ring__text { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; }
.db-ring__text small { font-size: 10px; }
.db-module__meta { min-width: 0; flex: 1; }
.db-module__meta > div:first-child { display: flex; align-items: baseline; gap: 5px; }
.db-module__meta b { font-size: 19px; font-variant-numeric: tabular-nums; }
.db-module__meta span { color: var(--vp-c-text-2); font-size: 11px; white-space: nowrap; }
.db-module__mini { height: 5px; margin: 7px 0 6px; border-radius: 999px; background: var(--vp-c-divider); overflow: hidden; }
.db-module__mini i { display: block; height: 100%; border-radius: inherit; }
.db-module__meta small { display: block; color: var(--vp-c-text-2); font-size: 10px; line-height: 1.5; overflow-wrap: anywhere; }

/* ---------- 数据卡 ---------- */
.db-insights { display: grid; grid-template-columns: 1.05fr 1.15fr .9fr; gap: 16px; }
.db-card { padding: 20px; border: 1px solid var(--vp-c-divider); border-radius: 16px; background: var(--vp-c-bg-soft); }
.db-card h3 { margin-bottom: 18px; font-size: 15px; }
.db-card h3 small { margin-left: 6px; color: var(--vp-c-text-2); font-size: 11px; font-weight: 400; }
.db-bar { display: grid; grid-template-columns: 80px minmax(0, 1fr) 46px; gap: 9px; align-items: center; margin: 9px 0; font-size: 12px; }
.db-bar__name { color: var(--vp-c-text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.db-bar__track { height: 8px; border-radius: 999px; background: var(--vp-c-divider); overflow: hidden; }
.db-bar__track i { display: block; height: 100%; border-radius: inherit; }
.db-bar b { text-align: right; font-variant-numeric: tabular-nums; }
/* 申论题名较长：名称与分数各占一行，进度条独占整行，避免文字被条覆盖 */
.db-score { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px 10px; margin: 13px 0; }
.db-score__name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; font-weight: 600; }
.db-score__value { font-size: 13px; font-variant-numeric: tabular-nums; }
.db-score__track { grid-column: 1 / -1; height: 8px; border-radius: 999px; background: var(--vp-c-divider); overflow: hidden; }
.db-score__track i { display: block; height: 100%; border-radius: inherit; background: #0d9488; }
.db-card__note { margin: 16px 0 0; padding-top: 12px; border-top: 1px dashed var(--vp-c-divider); color: var(--vp-c-text-2); font-size: 11px; line-height: 1.6; }
.db-card--stat { background: linear-gradient(150deg, #f7f8ff, #eef0ff); border-color: #dfe1f5; }
.db-big { display: flex; align-items: baseline; gap: 8px; }
.db-big b { color: #3730a3; font-size: 42px; line-height: 1; font-variant-numeric: tabular-nums; }
.db-big span { color: #5d6480; font-size: 12px; }
.db-mini { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 22px 0 0; }
.db-mini div { display: grid; gap: 2px; padding: 10px 12px; border: 1px solid #dfe1f5; border-radius: 10px; background: rgba(255, 255, 255, .65); }
.db-mini b { color: #3730a3; font-size: 19px; font-variant-numeric: tabular-nums; }
.db-mini span { color: #6b7290; font-size: 11px; }

/* ---------- 四象限 ---------- */
.db-quad { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
.db-quad__col { padding: 18px; border: 1px solid var(--vp-c-divider); border-radius: 14px; background: var(--vp-c-bg); }
.db-quad__col h3 { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; font-size: 15px; }
.db-quad__col h3 i { font-style: normal; font-size: 19px; }
.db-quad__col a { display: block; padding: 7px 0; border-top: 1px dashed var(--vp-c-divider); color: var(--vp-c-text-1); font-size: 13px; line-height: 1.5; transition: color .15s, padding-left .15s; }
.db-quad__col a:hover { padding-left: 5px; color: #4f46e5; }

/* ---------- 时间线 ---------- */
.db-timeline { margin: 0; padding: 0; list-style: none; }
.db-timeline li { display: grid; grid-template-columns: 54px 84px minmax(0, 1fr); gap: 14px; align-items: start; padding: 12px 0; border-bottom: 1px dashed var(--vp-c-divider); }
.db-timeline time { color: var(--vp-c-text-2); font-size: 12px; font-variant-numeric: tabular-nums; }
.db-tag { justify-self: start; padding: 3px 9px; border-radius: 999px; background: rgba(79, 70, 229, .1); color: #4f46e5; font-size: 11px; font-weight: 700; white-space: nowrap; }
.db-tag.t-shenlun { background: #e0f2fe; color: #0369a1; }
.db-tag.t-quiz { background: #fef3c7; color: #92400e; }
.db-tag.t-tool { background: #dcfce7; color: #166534; }
.db-tag.t-judge { background: #f3e8ff; color: #7e22ce; }
.db-tag.t-math, .db-tag.t-data { background: #ffedd5; color: #9a3412; }
.db-timeline__body a { font-size: 14px; font-weight: 700; }
.db-timeline__body a:hover { color: #4f46e5; }
.db-timeline__body p { margin: 4px 0 0; color: var(--vp-c-text-2); font-size: 12px; line-height: 1.6; }

/* ---------- 闭环 ---------- */
.db-flow { padding: 30px 32px; border: 1px solid #dfe1f5; border-radius: 20px; background: linear-gradient(135deg, #f7f8ff, #eef0ff); }
.db-flow__title h2 { margin-top: 6px; font-size: 21px; }
.db-flow__steps { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; margin: 24px 0 18px; }
.db-flow__steps div { display: grid; gap: 4px; padding: 14px; border: 1px solid #dfe1f5; border-radius: 12px; background: rgba(255, 255, 255, .65); }
.db-flow__steps b { color: #a5a0ea; font-size: 20px; }
.db-flow__steps span { color: #1f2540; font-size: 14px; font-weight: 700; }
.db-flow__steps small { color: #6b7290; font-size: 11px; line-height: 1.6; }
.db-flow__foot { color: #5d6480; font-size: 12px; }
.db-flow__foot a { color: #4f46e5; font-weight: 700; }
.db-footnote { margin: 26px 0 0; color: var(--vp-c-text-2); font-size: 11px; text-align: center; }
.db-footnote code { font-size: 11px; }

/* ---------- 深色模式 ---------- */
:global(.dark) .db-hero,
:global(.dark) .db-card--stat,
:global(.dark) .db-flow { border-color: #353a52; background: linear-gradient(135deg, #1c2033, #242a44); }
:global(.dark) .db-hero__side,
:global(.dark) .db-flow__steps div,
:global(.dark) .db-mini div { border-color: #353a52; background: rgba(255, 255, 255, .04); }
:global(.dark) .db-hero h1 span,
:global(.dark) .db-big b,
:global(.dark) .db-mini b { color: #a5b4fc; }
:global(.dark) .db-hero__sub,
:global(.dark) .db-flow__title h2,
:global(.dark) .db-flow__steps span { color: #d9dced; }
:global(.dark) .db-eyebrow { border-color: #3d4266; background: rgba(255, 255, 255, .04); color: #a5b4fc; }
:global(.dark) .db-streak__num { color: #a5b4fc; }
:global(.dark) .db-hero__stats b { color: #e2e8f0; }
:global(.dark) .db-btn--line { border-color: #4a4f78; background: rgba(255, 255, 255, .04); color: #a5b4fc; }
:global(.dark) .db-module__status.is-done { background: #2b3152; color: #c7d2fe; }

/* ---------- 响应式 ---------- */
@media (max-width: 1080px) {
  .db-quickbar { grid-template-columns: 1fr; }
  .db-hero { grid-template-columns: 1fr; padding: 40px; }
  .db-hero__side { display: grid; grid-template-columns: 200px 1fr; gap: 24px; align-items: center; }
  .db-modules { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .db-insights { grid-template-columns: 1fr 1fr; }
  .db-quad { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .db-flow__steps { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 720px) {
  .db-quickbar { margin-bottom: 32px; padding: 18px; }
  .db-quickbar__side { grid-template-columns: 1fr; gap: 10px; }
  .db-quickbar .db-streak__num { font-size: 28px; }
  .db-quickbar__actions { gap: 8px; }
  .db-hero { margin-bottom: 40px; padding: 28px 22px; border-radius: 18px; }
  .db-eyebrow__en { display: none; }
  .db-hero__side { grid-template-columns: 1fr; }
  .db-hero__actions { gap: 8px; }
  .db-btn { padding: 10px 14px; font-size: 14px; }
  .db-head { align-items: flex-start; flex-direction: column; gap: 6px; }
  .db-head__note { white-space: normal; }
  .db-today, .db-modules, .db-insights, .db-quad { grid-template-columns: 1fr; }
  .db-task { min-height: 0; }
  .db-queue li { grid-template-columns: 50px minmax(0, 1fr); }
  .db-queue__status { grid-column: 2; justify-self: start; }
  .db-flow { padding: 22px; }
  .db-flow__steps { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .db-timeline li { grid-template-columns: 46px minmax(0, 1fr); gap: 6px 10px; }
  .db-tag { grid-column: 2; }
  .db-timeline__body { grid-column: 2; }
}
</style>
