import { nextTick } from 'vue'

// Show a cue only when a reading region actually contains content off-screen.
export async function observeReadingOverflow() {
  await nextTick()
  const regions = [
    ...Array.from(document.querySelectorAll('.table-scroll')).map(host => ({ host, content: host, kind: 'table' })),
    ...Array.from(document.querySelectorAll('.vp-doc mjx-container[display="true"]')).map(host => ({ host, content: host, kind: 'formula' })),
    ...Array.from(document.querySelectorAll('.vp-doc div[class*="language-"] > pre')).map(content => ({ host: content.parentElement, content, kind: 'outline' }))
  ]
  const update = () => {
    for (const { host, content, kind } of regions) {
      const overflow = content.clientWidth > 0 && content.scrollWidth > content.clientWidth + 2
      if (overflow) {
        host.dataset.readingOverflow = kind
        if (kind === 'formula') host.setAttribute('tabindex', '0')
      } else {
        delete host.dataset.readingOverflow
        if (kind === 'formula') host.removeAttribute('tabindex')
      }
    }
  }
  const observer = new ResizeObserver(update)
  for (const { host, content } of regions) {
    observer.observe(host)
    if (host !== content) observer.observe(content)
    for (const child of content.children) observer.observe(child)
  }
  update()
  return () => observer.disconnect()
}
