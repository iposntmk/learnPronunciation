export function firstNumber(...values) {
  for (const value of values) {
    const number = Number(value)
    if (Number.isFinite(number)) return number
  }
  return null
}

function scoreValue(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return null
  const normalized = number >= 0 && number <= 1 ? number * 100 : number
  return Math.round(Math.max(0, Math.min(100, normalized)))
}

function intOrNull(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

// Chấp nhận cả payload đã chuẩn hoá (từ backend) lẫn item thô (ref_stress/stress)
function normalizeSyllables(list = []) {
  return list.map((item, index) => ({
    index,
    spell: String(item.spell ?? item.text ?? ''),
    phonetic: String(item.phonetic ?? item.ipa ?? ''),
    score: scoreValue(item.score ?? item.overall),
    refStress: intOrNull(item.refStress ?? item.ref_stress),
    actualStress: intOrNull(item.actualStress ?? item.stress),
  }))
}

const FAILED = (referenceText, reason) => ({
  status: 'failed',
  provider: 'speechsuper',
  word: referenceText || '',
  overall: null,
  pronunciationScore: null,
  stressScore: null,
  syllables: [],
  phonemes: [],
  mispronunciations: [],
  issues: [],
  reason: reason ?? null,
  referenceText,
})

export function normalizeSpeechSuperResult(payload, referenceText) {
  if (!payload || typeof payload !== 'object') return FAILED(referenceText)
  if (payload.status && payload.status !== 'success') return FAILED(referenceText, payload.reason)

  return {
    status: 'success',
    provider: payload.provider || 'speechsuper',
    word: payload.word || referenceText || '',
    overall: scoreValue(payload.overall),
    pronunciationScore: scoreValue(payload.pronunciationScore),
    stressScore: scoreValue(payload.stressScore),
    syllables: normalizeSyllables(Array.isArray(payload.syllables) ? payload.syllables : []),
    phonemes: Array.isArray(payload.phonemes) ? payload.phonemes : [],
    mispronunciations: Array.isArray(payload.mispronunciations) ? payload.mispronunciations : [],
    issues: Array.isArray(payload.issues) ? payload.issues : [],
    referenceText,
  }
}
