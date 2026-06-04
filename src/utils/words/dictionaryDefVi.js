import { fetchVietnameseTranslation } from './wordStudyFields.js'

// Dịch definition tiếng Anh (theo loại từ) sang tiếng Việt, cache vào localStorage.
const CACHE_KEY = 'dictDefViCache'

function loadCache() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function saveCache(cache) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)) } catch { /* ignore quota */ }
}

export async function translateDefinitionVi(defEn) {
  const key = String(defEn || '').trim()
  if (!key) return ''
  const cache = loadCache()
  if (cache[key]) return cache[key]
  const vi = await fetchVietnameseTranslation(key, 'english')
  cache[key] = vi
  saveCache(cache)
  return vi
}
