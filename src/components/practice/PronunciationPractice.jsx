import { useState, useEffect, useCallback } from 'react'
import { speakNeural } from '../../tts.js'
import { useWordPronunciation } from '../../hooks/useWordPronunciation.js'
import { lookupWord, fetchEnglishDictionaryPhonemes, unsupportedWord } from '../../phonemes/phonemeEngine.js'
import { normalizeLanguage, updateWordIpa, upsertWord } from '../../supabaseData.js'
import { AZURE_TO_LANGUAGE, LANGUAGE_FLAG } from '../../utils/constants/languages.js'
import { DEFAULT_PRACTICE_SETTINGS } from '../../utils/storage/practiceSettingsStorage.js'
import { loadIncorrectWordReports, saveIncorrectWordReports } from '../../utils/storage/incorrectWordReportsStorage.js'
import { formatIpa } from '../../utils/phonemes/phonemeFormat.js'
import { buildWordRelations, buildWordStructures } from '../../utils/words/wordRelations.js'
import { fetchJsonOrNull, fetchVietnameseTranslation } from '../../utils/words/wordStudyFields.js'
import { parseDictionaryPhonetics } from '../../utils/words/dictionaryIpa.js'
import { translateDefinitionVi } from '../../utils/words/dictionaryDefVi.js'
import RecordingConsole from './RecordingConsole.jsx'
import WordPhonemeGrid from './WordPhonemeGrid.jsx'
import WordHeader from './WordHeader.jsx'
import WordIpaPanel from './WordIpaPanel.jsx'
import WordUsagePanel from './WordUsagePanel.jsx'
import RootWordBadge from './RootWordBadge.jsx'
import PracticeStatusMessages from './PracticeStatusMessages.jsx'
import PracticeNavigationActions from './PracticeNavigationActions.jsx'
import StressFeedbackPanel from './StressFeedbackPanel.jsx'
import SpeechSuperTrialBanner from './SpeechSuperTrialBanner.jsx'


