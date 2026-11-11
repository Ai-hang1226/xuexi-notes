import DefaultTheme from 'vitepress/theme'
import { useRoute } from 'vitepress'
import { h, onMounted, onUnmounted, watch } from 'vue'
import { observeReadingOverflow } from './reading-overflow.js'
import SiteEnhancements from './components/SiteEnhancements.vue'
import VisualCards from './components/VisualCards.vue'
import LinkCards from './components/LinkCards.vue'
import SectionNav from './components/SectionNav.vue'
import ChapterNav from './components/ChapterNav.vue'
import BreakPointCard from './components/BreakPointCard.vue'
import ReadingLegend from './components/ReadingLegend.vue'
import './custom.css'
import './brand.css'
import './links.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    // 全局注册：任意 Markdown 页面填好 frontmatter 列表后直接写 <VisualCards field="..." />
    app.component('VisualCards', VisualCards)
    // 全局注册：把蓝色下划线链接列表换成入口卡片
    app.component('LinkCards', LinkCards)
    // 全站通用章节导航：任意板块导航页写 <SectionNav section="板块键" />
    app.component('SectionNav', SectionNav)
    app.component('ChapterNav', ChapterNav)
    // 题目破题点卡片：内联在题干下写 <BreakPointCard title="..." :points="[...]" />
    app.component('BreakPointCard', BreakPointCard)
    // 读题三色图例：页面顶部放 <ReadingLegend />
    app.component('ReadingLegend', ReadingLegend)
  },
  Layout: {
    setup() {
      const route = useRoute()
      let disconnect = () => {}
      let revision = 0
      const refresh = async () => {
        const current = ++revision
        disconnect()
        const stop = await observeReadingOverflow()
        if (current !== revision) stop()
        else disconnect = stop
      }
      onMounted(refresh)
      watch(() => route.path, refresh, { flush: 'post' })
      onUnmounted(() => { revision++; disconnect() })
      return () => h(DefaultTheme.Layout, null, {
        'layout-top': () => h(SiteEnhancements),
      })
    }
  }
}
