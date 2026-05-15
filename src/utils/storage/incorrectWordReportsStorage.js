const INCORRECT_WORD_REPORTS_KEY = 'incorrectWordReports'

export function loadIncorrectWordReports() {
  try {
    const raw = localStorage.getItem(INCORRECT_WORD_REPORTS_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

export function saveIncorrectWordReports(reports) {
  localStorage.setItem(INCORRECT_WORD_REPORTS_KEY, JSON.stringify(reports))
}
