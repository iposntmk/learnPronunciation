// Trích IPA từ response dictionaryapi.dev, group theo entry (mỗi entry ~ 1 loại từ).
// Accent suy ra từ tên file audio (.../word-us.mp3, .../word-uk.mp3); không audio → không accent.
const ACCENT_RE = /-(uk|us|au|ca|in)\.mp3(?:\?.*)?$/i

function cleanIpa(text) {
  return String(text || '').trim().replace(/^\/|\/$/g, '')
}

function accentFromAudio(audio) {
  const match = String(audio || '').match(ACCENT_RE)
  return match ? match[1].toUpperCase() : ''
}

// → [{ label, ipas: [{ ipa, accent, audio }] }] ; bỏ entry rỗng, dedupe IPA trong từng entry.
export function parseDictionaryPhonetics(entries) {
  if (!Array.isArray(entries)) return []
  const groups = []
  for (const entry of entries) {
    const seen = new Set()
    const ipas = []
    for (const p of (entry?.phonetics || [])) {
      const ipa = cleanIpa(p?.text)
      if (!ipa) continue
      const accent = accentFromAudio(p?.audio)
      const key = `${ipa}|${accent}`
      if (seen.has(key)) continue
      seen.add(key)
      ipas.push({ ipa, accent, audio: p?.audio || '' })
    }
    if (!ipas.length) continue
    const meanings = entry?.meanings || []
    const label = [...new Set(meanings.map(m => m?.partOfSpeech).filter(Boolean))].join(', ')
    const definitionEn = meanings.map(m => m?.definitions?.[0]?.definition).find(Boolean) || ''
    groups.push({ label, definitionEn, ipas })
  }
  return groups
}
