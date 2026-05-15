import { useState } from 'react'
import { loadPracticeSettings, savePracticeSettings } from '../utils/storage/practiceSettingsStorage.js'

export function usePracticeSettings() {
  const [practiceSettings, setPracticeSettingsState] = useState(() => loadPracticeSettings())
  const [recordingDurationSetting, setRecordingDurationSetting] = useState(() => {
    const saved = localStorage.getItem('recordingDuration')
    return saved ? parseInt(saved, 10) : 3
  })
  const [sentenceRecordingDurationSetting, setSentenceRecordingDurationSetting] = useState(() => {
    const saved = localStorage.getItem('sentenceRecordingDuration')
    return saved ? parseInt(saved, 10) : 8
  })

  const setPracticeSettings = (nextSettings) => {
    setPracticeSettingsState(nextSettings)
    savePracticeSettings(nextSettings)
  }

  const changeRecordingDurationSetting = (value) => {
    const next = Math.max(1, Math.min(10, value))
    setRecordingDurationSetting(next)
    localStorage.setItem('recordingDuration', next)
  }

  const changeSentenceRecordingDurationSetting = (value) => {
    const next = Math.max(3, Math.min(30, value))
    setSentenceRecordingDurationSetting(next)
    localStorage.setItem('sentenceRecordingDuration', next)
  }

  return {
    practiceSettings,
    setPracticeSettings,
    recordingDurationSetting,
    changeRecordingDurationSetting,
    sentenceRecordingDurationSetting,
    changeSentenceRecordingDurationSetting,
  }
}
