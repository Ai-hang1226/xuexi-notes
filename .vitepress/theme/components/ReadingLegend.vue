<script setup>
// 读题三色图例：复习时一眼看懂题干高亮的含义。
// 用法：在页面顶部放 <ReadingLegend />，替代原来的纯文字「读题标记」行。
// 颜色与 custom.css 的 rv-object / rv-period / rv-target 严格一致。
</script>

<template>
  <div class="rl" role="note" aria-label="读题标记图例">
    <span class="rl__label">读题标记</span>
    <span class="rl__item rl--object"><i></i><b>蓝色</b>对象／范围</span>
    <span class="rl__sep">·</span>
    <span class="rl__item rl--period"><i></i><b>橙色</b>时间／条件／陷阱词</span>
    <span class="rl__sep">·</span>
    <span class="rl__item rl--target"><i></i><b>绿色</b>问题／要求</span>
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
