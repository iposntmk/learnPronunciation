import { useState, useEffect, useCallback } from 'react'
import { DICTIONARY_CACHE_KEY, DICTIONARY_CATEGORIES_CACHE_KEY, loadDictionaryCache, saveDictionaryCache, supabaseWordToEntry } from '../utils/dictionaryHelpers.js'
import { LEVELS, fetchAllWords, listCategories, listLevels } from '../supabaseData.js'

// Owns all Supabase word/category/level loading + local cache for the dictionary screen.
export function useDictionaryData() {
  const [supabaseWords, setSupabaseWords] = useState([])
  const [supabaseCategories, setSupabaseCategories] = useState([])
  const [supabaseLevels, setSupabaseLevels] = useState(LEVELS)
  const [dictionaryCacheLoaded, setDictionaryCacheLoaded] = useState(false)
  const [dictionaryCachedAt, setDictionaryCachedAt] = useState(null)
  const [supabaseLoading, setSupabaseLoading] = useState(true)
  const [supabaseError, setSupabaseError] = useState(null)

  const refreshDictionary = useCallback(async ({ shouldApply = () => true } = {}) => {
    setSupabaseLoading(true)
    setSupabaseError(null)
    try {
      const [rows, categories] = await Promise.all([fetchAllWords(), listCategories()])
      if (!shouldApply()) return
      const entries = rows.map(supabaseWordToEntry)
      const stamp = new Date().toISOString()
      setSupabaseWords(entries)
      setSupabaseCategories(categories)
      setDictionaryCachedAt(stamp)
      saveDictionaryCache(DICTIONARY_CACHE_KEY, entries)
      saveDictionaryCache(DICTIONARY_CATEGORIES_CACHE_KEY, categories)
    } catch (err) {
      if (shouldApply()) setSupabaseError(err.message)
    } finally {
      if (shouldApply()) setSupabaseLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const id = setTimeout(() => {
      const wordCache = loadDictionaryCache(DICTIONARY_CACHE_KEY)
      const categoryCache = loadDictionaryCache(DICTIONARY_CATEGORIES_CACHE_KEY)
      if (cancelled) return
      if (wordCache?.items) {
        setSupabaseWords(wordCache.items)
        setDictionaryCachedAt(wordCache.updatedAt || null)
        setSupabaseLoading(false)
      }
      if (categoryCache?.items) setSupabaseCategories(categoryCache.items)
      setDictionaryCacheLoaded(true)
    }, 0)
    return () => {
      cancelled = true
      clearTimeout(id)
    }
  }, [])

  useEffect(() => {
    if (!dictionaryCacheLoaded) return
    let cancelled = false
    refreshDictionary({ shouldApply: () => !cancelled })
    return () => { cancelled = true }
  }, [dictionaryCacheLoaded, refreshDictionary])

  useEffect(() => {
    if (!dictionaryCacheLoaded || supabaseCategories.length > 0) return
    let cancelled = false
    listCategories()
      .then(categories => {
        if (cancelled) return
        setSupabaseCategories(categories)
        saveDictionaryCache(DICTIONARY_CATEGORIES_CACHE_KEY, categories)
      })
      .catch(err => { if (!cancelled) setSupabaseError(err.message) })
    return () => { cancelled = true }
  }, [dictionaryCacheLoaded, supabaseCategories.length])

  useEffect(() => {
    let cancelled = false
    listLevels()
      .then(rows => {
        if (cancelled) return
        const codes = rows.map(r => r.code)
        if (codes.length > 0) setSupabaseLevels(codes)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  return {
    supabaseWords, setSupabaseWords,
    supabaseCategories,
    supabaseLevels,
    dictionaryCachedAt, setDictionaryCachedAt,
    supabaseLoading, setSupabaseLoading,
    supabaseError, setSupabaseError,
    refreshDictionary,
  }
}
