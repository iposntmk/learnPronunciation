import { useCallback, useEffect, useRef, useState } from 'react'

function getSupportedMimeType() {
  if (typeof MediaRecorder === 'undefined') return ''
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ]
  return candidates.find(type => MediaRecorder.isTypeSupported(type)) || ''
}

function microphoneErrorMessage(error) {
  const isDenied = error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError'
  return isDenied
    ? 'Microphone permission is blocked. Enable Microphone from the lock icon in the address bar.'
    : `Microphone error: ${error.message}`
}

export function useAudioRecorder() {
  const [countdown, setCountdown] = useState(0)
  const [recordingUrl, setRecordingUrl] = useState(null)
  const [isPlayingBack, setIsPlayingBack] = useState(false)
  const [recorderError, setRecorderError] = useState(null)
  const mediaRecorderRef = useRef(null)
  const streamRef = useRef(null)
  const audioRef = useRef(null)
  const timeoutRef = useRef(null)
  const countdownRef = useRef(null)
  const blobRef = useRef(null)
  const cancelStopRef = useRef(false)

  useEffect(() => () => {
    if (recordingUrl) URL.revokeObjectURL(recordingUrl)
  }, [recordingUrl])

  const clearTimers = useCallback(() => {
    clearTimeout(timeoutRef.current)
    clearInterval(countdownRef.current)
  }, [])

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
  }, [])

  const stopRecording = useCallback(() => {
    clearTimers()
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop()
  }, [clearTimers])

  const cancelRecording = useCallback(() => {
    cancelStopRef.current = true
    clearTimers()
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop()
    stopTracks()
  }, [clearTimers, stopTracks])

  const clearRecording = useCallback(() => {
    cancelRecording()
    blobRef.current = null
    setRecordingUrl(null)
    setIsPlayingBack(false)
    setRecorderError(null)
  }, [cancelRecording])

  const startRecording = useCallback(({ duration, onRecorded, onEmpty, onStarted } = {}) => {
    const seconds = Number.isFinite(duration) ? duration : 3
    cancelRecording()
    cancelStopRef.current = false
    setRecorderError(null)
    setRecordingUrl(null)

    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        streamRef.current = stream
        const mimeType = getSupportedMimeType()
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {})
        mediaRecorderRef.current = recorder
        const chunks = []

        recorder.ondataavailable = event => {
          if (event.data.size > 0) chunks.push(event.data)
        }
        recorder.onstop = async () => {
          clearTimers()
          stopTracks()
          if (cancelStopRef.current) return
          if (chunks.length === 0) {
            const message = 'No audio was recorded. Try again.'
            setRecorderError(message)
            onEmpty?.(message)
            return
          }
          const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
          blobRef.current = blob
          setRecordingUrl(URL.createObjectURL(blob))
          await onRecorded?.(blob)
        }

        recorder.start(100)
        onStarted?.()
        setCountdown(seconds)
        countdownRef.current = setInterval(() => {
          setCountdown(prev => Math.max(0, prev - 1))
        }, 1000)
        timeoutRef.current = setTimeout(() => {
          if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop()
        }, seconds * 1000)
      })
      .catch(error => {
        setRecorderError(microphoneErrorMessage(error))
      })
  }, [cancelRecording, clearTimers, stopTracks])

  const playbackRecording = useCallback(() => {
    if (!recordingUrl || !audioRef.current) return
    if (isPlayingBack) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setIsPlayingBack(false)
      return
    }
    audioRef.current.src = recordingUrl
    audioRef.current.onended = () => setIsPlayingBack(false)
    audioRef.current.play().then(() => setIsPlayingBack(true)).catch(() => setIsPlayingBack(false))
  }, [isPlayingBack, recordingUrl])

  const playBlobSegment = useCallback(async ({ audioOffset, audioDuration }) => {
    if (!blobRef.current || audioOffset === null) return
    try {
      const audioBuffer = await blobRef.current.arrayBuffer()
      const context = new AudioContext()
      const buffer = await context.decodeAudioData(audioBuffer)
      const source = context.createBufferSource()
      source.buffer = buffer
      source.connect(context.destination)
      source.start(0, audioOffset, audioDuration > 0.02 ? audioDuration : undefined)
      source.onended = () => context.close()
    } catch {
      // Segment playback is best effort.
    }
  }, [])

  return {
    audioRef,
    countdown,
    recordingUrl,
    isPlayingBack,
    recorderError,
    setRecorderError,
    startRecording,
    stopRecording,
    clearRecording,
    playbackRecording,
    playBlobSegment,
  }
}
