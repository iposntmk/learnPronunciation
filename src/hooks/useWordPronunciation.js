import { useCallback, useEffect, useState } from 'react'
import { scoreWord } from '../scorer.js'
import { useAudioRecorder } from './useAudioRecorder.js'

export function useWordPronunciation({
  phonemes,
  lang,
  recordingDuration,
  canScoreWord,
  isResolvingPhonemes,
  lookupNote,
  onScoreResult,
}) {
  const [phase, setPhase] = useState('ready')
  const [errorMsg, setErrorMsg] = useState(null)
  const [result, setResult] = useState(null)
  const [selectedIdx, setSelectedIdx] = useState(null)
  const {
    audioRef,
    countdown,
    recordingUrl,
    isPlayingBack,
    recorderError,
    setRecorderError,
    startRecording: startAudioRecording,
    stopRecording,
    clearRecording,
    playbackRecording,
    playBlobSegment,
  } = useAudioRecorder()

  useEffect(() => {
    if (recorderError) setErrorMsg(recorderError)
  }, [recorderError])

  const startBlobRecording = useCallback(() => {
    startAudioRecording({
      duration: recordingDuration,
      onStarted: () => setPhase('recording'),
      onEmpty: message => {
        setErrorMsg(message)
        setPhase('ready')
      },
      onRecorded: async blob => {
        setPhase('scoring')
        try {
          const data = await scoreWord(blob, phonemes, lang)
          setResult(data)
          setPhase('result')
          Promise.resolve(onScoreResult?.(data)).catch(err => console.warn('[Supabase] score sync failed:', err.message))
        } catch (err) {
          setErrorMsg(`Scoring error: ${err.message}`)
          setPhase('ready')
        }
      },
    })
  }, [lang, onScoreResult, phonemes, recordingDuration, startAudioRecording])

  const startRecording = useCallback(() => {
    if (isResolvingPhonemes) {
      setErrorMsg('Resolving IPA for this word...')
      return
    }
    if (!canScoreWord) {
      setErrorMsg(lookupNote || 'This word does not have a reliable IPA yet.')
      return
    }
    clearRecording()
    setErrorMsg(null)
    setRecorderError(null)
    startBlobRecording()
  }, [canScoreWord, clearRecording, isResolvingPhonemes, lookupNote, setRecorderError, startBlobRecording])

  const playPhoneme = useCallback(async phoneme => {
    playBlobSegment(phoneme)
  }, [playBlobSegment])

  const reset = useCallback(() => {
    clearRecording()
    setPhase('ready')
    setResult(null)
    setSelectedIdx(null)
    setErrorMsg(null)
  }, [clearRecording])

  const resetAndRecord = useCallback(() => {
    clearRecording()
    setResult(null)
    setSelectedIdx(null)
    setErrorMsg(null)
    startBlobRecording()
  }, [clearRecording, startBlobRecording])

  return {
    audioRef,
    countdown,
    recordingUrl,
    isPlayingBack,
    phase,
    errorMsg,
    result,
    selectedIdx,
    setSelectedIdx,
    startRecording,
    stopRecording,
    reset,
    resetAndRecord,
    playbackRecording,
    playPhoneme,
  }
}
