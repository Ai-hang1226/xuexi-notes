<script setup>
import { computed, ref } from 'vue'
import { withBase } from 'vitepress'

const base = (p) => withBase(p)

const modes = [
  { key: 'growth', label: '增长率', a: '基期量 A', b: '现期量 B', unitA: '', unitB: '' },
  { key: 'base', label: '求基期', a: '增长率 r（%）', b: '现期量 B', unitA: '%', unitB: '' },
  { key: 'share', label: '比重', a: '部分量 a', b: '整体量 b', unitA: '', unitB: '' },
  { key: 'contribution', label: '贡献率', a: '部分增量 Δa', b: '整体增量 Δb', unitA: '', unitB: '' },
]
const mode = ref('growth')
const a = ref('')
const b = ref('')
const current = computed(() => modes.find((m) => m.key === mode.value))

const num = (v) => {
  const n = Number(String(v).replace(/,/g, '').trim())
  return Number.isFinite(n) ? n : null
}
const result = computed(() => {
  const x = num(a.value)
  const y = num(b.value)
  if (x === null || y === null) return null
  if (mode.value === 'growth') {
    if (x === 0) return null
    const r = ((y - x) / x) * 100
    return { label: '增长率', value: r.toFixed(2) + '%', formula: `r = (${y} − ${x}) ÷ ${x} × 100%` }
  }
  if (mode.value === 'base') {
    const d = 1 + x / 100
    if (d === 0) return null
    const base = y / d
    return { label: '基期量', value: base.toFixed(2), formula: `基期 = ${y} ÷ (1 + ${x}%)` }
  }
  if (y === 0) return null
  const r = (x / y) * 100
  return {
    label: mode.value === 'share' ? '比重' : '贡献率',
    value: r.toFixed(2) + '%',
    formula: `${mode.value === 'share' ? '比重' : '贡献率'} = ${x} ÷ ${y} × 100%`,
  }
})
const switchMode = (key) => { mode.value = key; a.value = ''; b.value = '' }

const fractions = Array.from({ length: 19 }, (_, i) => i + 2).map((n) => {
  const v = 100 / n
  return { n, pct: Number.isInteger(v) ? String(v) + '%' : v.toFixed(1) + '%' }
})
const pick = (n) => {
  a.value = '1'
  b.value = String(n)
  mode.value = 'share'
}
</script>

<template>
  <div class="qc">
    <div class="qc-card">
      <h3 class="qc-card__title">选一个要算的量</h3>
      <div class="qc-modes" role="group" aria-label="计算类型">
        <button v-for="m in modes" :key="m.key" type="button" :class="{ active: mode === m.key }" @click="switchMode(m.key)">{{ m.label }}</button>
      </div>
      <div class="qc-inputs">
        <label>{{ current.a }} <small>{{ current.unitA }}</small>
          <input v-model="a" type="number" step="any" inputmode="decimal" :placeholder="current.a" />
        </label>
        <span class="qc-op">÷</span>
        <label>{{ current.b }} <small>{{ current.unitB }}</small>
          <input v-model="b" type="number" step="any" inputmode="decimal" :placeholder="current.b" />
        </label>
      </div>
      <div class="qc-result" :class="{ empty: !result }">
        <template v-if="result">
          <span>{{ result.label }}</span>
          <b>{{ result.value }}</b>
          <code>{{ result.formula }}</code>
        </template>
        <template v-else><span>填入两个数字后立即出结果</span></template>
      </div>
      <p class="qc-tip">💡 先认量的含义再代数：增长率看「比谁多」，比重看「占谁的比」，贡献率用「增量比增量」。</p>
    </div>

    <div class="qc-card">
      <h3 class="qc-card__title">百化分速查 <small>点一下代入「比重」试算</small></h3>
      <div class="qc-fractions">
        <button v-for="f in fractions" :key="f.n" type="button" @click="pick(f.n)">
          <b>1/{{ f.n }}</b><span>{{ f.pct }}</span>
        </button>
      </div>
      <p class="qc-tip">考场不必算到小数位：看到 1/7 直接换 14.3%，先定方向再精算。</p>
      <div class="qc-links">
        <a :href="base('/xingce/资料分析读数与百化分速查')">📊 读数与百化分 1—20</a>
        <a :href="base('/xingce/ziliao-fenxi')">资料分析方法库 →</a>
      </div>
    </div>
  </div>
