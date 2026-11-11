<script setup>
import { withBase } from 'vitepress'
import d from '../../../data/dashboard.json'

// 与 public/og-cover.png 同版式的站内首屏：静态图负责分享，这里负责可交互的入口。
const base = (p) => withBase(p)
const modules = d.modules
</script>

<template>
  <section class="cv" aria-label="站点封面">
    <div class="cv__grid" aria-hidden="true"></div>

    <div class="cv__card">
      <div class="cv__eyebrow"><span class="cv__dot"></span> GONGKAO KNOWLEDGE BASE</div>
      <h1 class="cv__title">考公知识库</h1>
      <p class="cv__sub">行测 · 申论 · 每日测验 · 错题复盘</p>
      <p class="cv__slogan">把每一次做题，<br class="cv__slogan-br" />都变成可复用的知识资产</p>

      <nav class="cv__chips" aria-label="六大模块快捷入口">
        <a v-for="m in modules" :key="m.name" class="cv__chip" :href="base(m.link)">{{ m.name }}</a>
      </nav>

      <div class="cv__foot">
        <span>个人备考笔记 · 体系化归档 · 逐题复盘</span>
        <b>ai-hang1226.github.io / xuexi-notes</b>
      </div>
    </div>

    <a class="cv__enter" href="#dashboard">进入学习驾驶舱 <span>↓</span></a>
  </section>
</template>

<style scoped>
.cv {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: min(76vh, 640px);
  margin: 0 0 44px;
  padding: 40px 22px 30px;
  border-radius: 24px;
  background: linear-gradient(135deg, #eef0ff 0%, #f7f8ff 48%, #e8ecff 100%);
  overflow: hidden;
}
.cv__grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(79, 70, 229, .05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(79, 70, 229, .05) 1px, transparent 1px);
  background-size: 32px 32px;
  pointer-events: none;
}
.cv__card {
  position: relative;
  z-index: 1;
  width: min(100%, 1060px);
  padding: clamp(30px, 4vw, 54px) clamp(24px, 4.4vw, 60px);
  border: 1px solid #dfe1f5;
  border-radius: 28px;
  background: #fff;
  box-shadow: 0 24px 60px rgba(60, 60, 140, .12);
}
.cv__card .cv__eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 7px 15px;
  border: 1px solid #cfd3f5;
  border-radius: 999px;
  color: #4f46e5;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: .05em;
  white-space: nowrap;
}
.cv__dot {
  flex: 0 0 auto;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #4f46e5;
}
.cv__card .cv__title {
  margin: 24px 0 0;
  color: #1f2540;
  font-size: clamp(40px, 5vw, 64px);
  font-weight: 700;
  line-height: 1.18;
  letter-spacing: -.02em;
  text-wrap: balance;
}
.cv__card .cv__sub {
  margin: 12px 0 0;
  color: #555e77;
  font-size: clamp(16px, 1.8vw, 24px);
  line-height: 1.5;
}
.cv__slogan-br { display: none; }
.cv__card .cv__slogan {
  margin: clamp(20px, 2.6vw, 32px) 0 0;
  color: #4338ca;
  font-size: clamp(20px, 2.5vw, 34px);
  font-weight: 700;
  line-height: 1.45;
  text-wrap: balance;
}
.cv__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: clamp(20px, 2.4vw, 30px);
}
.cv__chip {
  padding: 9px 16px;
  border: 1px solid #dfe1f5;
  border-radius: 12px;
  background: #f7f8ff;
  color: #3730a3;
  font-size: 15px;
  font-weight: 700;
  text-decoration: none;
  transition: transform .18s, background .18s, border-color .18s;
}
.cv__chip:hover {
  transform: translateY(-2px);
  border-color: #b9bff0;
  background: #e9ecff;
}
.cv__card .cv__foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 20px;
  margin-top: clamp(24px, 3vw, 36px);
  padding-top: 18px;
  border-top: 1px solid #eef0f8;
  color: #7b8199;
  font-size: 13px;
  line-height: 1.6;
}
.cv__card .cv__foot b { color: #4f46e5; font-weight: 700; }
.cv__enter {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin-top: 24px;
  padding: 11px 22px;
  border: 1px solid #cfd3f5;
  border-radius: 999px;
  background: rgba(255, 255, 255, .85);
  color: #3730a3;
  font-size: 14px;
  font-weight: 700;
  text-decoration: none;
  box-shadow: 0 8px 20px rgba(67, 56, 202, .1);
  transition: transform .18s, box-shadow .18s;
}
.cv__enter:hover { transform: translateY(-2px); box-shadow: 0 12px 26px rgba(67, 56, 202, .16); }
.cv__enter span { font-size: 16px; }

:global(.dark) .cv { background: linear-gradient(135deg, #1b1e33 0%, #202441 48%, #191c30 100%); }
:global(.dark) .cv__grid {
  background-image:
    linear-gradient(rgba(165, 180, 252, .06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(165, 180, 252, .06) 1px, transparent 1px);
}
:global(.dark) .cv__card { border-color: #3d4266; background: #20233a; box-shadow: 0 24px 60px rgba(0, 0, 0, .3); }
:global(.dark) .cv__card .cv__eyebrow { border-color: #3d4266; color: #a5b4fc; }
:global(.dark) .cv__dot { background: #a5b4fc; }
:global(.dark) .cv__card .cv__title { color: #eef0ff; }
:global(.dark) .cv__card .cv__sub { color: #aeb6d4; }
:global(.dark) .cv__card .cv__slogan { color: #a5b4fc; }
:global(.dark) .cv__chip { border-color: #3d4266; background: #2a2e4c; color: #c7d0ff; }
:global(.dark) .cv__chip:hover { border-color: #6d64f0; background: #33385e; }
:global(.dark) .cv__card .cv__foot { border-color: #353a52; color: #98a0bd; }
:global(.dark) .cv__card .cv__foot b { color: #a5b4fc; }
:global(.dark) .cv__enter { border-color: #3d4266; background: rgba(32, 35, 58, .9); color: #a5b4fc; }

@media (max-width: 720px) {
  .cv { min-height: 0; padding: 24px 12px 22px; margin-bottom: 32px; border-radius: 18px; }
  .cv__card { padding: 26px 20px; border-radius: 20px; }
  .cv__card .cv__eyebrow { font-size: 11px; padding: 6px 12px; }
  .cv__card .cv__title { margin-top: 18px; font-size: 38px; }
  .cv__card .cv__sub { font-size: 15px; }
  .cv__card .cv__slogan { font-size: 19px; margin-top: 18px; }
  .cv__slogan-br { display: block; }
  .cv__chips { gap: 8px; }
  .cv__chip { padding: 8px 12px; font-size: 13px; }
  .cv__card .cv__foot { flex-direction: column; align-items: flex-start; font-size: 11px; margin-top: 22px; }
  .cv__enter { margin-top: 18px; padding: 10px 18px; font-size: 13px; }
}
</style>