export default function PronunciationPractice({
  word,
  meaning,
  metaLine = null,
  lang = 'en-US',
  prebuiltPhonemes = null,
  strictLookup = false,
  compact = false,
  learnedControl = null,
  detail = null,
  source = null,
  onBack,
  onHome = null,
  onLibrary = null,
  onDictionary = null,
  onNext = null,
  onPrev = null,
  onSearchWord = null,
  onScoreResult = null,
  onRefreshMeaning = null,
  practiceSettings = DEFAULT_PRACTICE_SETTINGS,
  recordingDurationSetting = null,
}) {
  const [phonemes, setPhonemes] = useState(() => prebuiltPhonemes || lookupWord(word, { allowGuess: !strictLookup }))
  const [isResolvingPhonemes, setIsResolvingPhonemes] = useState(false)
  const [saveStatus, setSaveStatus] = useState({ loading: false, error: null, saved: false })
  const [useGuessedIpaForScore, setUseGuessedIpaForScore] = useState(false)
  const hasUnverifiedIpa = phonemes.some(p => p.canScore === false && p.ipa && p.ipa !== '?')
  const hasReferenceIpa = phonemes.length > 0 && phonemes.every(p => p.ipa && p.ipa !== '?')
  // Từ ngoài db không có IPA mẫu: vẫn cho thu, Azure chấm theo chữ viết (referenceText).
  const canScoreWord = hasReferenceIpa || lang === 'en-US'
  const lookupNote = phonemes.find(p => p.lookupNote)?.lookupNote || null
  // phases: ready → recording → scoring → result
  const [searchVal, setSearchVal] = useState('')
  const [isUsageExpanded, setIsUsageExpanded] = useState(false)
  const [incorrectReports, setIncorrectReports] = useState(() => loadIncorrectWordReports())
  const [translation, setTranslation] = useState({ word: '', text: '', loading: false, error: null })
  const [meaningRefresh, setMeaningRefresh] = useState({ loading: false, error: null, text: '' })
  const [dictionaryIpas, setDictionaryIpas] = useState([])
  const [dictDefVi, setDictDefVi] = useState({})
  const [ipaSaveStatus, setIpaSaveStatus] = useState({ loading: false, error: null, savedIpa: '' })
  const [ssIpaSaveStatus, setSsIpaSaveStatus] = useState({ loading: false, error: null, savedIpa: '' })
  const [recordingDuration, setRecordingDuration] = useState(() => {
    const saved = localStorage.getItem('recordingDuration')
    return saved ? parseInt(saved, 10) : 3
  })
  const {
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
  } = useWordPronunciation({
    phonemes,
    referenceText: word,
    lang,
    recordingDuration,
    canScoreWord,
    isResolvingPhonemes,
    lookupNote,
    onScoreResult,
  })
  const practiceLanguage = normalizeLanguage(AZURE_TO_LANGUAGE[lang] || 'english')
  const showRefreshMeaningAction = practiceSettings.showRefreshMeaningAction !== false
  const showIncorrectAction = practiceSettings.showIncorrectAction !== false
  const showTranslateAction = practiceSettings.showTranslateAction !== false

  useEffect(() => {
    if (Number.isFinite(recordingDurationSetting)) {
      setRecordingDuration(recordingDurationSetting)
    }
  }, [recordingDurationSetting])

  useEffect(() => {
    setIsUsageExpanded(Boolean(practiceSettings.autoExpandUsage))
    setTranslation({ word, text: '', loading: false, error: null })
    setMeaningRefresh({ loading: false, error: null, text: '' })
    setDictionaryIpas([])
    setIpaSaveStatus({ loading: false, error: null, savedIpa: '' })
    setSsIpaSaveStatus({ loading: false, error: null, savedIpa: '' })
    setUseGuessedIpaForScore(false)
  }, [practiceSettings.autoExpandUsage, word])

  useEffect(() => {
    let cancelled = false
    const key = String(word || '').trim().toLowerCase()
    const practiceLang = normalizeLanguage(AZURE_TO_LANGUAGE[lang] || 'english')
    if (!key || practiceLang !== 'english' || key.includes(' ')) return
    fetchJsonOrNull(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(key)}`)
      .then(entries => {
        if (cancelled) return
        setDictionaryIpas(parseDictionaryPhonetics(entries))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [word, lang])

  // Dịch definition mỗi loại từ sang tiếng Việt (cache localStorage).
  useEffect(() => {
    let cancelled = false
    setDictDefVi({})
    dictionaryIpas.forEach((group, gi) => {
      if (!group.definitionEn) return
      translateDefinitionVi(group.definitionEn)
        .then(text => { if (!cancelled) setDictDefVi(prev => ({ ...prev, [gi]: text })) })
        .catch(() => {})
    })
    return () => { cancelled = true }
  }, [dictionaryIpas])

  // No slow-motion score animation.

  useEffect(() => {
    let cancelled = false

    if (prebuiltPhonemes) {
      setPhonemes(prebuiltPhonemes)
      setIsResolvingPhonemes(false)
      return () => { cancelled = true }
    }

    const local = lookupWord(word, { allowGuess: !strictLookup })
    setPhonemes(local)

    if (!strictLookup || local.every(p => p.canScore !== false)) {
      setIsResolvingPhonemes(false)
      return () => { cancelled = true }
    }

    setIsResolvingPhonemes(true)
    fetchEnglishDictionaryPhonemes(word).then(found => {
      if (cancelled) return
      setPhonemes(found || unsupportedWord(word))
      setIsResolvingPhonemes(false)
    })

    return () => { cancelled = true }
  }, [prebuiltPhonemes, strictLookup, word])

  const sel = selectedIdx !== null && result ? result.phonemes[selectedIdx] : null
  const hasNav = onPrev !== null || onNext !== null
  const detailMeanings = detail?.meanings || []
  const usageMeanings = detailMeanings.filter(item => item.pos !== 'translate')
  const needsMachineTranslation = detailMeanings.length === 0 || detailMeanings.some(item => item.pos === 'translate')
  const wordRelations = buildWordRelations(word, detail)
  const wordStructures = buildWordStructures(word)
  const wordReportKey = `${practiceLanguage}:${word.toLowerCase()}`
  const isReportedIncorrect = Boolean(incorrectReports[wordReportKey])
  const toggleIncorrectReport = () => {
    setIncorrectReports(prev => {
      const next = { ...prev }
      if (next[wordReportKey]) {
        delete next[wordReportKey]
      } else {
        next[wordReportKey] = {
          word,
          lang: practiceLanguage,
          ipa: phonemes.map(formatIpa).join(''),
          meaning,
          reportedAt: new Date().toISOString(),
        }
      }
      saveIncorrectWordReports(next)
      return next
    })
  }
  const translateInApp = useCallback(async () => {
    setTranslation({ word, text: '', loading: true, error: null })
    try {
      const text = await fetchVietnameseTranslation(word, practiceLanguage)
      setTranslation({ word, text, loading: false, error: null })
    } catch (err) {
      setTranslation({ word, text: '', loading: false, error: err.message || 'Không dịch tự động được.' })
    }
  }, [practiceLanguage, word])

  const refreshMeaningFromWeb = useCallback(async () => {
    if (!onRefreshMeaning) return
    setMeaningRefresh({ loading: true, error: null, text: '' })
    try {
      const text = await onRefreshMeaning(word, practiceLanguage)
      setMeaningRefresh({ loading: false, error: null, text })
    } catch (err) {
      setMeaningRefresh({ loading: false, error: err.message || 'Không cập nhật nghĩa được.', text: '' })
    }
  }, [onRefreshMeaning, practiceLanguage, word])

  useEffect(() => {
    if (practiceSettings.readNewWordAloud) {
      const timer = setTimeout(() => speakNeural(word, lang), 250)
      return () => clearTimeout(timer)
    }
  }, [lang, practiceSettings.readNewWordAloud, word])

  const playModel = useCallback(() => {
    speakNeural(word, lang)
  }, [lang, word])

  const toggleLearnedControl = useCallback(() => {
    if (!learnedControl) return
    learnedControl.onToggle(result?.overall ?? null)
  }, [learnedControl, result])

  const azureIpa = result?.azureIpa || ''
  const canSaveAzureIpa = Boolean(azureIpa) && ipaSaveStatus.savedIpa !== azureIpa

  const saveAzureIpaToDb = async () => {
    if (!azureIpa) return
    setIpaSaveStatus({ loading: true, error: null, savedIpa: '' })
    try {
      await updateWordIpa(word, azureIpa, practiceLanguage)
      setIpaSaveStatus({ loading: false, error: null, savedIpa: azureIpa })
    } catch (err) {
      setIpaSaveStatus({ loading: false, error: err.message || 'Lỗi khi lưu IPA.', savedIpa: '' })
    }
  }

  const speechSuperIpa = result?.speechSuperIpa || ''
  const canSaveSpeechSuperIpa = Boolean(speechSuperIpa) && ssIpaSaveStatus.savedIpa !== speechSuperIpa

  const saveSpeechSuperIpaToDb = async () => {
    if (!speechSuperIpa) return
    setSsIpaSaveStatus({ loading: true, error: null, savedIpa: '' })
    try {
      await updateWordIpa(word, speechSuperIpa, practiceLanguage)
      setSsIpaSaveStatus({ loading: false, error: null, savedIpa: speechSuperIpa })
    } catch (err) {
      setSsIpaSaveStatus({ loading: false, error: err.message || 'Lỗi khi lưu IPA.', savedIpa: '' })
    }
  }

  const saveWordToDb = async () => {
    setSaveStatus({ loading: true, error: null, saved: false })
    try {
      let finalMeaning = meaning
      if (!finalMeaning || finalMeaning === 'Google Translate available' || finalMeaning === 'Search result (not in DB)') {
        finalMeaning = await fetchVietnameseTranslation(word, practiceLanguage)
      }
      const ipa = phonemes.map(formatIpa).join('')
      await upsertWord({
        word,
        vietnamese_definition: finalMeaning,
        ipa,
        language: practiceLanguage,
        source: 'user_search'
      })
      setSaveStatus({ loading: false, error: null, saved: true })
    } catch (err) {
      setSaveStatus({ loading: false, error: err.message || 'Lỗi khi lưu từ.', saved: false })
    }
  }

  useEffect(() => {
    if (showTranslateAction && (needsMachineTranslation || practiceSettings.autoTranslateOnLoad)) translateInApp()
  }, [needsMachineTranslation, practiceSettings.autoTranslateOnLoad, showTranslateAction, translateInApp])

  const navButtons = hasNav ? (
    <div className="flex flex-col gap-2.5 pt-1">
      <button onClick={onPrev} disabled={!onPrev} className={`w-full rounded-2xl ${compact ? 'py-2' : 'py-3'} flex items-center justify-center gap-1 text-sm font-bold whitespace-nowrap transition-all border ${onPrev ? 'bg-amber-500/20 border-amber-400/40 text-amber-200 active:scale-95' : 'bg-white/5 border-white/5 text-white/20 cursor-not-allowed'}`}>‹ Back</button>
      <button onClick={onNext} disabled={!onNext} className={`w-full rounded-2xl ${compact ? 'py-2' : 'py-3'} flex items-center justify-center gap-1 text-sm font-bold whitespace-nowrap transition-all border ${onNext ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-200 active:scale-95' : 'bg-white/5 border-white/5 text-white/20 cursor-not-allowed'}`}>Next ›</button>
    </div>
  ) : null

  return (
    <div className={`flex flex-col ${compact ? 'h-full pb-52' : 'min-h-screen pb-64'}`}>
      <audio ref={audioRef} className="hidden" />

      <SpeechSuperTrialBanner />

      {/* Tiêu đề từ + IPA breakdown */}
      <div className={`text-center px-4 ${compact ? 'py-1' : 'py-6'}`}>
        <WordHeader
          word={word}
          meaning={meaning}
          metaLine={metaLine}
          compact={compact}
          practiceLanguage={practiceLanguage}
          languageFlag={LANGUAGE_FLAG[practiceLanguage]}
          result={result}
          playModel={playModel}
          showRefreshMeaningAction={showRefreshMeaningAction}
          onRefreshMeaning={onRefreshMeaning}
          refreshMeaningFromWeb={refreshMeaningFromWeb}
          meaningRefresh={meaningRefresh}
          source={source}
          saveWordToDb={saveWordToDb}
          saveStatus={saveStatus}
        />
        <RootWordBadge rootWord={wordRelations.rootWord} currentWord={word} onSearchWord={onSearchWord} />
        <WordIpaPanel
          compact={compact}
          phonemes={phonemes}
          hasUnverifiedIpa={hasUnverifiedIpa}
          phase={phase}
          useGuessedIpaForScore={useGuessedIpaForScore}
          setUseGuessedIpaForScore={setUseGuessedIpaForScore}
          showIncorrectAction={showIncorrectAction}
          isReportedIncorrect={isReportedIncorrect}
          toggleIncorrectReport={toggleIncorrectReport}
          showTranslateAction={showTranslateAction}
          translateInApp={translateInApp}
          translation={translation}
          dictionaryIpas={dictionaryIpas}
          dictDefVi={dictDefVi}
          azureIpa={azureIpa}
          saveAzureIpaToDb={saveAzureIpaToDb}
          ipaSaveStatus={ipaSaveStatus}
          canSaveAzureIpa={canSaveAzureIpa}
          speechSuperIpa={speechSuperIpa}
          saveSpeechSuperIpaToDb={saveSpeechSuperIpaToDb}
          ssIpaSaveStatus={ssIpaSaveStatus}
          canSaveSpeechSuperIpa={canSaveSpeechSuperIpa}
        />
        <WordUsagePanel
          compact={compact}
          word={word}
          usageMeanings={usageMeanings}
          isUsageExpanded={isUsageExpanded}
          setIsUsageExpanded={setIsUsageExpanded}
          wordStructures={wordStructures}
          wordRelations={wordRelations}
        />
        <WordPhonemeGrid
          phonemes={phonemes}
          result={result}
          selectedIdx={selectedIdx}
          setSelectedIdx={setSelectedIdx}
          compact={compact}
          lang={lang}
          selectedPhoneme={sel}
          playPhoneme={playPhoneme}
        />
        <StressFeedbackPanel feedback={result?.combinedFeedback || []} assessment={result?.stressAssessment} prosodyScore={result?.prosodyScore ?? null} compact={compact} />
      </div>

      {/* Kết quả tổng */}
      {result && !compact && <p className="mx-4 mb-1 text-center text-white/40 text-xs">Tap each sound for details</p>}

        {/* Nút điều khiển */}
      <PracticeStatusMessages
        compact={compact}
        errorMsg={errorMsg}
        lookupNote={lookupNote}
        phase={phase}
        isResolvingPhonemes={isResolvingPhonemes}
      />

      <PracticeNavigationActions
        compact={compact}
        learnedControl={learnedControl}
        onToggleLearned={toggleLearnedControl}
        navButtons={navButtons}
        onDictionary={onDictionary}
        onSearchWord={onSearchWord}
        searchVal={searchVal}
        setSearchVal={setSearchVal}
      />
      <RecordingConsole
        compact={compact}
        phase={phase}
        playModel={playModel}
        recordingUrl={recordingUrl}
        playbackRecording={playbackRecording}
        isPlayingBack={isPlayingBack}
        reset={reset}
        resetAndRecord={resetAndRecord}
        source={source}
        onBack={onBack}
        startRecording={startRecording}
        canScoreWord={canScoreWord}
        isResolvingPhonemes={isResolvingPhonemes}
        recordingDuration={recordingDuration}
        countdown={countdown}
        stopRecording={stopRecording}
      />
    </div>
  )
}
