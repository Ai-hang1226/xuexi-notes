<script setup>
// 通用「长文字 → 视觉卡片」组件。
// 用法：在页面 frontmatter 里写一个列表（默认键名 cards），然后放 <VisualCards field="cards" />。
// 每条支持：icon / tag / title / before / after / body / steps[] / status / tone / link / linkText
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'

const props = defineProps({
  field: { type: String, default: 'cards' },
  title: { type: String, default: '' },
  hint: { type: String, default: '' },
  columns: { type: Number, default: 3 },
})

const { page } = useData()
const base = (p) => withBase(p)
const cards = computed(() => {
  const value = page.value?.frontmatter?.[props.field]
  return Array.isArray(value) ? value : []
})
</script>

<template>
  <section v-if="cards.length" class="vc" aria-label="要点卡片">
    <header v-if="title || hint" class="vc__head">
      <h2 v-if="title">{{ title }}</h2>
      <span v-if="hint">{{ hint }}</span>
    </header>

    <div class="vc__grid" :style="{ '--vc-cols': columns }">
      <article v-for="(card, i) in cards" :key="i" class="vc-card" :class="'vc-tone-' + (card.tone || 'info')">
        <div class="vc-card__top">
          <span class="vc-card__icon" aria-hidden="true">{{ card.icon || '•' }}</span>
          <span v-if="card.tag" class="vc-card__tag">{{ card.tag }}</span>
          <span v-if="card.status" class="vc-card__status">{{ card.status }}</span>
        </div>

        <h3 v-if="card.title" class="vc-card__title">{{ card.title }}</h3>

        <div v-if="card.before || card.after" class="vc-change">
          <div v-if="card.before" class="vc-change__row">
            <span class="vc-change__label vc-change__label--before">原</span>
            <span class="vc-change__text">{{ card.before }}</span>
          </div>
          <div v-if="card.after" class="vc-change__row">
            <span class="vc-change__label vc-change__label--after">改</span>
            <span class="vc-change__text">{{ card.after }}</span>
          </div>
        </div>

        <p v-if="card.body" class="vc-card__body">{{ card.body }}</p>

        <!-- 步骤条：纵向有序列表，序号统一在左列，天然对齐，不依赖换行箭头 -->
        <ol v-if="card.steps && card.steps.length" class="vc-steps">
          <li v-for="(step, j) in card.steps" :key="j">
            <span class="vc-steps__no" aria-hidden="true">{{ j + 1 }}</span>
            <span class="vc-steps__text">{{ step }}</span>
          </li>
        </ol>

        <a v-if="card.link" class="vc-card__link" :href="base(card.link)">{{ card.linkText || '看逐题原文 →' }}</a>
      </article>
    </div>
  </section>
</template>

<style scoped>
.vc { margin: 28px 0 32px; font-family: var(--vp-font-family-base); color: var(--vp-c-text-1); }
.vc__head { display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: 6px 16px; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid var(--vp-c-divider); }
.vc__head h2 { margin: 0; font-size: 21px; }
.vc__head span { color: var(--vp-c-text-2); font-size: 13px; }
.vc__grid { display: grid; grid-template-columns: repeat(var(--vc-cols), minmax(0, 1fr)); gap: 14px; align-items: stretch; }

