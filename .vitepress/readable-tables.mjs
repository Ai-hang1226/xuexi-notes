// Keep short labels together while allowing prose cells to wrap normally.
export function readableTables(md) {
  md.core.ruler.after('inline', 'readable-tables', (state) => {
    const tokens = state.tokens
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].type !== 'table_open') continue
      let end = i + 1
      while (end < tokens.length && tokens[end].type !== 'table_close') end++
      const columns = tokens.slice(i, end).filter(t => t.type === 'th_open').length
      tokens[i].attrJoin('class', 'study-table')
      tokens[i].attrSet('style', `--table-columns:${columns}`)
      let column = 0
      for (let j = i + 1; j < end; j++) {
        if (tokens[j].type === 'tr_open') column = 0
        if (!['th_open', 'td_open'].includes(tokens[j].type)) continue
        const inline = tokens[j + 1]
        const text = inline?.type === 'inline' ? inline.content.trim() : ''
        const prose = inline?.children?.filter(t => ['text', 'code_inline'].includes(t.type)).map(t => t.content).join('') || ''
        if (prose.replace(/\s/g, '').length > 24) tokens[j].attrJoin('class', 'table-prose')
        if (column === 0 && text && text.length <= 16 && !/[<>$\n]/.test(text)) {
          tokens[j].attrJoin('class', 'table-short-label')
        }
        column++
      }
      i = end
    }
  })
  const close = md.renderer.rules.table_close || ((t, i, o, e, s) => s.renderToken(t, i, o))
  md.renderer.rules.table_open = (tokens, index, options, env, self) =>
    '<div class="table-scroll" role="region" aria-label="学习表格，宽表可左右滚动" tabindex="0">' + self.renderToken(tokens, index, options)
  md.renderer.rules.table_close = (...args) => close(...args) + '</div>\n'
}
