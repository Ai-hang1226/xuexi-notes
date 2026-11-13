<script setup>
import { withBase } from 'vitepress'

// 把「一片蓝色下划线的链接列表」换成可扫读的入口卡片。
// 用法：<LinkCards :items="[{ icon:'📝', title:'…', desc:'…', link:'/…' }]" />
const props = defineProps({
  items: { type: Array, default: () => [] },
  title: { type: String, default: '' },
  back: { type: String, default: '' },
  backText: { type: String, default: '返回精选导读' },
  columns: { type: Number, default: 2 },
})
const base = (p) => withBase(p)
</script>

<template>
  <div class="lc">
    <div v-if="title" class="lc__title">{{ title }}</div>
    <div class="lc__grid" :style="{ '--lc-cols': columns }">
      <a v-for="(it, i) in items" :key="it.link + i" class="lc-card" :href="base(it.link)">
        <span class="lc-card__icon">{{ it.icon || '↗' }}</span>
        <span class="lc-card__body">
          <b>{{ it.title }}</b>
          <small v-if="it.desc">{{ it.desc }}</small>
        </span>
        <span class="lc-card__arrow" aria-hidden="true">→</span>
      </a>
    </div>
    <a v-if="back" class="lc-back" :href="base(back)">← {{ backText }}</a>
  </div>
</template>

<style scoped>
.lc { margin: 22px 0 8px; font-size: 15px; }
.lc__title { margin-bottom: 14px; color: var(--vp-c-text-2); font-size: 13px; font-weight: 700; letter-spacing: .08em; }
.lc__grid { display: grid; grid-template-columns: repeat(var(--lc-cols, 2), minmax(0, 1fr)); gap: 12px; }
.lc-card {
  display: flex;
  align-items: center;
  gap: 13px;
  min-width: 0;
  padding: 14px 16px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 14px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  text-decoration: none;
  transition: transform .18s, border-color .18s, background .18s, box-shadow .18s;
}
.lc-card:hover {
  transform: translateY(-2px);
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
  box-shadow: 0 8px 20px rgba(79, 70, 229, .1);
}
.lc-card:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 3px; }
.lc-card__icon {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 11px;
  background: rgba(79, 70, 229, .1);
  font-size: 19px;
  line-height: 1;
}
.lc-card__body { display: grid; gap: 4px; min-width: 0; }
.lc-card__body b { font-size: 15px; font-weight: 700; line-height: 1.45; color: var(--vp-c-text-1); }
.lc-card__body small { font-size: 12px; line-height: 1.5; color: var(--vp-c-text-2); }
.lc-card__arrow { flex: 0 0 auto; margin-left: auto; color: var(--vp-c-brand-1); font-size: 18px; }
.lc-back {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 18px;
  padding: 9px 16px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
  color: var(--vp-c-text-2);
  background: var(--vp-c-bg-soft);
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  transition: color .18s, border-color .18s, background .18s;
}
.lc-back:hover { color: var(--vp-c-brand-1); border-color: var(--vp-c-brand-1); background: var(--vp-c-brand-soft); }
.lc-back:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 3px; }

:global(.dark .lc-card__icon){ background: rgba(165, 180, 252, .14); }

@media (max-width: 720px) {
  .lc__grid { grid-template-columns: 1fr; }
  .lc-card { padding: 12px 13px; }
}
</style>
