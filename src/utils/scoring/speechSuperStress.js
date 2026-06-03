import { firstNumber, normalizeSpeechSuperResult, stressFlag } from './speechSuperNormalize.js'
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

const KNOWN_PRIMARY_STRESS_INDEX = {
  english: 0,
  record: 0,
  present: 0,
  university: 3,
}

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

function expectedStressIndexFromPhonemes(phonemes = []) {
  let vowelIndex = 0
  for (const phoneme of phonemes) {
    if (!hasVowelSound(phoneme)) continue
    if (phoneme.isStressed) return vowelIndex
    vowelIndex += 1
  }
  return null
}

function expectedStressIndexFromSyllables(syllables = []) {
  const hit = syllables.find(syllable => stressFlag(syllable.expectedStress) === true)
  return hit ? hit.index : null
}

function actualStressIndexFromSyllables(syllables = []) {
  const hit = syllables.find(syllable => stressFlag(syllable.actualStress) === true)
  return hit ? hit.index : null
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
  const word = cleanWord(result.referenceText) || cleanWord(azureResult?.spokenWord) || 'word'
  const expectedIndex = expectedStressIndexFromSyllables(result.syllables)
    ?? expectedStressIndexFromPhonemes(azureResult?.phonemes)
    ?? KNOWN_PRIMARY_STRESS_INDEX[word]
    ?? null
  const actualIndex = actualStressIndexFromSyllables(result.syllables)
  let messages = []
  if (result.issues.length && actualIndex != null && expectedIndex != null && actualIndex !== expectedIndex) {
    messages = [`Bạn nhấn sai âm tiết thứ ${actualIndex + 1} của từ "${word}"; từ này cần nhấn âm tiết thứ ${expectedIndex + 1}.`]
  } else {
    messages = result.issues.map(issue => {
      const wrongIndex = firstNumber(issue.actualSyllableIndex, issue.actualIndex, issue.syllableIndex, actualIndex)
      const correctIndex = firstNumber(issue.expectedSyllableIndex, issue.expectedIndex, expectedIndex)
      if (wrongIndex != null && correctIndex != null && wrongIndex !== correctIndex) {
        return `Bạn nhấn sai âm tiết thứ ${wrongIndex + 1} của từ "${word}"; từ này cần nhấn âm tiết thứ ${correctIndex + 1}.`
      }
      if (correctIndex != null) {
        return `Từ "${word}" cần nhấn âm tiết thứ ${correctIndex + 1}; hãy nói âm tiết đó rõ và mạnh hơn.`
      }
      return `Trọng âm của từ "${word}" chưa rõ; hãy thử nhấn âm tiết chính mạnh hơn.`
    })
  }
  if (!messages.length && result.stressScore != null && result.stressScore < 65) {
    messages.push(`Trọng âm của từ "${word}" còn yếu; hãy nghe mẫu và nhấn âm tiết chính rõ hơn.`)
  }
  return uniqueMessages(messages).slice(0, 3)
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
