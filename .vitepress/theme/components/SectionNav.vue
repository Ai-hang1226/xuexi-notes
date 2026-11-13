<script setup>
import { computed } from 'vue'
import { withBase } from 'vitepress'
import data from '../../../data/section-nav.json'

// 全站通用章节导航：每个板块的数据由 scripts/gen-section-nav.mjs 从体系页标题生成。
// 用法：<SectionNav section="shuliang" />
const props = defineProps({ section: { type: String, required: true } })
const cfg = computed(() => data.sections[props.section] || null)
const chapters = computed(() => cfg.value?.chapters || [])
const pointCount = computed(() => chapters.value.reduce((s, c) => s + c.points.length, 0))
const base = (p) => withBase(p)
const href = (link) => {
  const [p, hash] = link.split('#')
  return base(p) + (hash ? '#' + hash : '')
}
</script>

<template>
  <div v-if="cfg" class="cn">
    <div class="cn__summary">
      <span>共 <b>{{ chapters.length }}</b> 章</span>
      <span><b>{{ pointCount }}</b> 个要点</span>
      <span class="cn__hint">按正文顺序排列</span>
    </div>

    <a class="cn__full" :href="base(cfg.sourceLink)">
      <span class="cn__full-icon">📖</span>
      <span>{{ cfg.sourceLabel }}</span>
      <span class="cn__full-arrow">→</span>
    </a>

    <div class="cn__list">
      <a v-for="c in chapters" :key="c.title + c.anchor" class="cn-card" :href="href(c.link)">
        <span class="cn-card__no">{{ c.no }}</span>
        <span class="cn-card__main">
          <b>{{ c.title }}</b>
          <span class="cn-card__points">
            <i v-for="(p, i) in c.points" :key="p + i">{{ p }}</i>
            <i v-if="!c.points.length">见正文</i>
          </span>
        </span>
        <span class="cn-card__go" aria-hidden="true">→</span>
      </a>
    </div>
  </div>
</template>

<style scoped>
.cn { margin: 22px 0 10px; font-size: 15px; }
.cn__summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 18px;
  margin-bottom: 14px;
  color: var(--vp-c-text-2);
  font-size: 13px;
}
.cn__summary b { color: var(--vp-c-brand-1); font-size: 16px; font-variant-numeric: tabular-nums; }
.cn__hint { margin-left: auto; }
.cn__full {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px 18px;
  border: 1px solid #cfd3f5;
  border-radius: 14px;
  background: linear-gradient(90deg, #f4f5ff, #fafaff);
  color: #3730a3;
  font-size: 15px;
  font-weight: 700;
  text-decoration: none;
  transition: transform .18s, box-shadow .18s;
}
.cn__full:hover { transform: translateY(-2px); box-shadow: 0 10px 22px rgba(79, 70, 229, .13); }
.cn__full:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 3px; }
.cn__full-icon { font-size: 19px; }
.cn__full-arrow { margin-left: auto; font-size: 18px; }

.cn__list { display: grid; gap: 11px; margin-top: 18px; }
.cn-card {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  min-width: 0;
  padding: 16px 18px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 15px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  text-decoration: none;
  transition: transform .18s, border-color .18s, background .18s;
}
.cn-card:hover { transform: translateY(-2px); border-color: var(--vp-c-brand-1); background: var(--vp-c-brand-soft); }
.cn-card:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 3px; }
.cn-card__no {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 44px;
  height: 40px;
  border-radius: 12px;
  background: rgba(79, 70, 229, .1);
  color: #4f46e5;
  font-size: 15px;
  font-weight: 800;
}
.cn-card__main { display: grid; gap: 10px; min-width: 0; }
.cn-card__main > b { font-size: 17px; line-height: 1.4; color: var(--vp-c-text-1); }
.cn-card__points { display: flex; flex-wrap: wrap; gap: 7px; }
.cn-card__points i {
  padding: 4px 10px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-2);
  font-size: 12px;
  font-style: normal;
  line-height: 1.5;
}
.cn-card__go { flex: 0 0 auto; margin-left: auto; color: var(--vp-c-brand-1); font-size: 19px; }

:global(.dark .cn__full){ border-color: #3d4266; background: linear-gradient(90deg, #25294a, #20233a); color: #a5b4fc; }
:global(.dark .cn-card__no){ background: rgba(165, 180, 252, .14); color: #a5b4fc; }

@media (max-width: 720px) {
  .cn__hint { margin-left: 0; width: 100%; }
  .cn-card { padding: 13px; gap: 10px; }
  .cn-card__no { width: 34px; height: 34px; font-size: 14px; }
  .cn-card__main > b { font-size: 15px; }
  .cn-card__go { display: none; }
}
</style>
