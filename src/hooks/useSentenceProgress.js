import { useCallback, useEffect, useState } from 'react'
import { listMySentenceProgress, saveSentencePronunciationResult } from '../supabaseData.js'

export function useSentenceProgress() {
  const [sentenceProgress, setSentenceProgress] = useState({})

  const refreshSentenceProgress = useCallback(async () => {
    const rows = await listMySentenceProgress()
    const next = {}
    rows.forEach(row => {
      const id = row.sentences?.id
      if (!id) return
      next[id] = {
        learned: Boolean(row.is_learned),
        score: Number.isFinite(Number(row.last_score)) ? Math.round(Number(row.last_score)) : null,
        prosodyScore: Number.isFinite(Number(row.prosody_score)) ? Math.round(Number(row.prosody_score)) : null,
      }
    })
    setSentenceProgress(next)
  }, [])

  useEffect(() => {
    refreshSentenceProgress().catch(err => console.warn('[Supabase] sentence progress load failed:', err.message))
  }, [refreshSentenceProgress])

  const saveSentenceResult = async (sentenceId, result) => {
    await saveSentencePronunciationResult(sentenceId, result)
    await refreshSentenceProgress()
  }

  return {
    sentenceProgress,
    refreshSentenceProgress,
    saveSentenceResult,
  }
}
