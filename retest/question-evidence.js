const fenbiExactPattern = /已按粉笔题库核对题干、选项和参考答案/
const fenbiReferencePattern = /参考答案来自粉笔|粉笔回忆版参考|按粉笔回忆版参考/
const disputedPattern = /答案有争议|不同回忆版|不同资料.*差异|选项顺序不同|存在分歧|仍有两种解释/
const userConfirmedPattern = /按用户.*确认.*判为|用户确认的个人复测标准/

export function getAnswerEvidence(question, skillRepository = '') {
  const note = question?.gradingNote || question?.reviewNote || question?.referenceNote || ''
  const sourceUrl = question?.sourceUrl || ''

  if (userConfirmedPattern.test(note)) {
    return { key: 'personal', label: '个人确认的复测口径', explanation: '这是本站采用的个人复测判分口径，不代表考试机关公布答案。' }
  }
  if (disputedPattern.test(note)) {
    return { key: 'disputed', label: '资料版本存在差异', explanation: '请先查看题面版本与说明，再决定是否把本题得分作为判断依据。' }
  }
  if (fenbiExactPattern.test(note)) {
    return { key: 'fenbi', label: '粉笔题库核对（回忆题面）', explanation: '题干、选项和参考答案已按粉笔题库核对；回忆版不等同考试机关公布原卷。' }
  }
  if (fenbiReferencePattern.test(note)) {
    return { key: 'fenbi-reference', label: '粉笔回忆版参考', explanation: '参考答案来自粉笔回忆版；题面差异和官方答案情况请看题目说明。' }
  }
  if (note.includes('未逐题与粉笔核对') || (skillRepository && (question?.sourceSystem === skillRepository || sourceUrl.includes(`/${skillRepository}/`)))) {
    return { key: 'upstream', label: '上游题源答案·未逐题粉笔核对', explanation: '当前按固定上游题源答案判分，尚未逐题与粉笔核对。' }
  }
  if (note.includes('粉笔')) {
    return { key: 'fenbi-reference', label: '粉笔参考·版本见说明', explanation: note }
  }
  if (note) {
    return { key: 'noted', label: '参考口径见题目说明', explanation: note }
  }
  return { key: 'unknown', label: '答案核验状态未标明', explanation: '本站有参考答案，但当前记录没有标明粉笔核对情况。' }
}

export function getAnswerEvidenceForCatalog(entry, questionById, skillRepository = '') {
  const question = entry?.quizId ? questionById.get(entry.quizId) : null
  if (question) return getAnswerEvidence(question, skillRepository)

  if (entry?.status === '答案有争议') return { key: 'disputed', label: '答案有争议', explanation: entry.reviewNote || '' }
  if (['待核对', '题面不完整', '题源待补充', '候选题待核对', '检索受限', '检索未完成', '尚未检索'].includes(entry?.status)) {
    return { key: 'unknown', label: '题源或答案待核', explanation: entry.reviewNote || '' }
  }
  if (entry?.status === '真题已归位·未自动判分') {
    return { key: 'unknown', label: '题目已归位·答案待核', explanation: entry.reviewNote || '已找到对应真题记录，但答案仍需完成逐题核验。' }
  }
  if (entry?.status === '可自动判分') {
    return { key: 'unknown', label: '自动判分·核验状态未标明', explanation: entry.reviewNote || '题目有可判分答案，但现有条目没有说明是否按粉笔题库逐题核对。' }
  }
  return null
}
