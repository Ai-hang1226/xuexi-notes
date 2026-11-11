<script setup>
// 读题三色图例：复习时一眼看懂题干高亮的含义。
// 用法：在页面顶部放 <ReadingLegend />（行测/默认）或 <ReadingLegend variant="shenlun" />（申论）。
// 颜色与 custom.css 的 rv-object / rv-period / rv-target 严格一致；三色语义全站同构，仅名词适配文体。
import { computed } from 'vue'

const props = defineProps({
  variant: { type: String, default: 'xingce' },
})

const ITEMS = {
  xingce: [
    ['object', '蓝色', '对象／范围'],
    ['period', '橙色', '时间／条件／陷阱词'],
    ['target', '绿色', '问题／要求'],
  ],
  shenlun: [
    ['object', '蓝色', '作答对象／材料范围'],
    ['period', '橙色', '字数／格式／限制'],
    ['target', '绿色', '任务动词／作答要素'],
  ],
}
const items = computed(() => ITEMS[props.variant] || ITEMS.xingce)
</script>

<template>
  <div class="rl" role="note" aria-label="读题标记图例">
    <span class="rl__label">读题标记</span>
    <template v-for="(it, i) in items" :key="it[0]">
      <span v-if="i" class="rl__sep">·</span>
      <span class="rl__item" :class="'rl--' + it[0]"><i></i><b>{{ it[1] }}</b>{{ it[2] }}</span>
    </template>
    <p v-if="variant === 'shenlun'" class="rl__note">
      材料层另有标记：蓝色＝做法／措施，绿色＝成效／变化，用于原题材料页，与上面的题干三色分工不同。
    </p>
  </div>
</template>

<style scoped>
.rl {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 12px;
  margin: 0 0 20px;
  padding: 10px 14px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  background: var(--vp-c-bg-soft);
  font-family: var(--vp-font-family-base);
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--vp-c-text-2);
}
.rl__label { font-weight: 800; color: var(--vp-c-text-1); }
.rl__item { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
.rl__item i { width: 10px; height: 10px; border-radius: 3px; flex: 0 0 auto; }
.rl__item b { font-weight: 700; }
.rl__sep { color: var(--vp-c-text-3); }
.rl__note {
  flex: 1 0 100%;
  margin: 2px 0 0;
  font-size: 11.5px;
  line-height: 1.55;
  color: var(--vp-c-text-3);
}
.rl--object i { background: #e1ecff; border: 1px solid #174887; }
.rl--object b { color: #174887; }
.rl--period i { background: #ffedc7; border: 1px solid #76510d; }
.rl--period b { color: #76510d; }
.rl--target i { background: #d9f3e7; border: 1px solid #155e4c; }
.rl--target b { color: #155e4c; }

:global(.dark) .rl--object i { background: #243e63; border-color: #c8ddff; }
:global(.dark) .rl--object b { color: #c8ddff; }
:global(.dark) .rl--period i { background: #5d4522; border-color: #ffe4ad; }
:global(.dark) .rl--period b { color: #ffe4ad; }
:global(.dark) .rl--target i { background: #214c3d; border-color: #bcefd9; }
:global(.dark) .rl--target b { color: #bcefd9; }

@media (max-width: 680px) {
  .rl { gap: 6px 10px; padding: 9px 11px; font-size: 11.5px; }
  .rl__sep { display: none; }
}
</style>
