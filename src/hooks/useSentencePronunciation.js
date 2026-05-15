import { useCallback, useEffect, useMemo, useState } from 'react'
import { scoreSentence } from '../scorer.js'
import { compactSentenceResultForSave } from '../utils/scoring/sentenceResult.js'
import { useAudioRecorder } from './useAudioRecorder.js'

export function useSentencePronunciation({
  sentenceText,
  lang,
  recordingDuration,
  onSaveResult,
}) {
  const [phase, setPhase] = useState('ready')
  const [errorMsg, setErrorMsg] = useState(null)
  const [result, setResult] = useState(null)
  const [showPhonemeDetails, setShowPhonemeDetails] = useState(false)
  const [visiblePhonemeLimit, setVisiblePhonemeLimit] = useState(48)
  const {
    audioRef,
    countdown,
    recordingUrl,
    isPlayingBack,
    recorderError,
    startRecording: startAudioRecording,
    stopRecording,
    clearRecording,
    playbackRecording,
  } = useAudioRecorder()

  useEffect(() => {
    if (recorderError) setErrorMsg(recorderError)
  }, [recorderError])

  const startRecording = useCallback(() => {
    setErrorMsg(null)
    setResult(null)
    setShowPhonemeDetails(false)
    setVisiblePhonemeLimit(48)
    clearRecording()
    startAudioRecording({
      duration: recordingDuration || 5,
      onStarted: () => setPhase('recording'),
      onEmpty: message => {
        setErrorMsg(message)
        setPhase('ready')
      },
      onRecorded: async blob => {
        setPhase('scoring')
        try {
          const nextResult = await scoreSentence(blob, sentenceText, lang)
          setResult(nextResult)
          setPhase('result')
          Promise.resolve(onSaveResult?.(compactSentenceResultForSave(nextResult)))
            .catch(err => console.warn('[Supabase] sentence score sync failed:', err.message))
        } catch (err) {
          setErrorMsg(`Scoring error: ${err.message}`)
          setPhase('ready')
        }
      },
    })
  }, [clearRecording, lang, onSaveResult, recordingDuration, sentenceText, startAudioRecording])

  const phonemeRows = result?.phonemes || []
  const visiblePhonemeRows = showPhonemeDetails ? phonemeRows.slice(0, visiblePhonemeLimit) : []
  const wordRows = useMemo(() => {
    if (result?.words?.length) return result.words
    return [...new Map(phonemeRows.map(item => [item.word, item]).filter(([word]) => word)).values()]
      .map((item, index) => ({
        index,
        text: item.word,
        score: item.score,
        errorType: null,
      }))
  }, [phonemeRows, result?.words])

  return {
    audioRef,
    countdown,
    recordingUrl,
    isPlayingBack,
    phase,
    errorMsg,
    result,
    showPhonemeDetails,
    setShowPhonemeDetails,
    visiblePhonemeLimit,
    setVisiblePhonemeLimit,
    phonemeRows,
    visiblePhonemeRows,
    wordRows,
    startRecording,
    stopRecording,
    playbackRecording,
  }
}
