export function firstNumber(...values) {
  for (const value of values) {
    const number = Number(value)
    if (Number.isFinite(number)) return number
  }
  return null
}

function clampScore(value) {
  const number = firstNumber(value)
  if (number == null) return null
  const normalized = number >= 0 && number <= 1 ? number * 100 : number
  return Math.round(Math.max(0, Math.min(100, normalized)))
}

function getCaseInsensitive(obj, key) {
  if (!obj || typeof obj !== 'object') return undefined
  if (Object.prototype.hasOwnProperty.call(obj, key)) return obj[key]
  const found = Object.keys(obj).find(item => item.toLowerCase() === key.toLowerCase())
  return found ? obj[found] : undefined
}

function firstValue(obj, keys) {
  for (const key of keys) {
    const value = getCaseInsensitive(obj, key)
    if (value !== undefined && value !== null && value !== '') return value
  }
  return null
}

function walkJson(node, visit) {
  if (Array.isArray(node)) {
    node.forEach(item => walkJson(item, visit))
    return
  }
  if (!node || typeof node !== 'object') return
  visit(node)
  Object.values(node).forEach(value => walkJson(value, visit))
}

export function stressFlag(value) {
  if (value === true || value === 'true' || value === 'stressed' || value === 'primary') return true
  if (value === false || value === 'false' || value === 'unstressed' || value === 'none') return false
  const number = Number(value)
  if (!Number.isFinite(number)) return null
  if (number === 0) return false
  if (number === 1) return true
  return null
}

function normalizeSyllable(node, index) {
  if (!node || typeof node !== 'object') return null
  const text = firstValue(node, ['syllable', 'text', 'content', 'label', 'phone', 'letters'])
  const score = clampScore(firstValue(node, ['stressScore', 'stress_score', 'score', 'Score', 'qualityScore']))
  const expectedStress = firstValue(node, ['expectedStress', 'stressLevel', 'stress_level', 'stressType', 'standardStress'])
  const actualStress = firstValue(node, ['actualStress', 'detectedStress', 'stress', 'isStress', 'stressStatus'])
  const errorType = firstValue(node, ['errorType', 'stressError', 'stress_error', 'status'])
  if (text == null && score == null && expectedStress == null && actualStress == null && errorType == null) return null
  return {
    index,
    text: String(text || ''),
    score,
    expectedStress,
    actualStress,
    errorType: errorType == null ? null : String(errorType),
  }
}

function collectSyllables(raw) {
  const syllables = []
  walkJson(raw, node => {
    Object.entries(node).forEach(([key, value]) => {
      if (!key.toLowerCase().includes('syll')) return
      const items = Array.isArray(value) ? value : [value]
      items.forEach(item => {
        const syllable = normalizeSyllable(item, syllables.length)
        if (syllable) syllables.push(syllable)
      })
    })
  })
  return syllables
}

function collectStressScore(raw) {
  let score = null
  walkJson(raw, node => {
    if (score != null) return
    score = clampScore(firstValue(node, ['stressScore', 'stress_score', 'wordStressScore']))
  })
  return score
}

function buildIssues(syllables, backendIssues = []) {
  const issues = backendIssues.map(issue => ({ ...issue }))
  syllables.forEach(syllable => {
    const expected = stressFlag(syllable.expectedStress)
    const actual = stressFlag(syllable.actualStress)
    const errorType = String(syllable.errorType || '').toLowerCase()
    const mismatch = expected !== null && actual !== null && expected !== actual
    const stressError = errorType.includes('stress') && !errorType.includes('correct')
    const lowScore = syllable.score != null && syllable.score < 65
    if (mismatch || stressError || lowScore) {
      issues.push({
        type: 'stress',
        syllableIndex: syllable.index,
        score: syllable.score,
        expectedStress: syllable.expectedStress,
        actualStress: syllable.actualStress,
      })
    }
  })
  return issues
}

export function normalizeSpeechSuperResult(payload, referenceText) {
  const raw = payload?.raw || payload || {}
  const syllables = Array.isArray(payload?.syllables)
    ? payload.syllables.map((syllable, index) => ({ index, ...syllable }))
    : collectSyllables(raw)
  return {
    status: payload?.status || 'success',
    provider: payload?.provider || 'speechsuper',
    words: Array.isArray(payload?.words) ? payload.words : [],
    syllables,
    issues: buildIssues(syllables, Array.isArray(payload?.issues) ? payload.issues : []),
    stressScore: payload?.stressScore ?? collectStressScore(raw),
    referenceText,
    raw,
  }
}
