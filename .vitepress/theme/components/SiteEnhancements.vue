<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vitepress'

const progress = ref(0)
const showTop = ref(false)
const route = useRoute()

const onScroll = () => {
  const h = document.documentElement
  const max = h.scrollHeight - h.clientHeight
  progress.value = max > 0 ? Math.min(100, (h.scrollTop / max) * 100) : 0
  showTop.value = h.scrollTop > 420
}
const reset = () => {
  progress.value = 0
  showTop.value = false
  requestAnimationFrame(onScroll)
}
const toTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll, { passive: true })
  onScroll()
})
watch(() => route.path, reset, { flush: 'post' })
onUnmounted(() => {
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', onScroll)
})
</script>

<template>
  <div class="site-progress" :style="{ transform: `scaleX(${progress / 100})` }" aria-hidden="true"></div>
  <button class="back-top" :class="{ show: showTop }" type="button" aria-label="返回顶部" @click="toTop">↑</button>
</template>
