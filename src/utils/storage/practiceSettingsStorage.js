export const DEFAULT_PRACTICE_SETTINGS = {
  readNewWordAloud: false,
  unlearnedNavOnly: false,
  autoTranslateOnLoad: false,
  autoExpandUsage: false,
  showRefreshMeaningAction: true,
  showIncorrectAction: true,
  showTranslateAction: true,
  showDictionarySubtitle: true,
}

const PRACTICE_SETTINGS_KEY = 'practiceSettings'

export function loadPracticeSettings() {
  try {
    const raw = localStorage.getItem(PRACTICE_SETTINGS_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return { ...DEFAULT_PRACTICE_SETTINGS, ...(parsed && typeof parsed === 'object' ? parsed : {}) }
  } catch {
    return DEFAULT_PRACTICE_SETTINGS
  }
}

export function savePracticeSettings(settings) {
  localStorage.setItem(PRACTICE_SETTINGS_KEY, JSON.stringify(settings))
}
