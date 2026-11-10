<script setup>
// 兼容别名：言语体系页仍写 <ChapterNav />，实际渲染全站通用的 SectionNav。
// 这样所有板块的章节卡片共用同一套组件与样式，视觉完全一致。
import SectionNav from './SectionNav.vue'
</script>

<template>
  <SectionNav section="yanyu" />
</template>
