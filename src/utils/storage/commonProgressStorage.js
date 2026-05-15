const COMMON_3000_LEARNED_KEY = 'common3000LearnedWords'
const COMMON_3000_SCORES_KEY = 'common3000LearnedScores'

export function loadLearnedCommonWords() {
  try {
    const raw = localStorage.getItem(COMMON_3000_LEARNED_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(parsed) ? parsed : [])
  } catch {
    return new Set()
  }
}

export function saveLearnedCommonWords(words) {
  localStorage.setItem(COMMON_3000_LEARNED_KEY, JSON.stringify([...words].sort()))
}

export function loadCommonWordScores() {
  try {
    const raw = localStorage.getItem(COMMON_3000_SCORES_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

export function saveCommonWordScores(scores) {
  localStorage.setItem(COMMON_3000_SCORES_KEY, JSON.stringify(scores))
}
