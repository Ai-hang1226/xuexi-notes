export const reviewModules = ['政治理论', '常识判断', '言语理解', '数量关系', '图形推理', '定义判断', '类比推理', '逻辑判断', '资料分析']

export function moduleFromSearch(search = '') {
  const selected = new URLSearchParams(search).get('module')
  return reviewModules.includes(selected) ? selected : '全部'
}