</template>

<style scoped>
.qc { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr); gap: 18px; font-family: var(--vp-font-family-base); color: var(--vp-c-text-1); }
.qc-card { padding: 22px; border: 1px solid var(--vp-c-divider); border-radius: 16px; background: var(--vp-c-bg-soft); }
.qc-card__title { margin: 0 0 16px; font-size: 17px; }
.qc-card__title small { margin-left: 8px; color: var(--vp-c-text-2); font-size: 12px; font-weight: 400; }
.qc-modes { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
.qc-modes button { padding: 8px 14px; border: 1px solid var(--vp-c-divider); border-radius: 999px; background: var(--vp-c-bg); color: var(--vp-c-text-2); font: inherit; font-size: 14px; cursor: pointer; }
.qc-modes button:hover { border-color: #a5a0ea; color: #4f46e5; }
.qc-modes button.active { border-color: #4f46e5; background: #4f46e5; color: #fff; font-weight: 700; }
.qc-inputs { display: grid; grid-template-columns: 1fr auto 1fr; gap: 12px; align-items: end; }
.qc-inputs label { display: grid; gap: 7px; font-size: 14px; font-weight: 700; }
.qc-inputs label small { color: var(--vp-c-text-2); font-weight: 400; }
.qc-inputs input { width: 100%; padding: 11px 12px; border: 1px solid var(--vp-c-divider); border-radius: 8px; background: var(--vp-c-bg); color: var(--vp-c-text-1); font: inherit; font-size: 17px; }
.qc-inputs input:focus { outline: 3px solid var(--vp-c-brand-soft); border-color: #4f46e5; }
.qc-op { padding-bottom: 10px; color: var(--vp-c-text-2); font-size: 20px; }
.qc-result { display: grid; gap: 6px; margin-top: 20px; padding: 18px; border: 1px solid #d8d5f8; border-left: 4px solid #4f46e5; border-radius: 12px; background: rgba(79, 70, 229, .06); }
.qc-result span { color: var(--vp-c-text-2); font-size: 12px; }
.qc-result b { color: #3730a3; font-size: 32px; line-height: 1.1; font-variant-numeric: tabular-nums; }
.qc-result code { color: var(--vp-c-text-2); font-size: 12px; }
.qc-result.empty { border-color: var(--vp-c-divider); background: var(--vp-c-bg); }
.qc-result.empty span { padding: 8px 0; }
.qc-tip { margin: 16px 0 0; color: var(--vp-c-text-2); font-size: 12px; line-height: 1.7; }
.qc-fractions { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 7px; }
.qc-fractions button { display: grid; gap: 2px; padding: 8px 2px; border: 1px solid var(--vp-c-divider); border-radius: 8px; background: var(--vp-c-bg); color: var(--vp-c-text-1); cursor: pointer; font-family: var(--vp-font-family-base); }
.qc-fractions button:hover { border-color: #4f46e5; background: rgba(79, 70, 229, .06); }
.qc-fractions b { font-size: 13px; }
.qc-fractions span { color: var(--vp-c-text-2); font-size: 11px; }
.qc-links { display: flex; flex-wrap: wrap; gap: 8px 18px; margin-top: 16px; }
.qc-links a { color: #4f46e5; font-size: 13px; font-weight: 700; }
:global(.dark) .qc-result b { color: #a5b4fc; }
:global(.dark) .qc-modes button.active { background: #6366f1; }
@media (max-width: 900px) { .qc { grid-template-columns: 1fr; } }
@media (max-width: 520px) { .qc-fractions { grid-template-columns: repeat(5, minmax(0, 1fr)); } .qc-inputs { grid-template-columns: 1fr; } .qc-op { display: none; } }
</style>
