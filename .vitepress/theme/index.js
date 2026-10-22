import DefaultTheme from 'vitepress/theme'
import { useRoute } from 'vitepress'
import { h, onMounted, onUnmounted, watch } from 'vue'
import { observeReadingOverflow } from './reading-overflow.js'
import './custom.css'

export default {
  extends: DefaultTheme,
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
      return () => h(DefaultTheme.Layout)
    }
  }
}
