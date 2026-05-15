import { useCallback, useEffect, useState } from 'react'
import { listMyProgress, savePronunciationResult, setWordLearned } from '../supabaseData.js'
import {
  loadCommonWordScores,
  loadLearnedCommonWords,
  saveCommonWordScores,
  saveLearnedCommonWords,
} from '../utils/storage/commonProgressStorage.js'

export function useProgress() {
  const [learnedCommonWords, setLearnedCommonWords] = useState(() => loadLearnedCommonWords())
  const [commonWordScores, setCommonWordScores] = useState(() => loadCommonWordScores())

  const refreshProgress = useCallback(async () => {
    const rows = await listMyProgress()
    const learned = new Set()
    const scores = {}
    rows.forEach(row => {
      const key = row.words?.word?.toLowerCase()
      if (!key) return
      if (row.is_learned) learned.add(key)
      if (Number.isFinite(Number(row.last_score))) scores[key] = Math.round(Number(row.last_score))
    })
    setLearnedCommonWords(learned)
    setCommonWordScores(scores)
    saveLearnedCommonWords(learned)
    saveCommonWordScores(scores)
  }, [])

  useEffect(() => {
    refreshProgress().catch(err => console.warn('[Supabase] progress load failed:', err.message))
  }, [refreshProgress])

  const toggleCommonLearned = async (word, learned, score = null, meta = {}) => {
    const key = word.toLowerCase()
    setLearnedCommonWords(prev => {
      const next = new Set(prev)
      if (learned) next.add(key)
      else next.delete(key)
      saveLearnedCommonWords(next)
      return next
    })
    setCommonWordScores(prev => {
      const next = { ...prev }
      if (learned && Number.isFinite(score)) next[key] = Math.round(score)
      if (!learned) delete next[key]
      saveCommonWordScores(next)
      return next
    })
    try {
      await setWordLearned(word, learned, score, meta)
      await refreshProgress()
    } catch (err) {
      console.warn('[Supabase] learned sync failed:', err.message)
    }
  }

  const saveWordPronunciationResult = async (word, result, meta = {}) => {
    const key = word.toLowerCase()
    setCommonWordScores(prev => {
      const next = { ...prev, [key]: Math.round(result?.overall ?? 0) }
      saveCommonWordScores(next)
      return next
    })
    await savePronunciationResult(word, result, meta)
    await refreshProgress()
  }

  return {
    learnedCommonWords,
    commonWordScores,
    refreshProgress,
    toggleCommonLearned,
    saveWordPronunciationResult,
  }
}
