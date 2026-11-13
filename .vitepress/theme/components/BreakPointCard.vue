<script setup>
// 题目「破题点」卡片：内联在每道题的题干/选项之后，指出抓什么词、问什么、排除什么。
// 用法（Markdown 里一行）：
//   <BreakPointCard
//     title="先定问法：选非，再回原文比对范围"
//     :points="[
//       { k: '问法', v: '下列说法错误的是 —— 选非，找证据最明确的错误项' },
//       { k: '对象', v: '空气中微塑料的主要驱动因素' },
//       { k: '标志', v: '「可能」表推测；「部分大洲」不可扩大为整体' },
//       { k: '排除', v: 'D 把部分地区＋可能性说成整体、确定，故选 D' },
//     ]" />
// k 会自动按三类着色：问法/问题/要求→绿；对象/范围/主体→蓝；时间/条件/标志/排除→橙。
// 也支持 tone 覆盖整卡左边框颜色：info/good/warn/bad。
import { computed } from 'vue'

const props = defineProps({
  title: { type: String, default: '破题点' },
  points: { type: Array, default: () => [] },
  tone: { type: String, default: '' },
})

const KIND = {
  // 绿：问什么
  问法: 'target', 问题: 'target', 要求: 'target', 任务: 'target', 设问: 'target',
  // 蓝：对象/范围
  对象: 'object', 范围: 'object', 主体: 'object', 话题: 'object',
  // 橙：时间/条件/标志/排除
  时间: 'period', 条件: 'period', 标志: 'period', 关联: 'period', 排除: 'period', 陷阱: 'period', 转折: 'period',
}
const toneOf = (k) => KIND[k] || 'plain'

// 有 tone 时用整体色调，否则由各行的 k 决定
const accent = computed(() => props.tone || '')
</script>

<template>
  <section v-if="points && points.length" class="bp" :class="accent ? 'bp--' + accent : ''" aria-label="破题点">
    <div class="bp__head"><span class="bp__badge">破题点</span><span class="bp__title">{{ title }}</span></div>
    <ul class="bp__list">
      <li v-for="(p, i) in points" :key="i" class="bp__row" :class="'bp--' + toneOf(p.k)">
        <span class="bp__key">{{ p.k }}</span>
        <span class="bp__val">{{ p.v }}</span>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.bp {
  --bp-tone: #4f46e5;
  margin: 16px 0 22px;
  padding: 13px 15px 14px;
  border: 1px solid var(--vp-c-divider);
  border-left: 4px solid var(--bp-tone);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
  font-family: var(--vp-font-family-base);
  color: var(--vp-c-text-1);
}
.bp--good { --bp-tone: #0d9488; }
.bp--warn { --bp-tone: #c2770a; }
.bp--bad  { --bp-tone: #dc2626; }

.bp__head { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 10px; margin-bottom: 10px; }
.bp__badge {
  flex: 0 0 auto;
  padding: 3px 9px;
  border-radius: 999px;
  background: var(--bp-tone);
  color: #fff;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .04em;
  line-height: 1.4;
}
.bp__title { font-size: 14px; font-weight: 700; line-height: 1.5; overflow-wrap: anywhere; }

.bp__list { list-style: none; margin: 0; padding: 0; display: grid; gap: 7px; }
.bp__row {
  --k-color: var(--vp-c-text-2);
  --k-bg: var(--vp-c-divider);
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  gap: 10px;
  align-items: start;
  min-width: 0;
  font-size: 13px;
  line-height: 1.65;
}
.bp--target { --k-color: #155e4c; --k-bg: #d9f3e7; }   /* 绿 = 问法/要求 */
.bp--object { --k-color: #174887; --k-bg: #e1ecff; }   /* 蓝 = 对象/范围 */
.bp--period { --k-color: #76510d; --k-bg: #ffedc7; }   /* 橙 = 时间/条件/标志/排除 */
.bp__key {
  justify-self: start;
  min-width: 42px;
  padding: 1px 7px;
  border-radius: 6px;
  background: var(--k-bg);
  color: var(--k-color);
  font-size: 11px;
  font-weight: 800;
  text-align: center;
  white-space: nowrap;
}
.bp__val { color: var(--vp-c-text-1); overflow-wrap: anywhere; }
.bp--plain .bp__key { color: var(--vp-c-text-2); }

:global(.dark .bp--target){ --k-color: #bcefd9; --k-bg: #214c3d; }
:global(.dark .bp--object){ --k-color: #c8ddff; --k-bg: #243e63; }
:global(.dark .bp--period){ --k-color: #ffe4ad; --k-bg: #5d4522; }
:global(.dark .bp__badge){ filter: brightness(1.2); }

@media (max-width: 680px) {
  .bp { padding: 12px; }
  .bp__row { grid-template-columns: 38px minmax(0, 1fr); gap: 8px; font-size: 12.5px; }
  .bp__key { min-width: 38px; padding: 1px 5px; }
}
</style>
