import { normalizeSpeechSuperResult } from './speechSuperNormalize.js'
import { audioBlobToPcmWav } from '../audio/audioWav.js'

const STRESS_CONFUSING_WORDS = new Set([
  'record',
  'present',
  'permit',
  'english',
  'university',
  'object',
  'project',
  'produce',
  'conduct',
  'contest',
  'content',
  'desert',
  'export',
  'import',
  'progress',
  'subject',
])

const IPA_VOWEL_RE = /[iɪeɛæɑɒɔʌəɜuʊaɐo]/u

function cleanWord(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z']/g, '')
}

function countWrittenVowelGroups(word) {
  const normalized = cleanWord(word).replace(/e$/, '')
  return normalized.match(/[aeiouy]+/g)?.length || 0
}

function hasVowelSound(phoneme) {
  return IPA_VOWEL_RE.test(String(phoneme?.ipa || phoneme?.text || ''))
}

function countStressBearingGroups(phonemes = []) {
  const groups = phonemes.filter(hasVowelSound).length
  return groups || 0
}

function uniqueMessages(messages) {
  const seen = new Set()
  return messages.filter(message => {
    const key = message.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function shouldAssessStress(referenceText, phonemes = []) {
  if (String(referenceText || '').trim().split(/\s+/).length > 1) return false
  const word = cleanWord(referenceText)
  if (!word) return false
  if (STRESS_CONFUSING_WORDS.has(word)) return true
  const phonemeGroups = countStressBearingGroups(phonemes)
  return (phonemeGroups || countWrittenVowelGroups(word)) >= 2
}

export async function callSpeechSuper(audioBlob, text) {
  const proxyUrl = import.meta.env?.VITE_SPEECHSUPER_PROXY_URL
  if (!proxyUrl) throw new Error('VITE_SPEECHSUPER_PROXY_URL chưa được cấu hình.')
  const wavBlob = await audioBlobToPcmWav(audioBlob)
  const formData = new FormData()
  formData.append('audio', wavBlob, 'speechsuper.wav')
  formData.append('text', text)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10000)
  try {
    const response = await fetch(proxyUrl, { method: 'POST', body: formData, signal: controller.signal })
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new Error(`SpeechSuper ${response.status}: ${detail.slice(0, 160)}`)
    }
    return normalizeSpeechSuperResult(await response.json(), text)
  } finally {
    clearTimeout(timer)
  }
}

export function generateCombinedFeedback(azureResult, speechSuperResult) {
  const result = normalizeSpeechSuperResult(speechSuperResult, speechSuperResult?.referenceText || azureResult?.spokenWord || '')
  if (result.status !== 'success') return []
  const word = result.word || cleanWord(azureResult?.spokenWord) || 'từ'
  const syllables = result.syllables || []
  const messages = []

  // 1. Trọng âm: so sánh âm tiết chuẩn (refStress===1) với âm tiết người đọc nhấn (actualStress===1)
  const expected = syllables.find(s => s.refStress === 1)
  const actual = syllables.find(s => s.actualStress === 1)
  if (expected && actual && expected.index !== actual.index) {
    messages.push(`Trọng âm sai: bạn nhấn vào âm tiết "${actual.spell}" (thứ ${actual.index + 1}), nhưng "${word}" cần nhấn "${expected.spell}" (thứ ${expected.index + 1}). Đọc "${expected.spell}" to và dài hơn.`)
  } else if (expected && !actual) {
    messages.push(`Trọng âm chưa rõ: hãy nhấn mạnh âm tiết "${expected.spell}" (thứ ${expected.index + 1}) — đọc to, cao và dài hơn các âm tiết còn lại.`)
  }

  // 2. Âm đọc sai (mispronunciation substitution): /chuẩn/ nghe thành /sai/
  for (const m of (result.mispronunciations || []).slice(0, 2)) {
    if (m.standard && m.mistaken && m.standard !== m.mistaken) {
      messages.push(`Âm /${m.standard}/ bạn đọc nghe như /${m.mistaken}/; chú ý phát âm /${m.standard}/.`)
    }
  }

  // 3. Âm tiết điểm thấp (mà chưa nhắc ở trên)
  for (const s of syllables.filter(s => s.score != null && s.score < 60).slice(0, 2)) {
    if (!messages.some(msg => msg.includes(`"${s.spell}"`))) {
      messages.push(`Âm tiết "${s.spell}" /${s.phonetic}/ còn yếu (${s.score}/100); luyện đọc lại âm tiết này.`)
    }
  }

  // 4. Trọng âm tổng còn thấp nhưng chưa bắt được chi tiết
  if (!messages.length && result.stressScore != null && result.stressScore < 65) {
    messages.push(expected
      ? `Trọng âm "${word}" còn yếu (${result.stressScore}/100); nhấn mạnh âm tiết "${expected.spell}" (thứ ${expected.index + 1}).`
      : `Trọng âm "${word}" còn yếu (${result.stressScore}/100); hãy nghe mẫu và nhấn âm tiết chính rõ hơn.`)
  }

  return uniqueMessages(messages).slice(0, 4)
}

function mergeStressSuccess(azureResult, speechSuperResult) {
  return {
    ...azureResult,
    stressAssessment: speechSuperResult,
    combinedFeedback: generateCombinedFeedback(azureResult, speechSuperResult),
    stressScore: speechSuperResult.stressScore ?? null,
  }
}

function mergeStressFailure(azureResult, reason) {
  return {
    ...azureResult,
    stressAssessment: { status: 'failed', provider: 'speechsuper', reason },
    combinedFeedback: [],
    stressScore: null,
  }
}

export async function assessWithStress(audioBlob, referenceText, { phonemes = [], language = 'en-US', scoreAzure, onStressUpdate } = {}) {
  if (typeof scoreAzure !== 'function') throw new Error('Missing Azure scoring function.')
  if (language !== 'en-US' || !shouldAssessStress(referenceText, phonemes)) return scoreAzure()

  // Tiến độ (giải pháp A): trả điểm Azure ngay, chấm trọng âm SpeechSuper chạy nền,
  // xong thì gọi onStressUpdate để vá kết quả vào UI → người dùng không phải chờ.
  if (typeof onStressUpdate === 'function') {
    const azureResult = await scoreAzure()
    callSpeechSuper(audioBlob, referenceText)
      .then(speechSuperResult => onStressUpdate(mergeStressSuccess(azureResult, speechSuperResult)))
      .catch(err => {
        console.warn('[SpeechSuper] stress assessment failed:', err.message)
        onStressUpdate(mergeStressFailure(azureResult, err.message))
      })
    return azureResult
  }

  // Mặc định: chạy song song, trả kết quả đã gộp
  const [azureSettled, stressSettled] = await Promise.allSettled([
    scoreAzure(),
    callSpeechSuper(audioBlob, referenceText),
  ])
  if (azureSettled.status === 'rejected') throw azureSettled.reason
  const azureResult = azureSettled.value

  return stressSettled.status === 'rejected'
    ? (console.warn('[SpeechSuper] stress assessment failed:', stressSettled.reason?.message),
       mergeStressFailure(azureResult, stressSettled.reason?.message))
    : mergeStressSuccess(azureResult, stressSettled.value)
}
