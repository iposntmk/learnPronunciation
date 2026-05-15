export function cleanPracticeWord(value) {
  return String(value || '').toLowerCase().replace(/[^a-z'-]/g, '').trim()
}