.vc-card {
  --vc-tone: #4f46e5;
  --vc-soft: rgba(79, 70, 229, .09);
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  height: 100%;
  min-width: 0;
  padding: 18px;
  border: 1px solid var(--vp-c-divider);
  border-left: 4px solid var(--vc-tone);
  border-radius: 14px;
  background: var(--vp-c-bg-soft);
}
.vc-tone-good { --vc-tone: #0d9488; --vc-soft: rgba(13, 148, 136, .1); }
.vc-tone-warn { --vc-tone: #c2770a; --vc-soft: rgba(217, 119, 6, .1); }
.vc-tone-bad { --vc-tone: #dc2626; --vc-soft: rgba(225, 29, 72, .09); }
.vc-tone-info { --vc-tone: #4f46e5; --vc-soft: rgba(79, 70, 229, .09); }
.vc-tone-muted { --vc-tone: #64748b; --vc-soft: rgba(100, 116, 139, .09); }

.vc-card__top { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; min-height: 30px; }
.vc-card__icon { flex: 0 0 auto; display: grid; place-items: center; width: 30px; height: 30px; border-radius: 9px; background: var(--vc-soft); font-size: 17px; }
.vc-card__tag { color: var(--vc-tone); font-size: 12px; font-weight: 700; letter-spacing: .02em; }
.vc-card__status { margin-left: auto; padding: 3px 8px; border-radius: 999px; background: var(--vc-soft); color: var(--vc-tone); font-size: 11px; font-weight: 700; white-space: nowrap; }
.vc-card__title { margin: 14px 0 0; font-size: 16px; line-height: 1.5; }

/* 原 / 改：label 固定列宽 + 顶对齐，文字多行也不影响徽章位置 */
.vc-change { margin: 14px 0 0; padding: 12px 13px; border-radius: 10px; background: var(--vc-soft); display: grid; gap: 8px; }
.vc-change__row { display: grid; grid-template-columns: 20px minmax(0, 1fr); gap: 8px; align-items: start; }
.vc-change__label { display: grid; place-items: center; width: 20px; height: 20px; border-radius: 5px; background: var(--vp-c-bg); color: var(--vc-tone); font-size: 11px; font-weight: 700; line-height: 1; }
.vc-change__label--before { background: #f1f5f9; color: var(--vp-c-text-2); }
.vc-change__text { font-size: 13px; line-height: 1.65; overflow-wrap: anywhere; }
.vc-change__row:first-child .vc-change__text { color: var(--vp-c-text-2); }
.vc-change__row:last-child .vc-change__text { color: var(--vp-c-text-1); font-weight: 700; }

.vc-card__body { margin: 13px 0 0; font-size: 13px; line-height: 1.8; color: var(--vp-c-text-2); }

/* 步骤条：每个步骤 = 固定 22px 序号列 + 文字列；纵向排列，不换行悬挂 */
.vc-steps {
  list-style: none;
  margin: 14px 0 0;
  padding: 0 0 0 11px;
  border-left: 1px solid var(--vc-tone); /* 一条竖线把步骤串起来，替代箭头 */
  display: grid;
  gap: 8px;
}
.vc-steps li { display: grid; grid-template-columns: 22px minmax(0, 1fr); gap: 9px; align-items: start; min-width: 0; }
.vc-steps__no {
  display: grid;
  place-items: center;
  justify-self: start;
  width: 20px;
  height: 20px;
  margin-left: -22px; /* 让圆点压在竖线上 */
  border: 2px solid var(--vp-c-bg-soft);
  border-radius: 50%;
  background: var(--vc-tone);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
.vc-steps__text { font-size: 12px; line-height: 1.6; color: var(--vp-c-text-1); overflow-wrap: anywhere; }

.vc-card__link { display: block; margin-top: auto; padding-top: 16px; color: var(--vc-tone); font-size: 12px; font-weight: 700; text-decoration: none; }
.vc-card__link:hover { text-decoration: underline; }

:global(.dark) .vc-card__tag,
:global(.dark) .vc-card__status,
:global(.dark) .vc-card__link { filter: brightness(1.35); }
:global(.dark) .vc-change__label--before { background: #303544; color: #cbd5e1; }
:global(.dark) .vc-steps__no { border-color: var(--vp-c-bg-soft); color: #fff; }

@media (max-width: 1080px) { .vc__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 680px) {
  .vc__grid { grid-template-columns: 1fr; }
  .vc-card { padding: 16px; }
  .vc-card__status { margin-left: 0; }
}
</style>
