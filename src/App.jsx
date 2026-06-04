import React, { Suspense, lazy, useState } from 'react'
import { LogOut } from 'lucide-react'
import { SPANISH_PHONEME_INFO, ITALIAN_PHONEME_INFO, FRENCH_PHONEME_INFO } from './data.js'
import AuthGate from './AuthGate.jsx'
import BottomNav from './components/layout/BottomNav.jsx'
import { cleanPracticeWord } from './utils/words/wordNormalize.js'
import { AZURE_TO_LANGUAGE, LANGUAGE_TO_APP_LANG } from './utils/constants/languages.js'
import { usePracticeSettings } from './hooks/usePracticeSettings.js'
import { useProgress } from './hooks/useProgress.js'
import { useSentenceProgress } from './hooks/useSentenceProgress.js'
import { supabase } from './supabaseClient.js'
import { normalizeLanguage } from './supabaseData.js'
import { buildPhonemes } from './phonemes/phonemeEngine.js'
import PracticeWordScreen from './components/practice/PracticeWordScreen.jsx'
import DictionaryScreen from './components/dictionary/DictionaryScreen.jsx'

const AdminScreen = lazy(() => import('./AdminScreen.jsx'))
const SoundLibraryScreen = lazy(() => import('./components/sound/SoundScreens.jsx').then(module => ({ default: module.SoundLibraryScreen })))
const SoundDetailScreen = lazy(() => import('./components/sound/SoundScreens.jsx').then(module => ({ default: module.SoundDetailScreen })))
const SentenceLibraryScreen = lazy(() => import('./components/sentence/SentenceLibraryScreen.jsx'))
const PracticeSentenceScreen = lazy(() => import('./components/sentence/PracticeSentenceScreen.jsx'))
const APP_LANG_TO_AZURE = { en: 'en-US', es: 'es-ES', it: 'it-IT', fr: 'fr-FR' }


function MainApp({ profile }) {
  const [screen, setScreen] = useState('library')
  const [selectedSound, setSelectedSound] = useState(null)
  const [practiceWord, setPracticeWord] = useState(null)
  const [practiceSentence, setPracticeSentence] = useState(null)
  const [practiceWordIdx, setPracticeWordIdx] = useState(0)
  const [lang, setLang] = useState('en')   // 'en' | 'es' | 'it'
  const [settingsOpen, setSettingsOpen] = useState(false)
  const {
    practiceSettings,
    setPracticeSettings,
    recordingDurationSetting,
    changeRecordingDurationSetting,
    sentenceRecordingDurationSetting,
    changeSentenceRecordingDurationSetting,
  } = usePracticeSettings()
  const {
    learnedCommonWords,
    commonWordScores,
    toggleCommonLearned: handleToggleCommonLearned,
    saveWordPronunciationResult: handlePronunciationResult,
  } = useProgress()
  const {
    sentenceProgress,
    saveSentenceResult: handleSentencePronunciationResult,
  } = useSentenceProgress()

  const azureCode = APP_LANG_TO_AZURE[lang] || 'en-US'

  const handleSelectSound = (sound) => { setSelectedSound(sound); setScreen('soundDetail') }
  const handlePracticeWord = (w, idx = 0) => { setPracticeWord(w); setPracticeWordIdx(idx); setScreen('practiceWord') }
  const handlePracticeSentence = (item) => { setPracticeSentence(item); setScreen('practiceSentence') }
  const handleSearchPracticeWord = (raw) => {
    const next = String(raw || '').trim()
    if (!next) return
    setPracticeWord({ word: next.toLowerCase(), meaning: '' })
    setPracticeWordIdx(-1)
    setScreen('practiceWord')
  }
  const handlePracticeSentenceWord = (raw) => {
    const next = cleanPracticeWord(raw)
    if (!next) return
    const sentenceLanguage = normalizeLanguage(practiceSentence?.language || 'english')
    setLang(LANGUAGE_TO_APP_LANG[sentenceLanguage] || 'en')
    setPracticeWord({ word: next, meaning: 'Sentence word' })
    setPracticeWordIdx(-1)
    setScreen('practiceWord')
  }
  const handleNavigate = (s) => {
    setScreen(s)
    setSelectedSound(null)
    setPracticeWord(null)
    setPracticeSentence(null)
    setSettingsOpen(false)
  }
  const handleChangeLang = (l) => { setLang(l); setSelectedSound(null); setPracticeWord(null) }

  const soundWords = selectedSound?.words || []
  const onNextWord = practiceWordIdx >= 0 && practiceWordIdx < soundWords.length - 1
    ? () => { const i = practiceWordIdx + 1; setPracticeWord(soundWords[i]); setPracticeWordIdx(i) }
    : null
  const onPrevWord = practiceWordIdx > 0
    ? () => { const i = practiceWordIdx - 1; setPracticeWord(soundWords[i]); setPracticeWordIdx(i) }
    : null

  // Build prebuilt phonemes for Spanish/Italian words
  const phonemeInfoMap = lang === 'es' ? SPANISH_PHONEME_INFO : lang === 'it' ? ITALIAN_PHONEME_INFO : lang === 'fr' ? FRENCH_PHONEME_INFO : null
  const getWordPhonemes = (w) => {
    if (!phonemeInfoMap || !w?.phonemes) return null
    return buildPhonemes(w.phonemes, phonemeInfoMap)
  }

  return (
    <div className="max-w-md mx-auto bg-[#0f0f1a] min-h-screen relative">
      <button
        type="button"
        onClick={() => supabase?.auth.signOut()}
        className="fixed top-3 right-3 z-50 w-9 h-9 rounded-xl bg-gray-950/70 border border-white/10 text-white/55 flex items-center justify-center"
        aria-label="Logout"
      >
        <LogOut size={16} />
      </button>
      {screen === 'library' && (
        <Suspense fallback={<div className="px-4 py-6 text-sm text-white/70">Loading sound library...</div>}>
          <SoundLibraryScreen lang={lang} onSelectSound={handleSelectSound} onChangeLang={handleChangeLang} />
        </Suspense>
      )}
      {screen === 'admin' && (
        <Suspense fallback={<div className="px-4 py-6 text-sm text-white/70">Loading admin tools...</div>}>
          <AdminScreen profile={profile} onBack={() => handleNavigate('library')} />
        </Suspense>
      )}
      {screen === 'soundDetail' && selectedSound && (
        <Suspense fallback={<div className="px-4 py-6 text-sm text-white/70">Loading sound...</div>}>
          <SoundDetailScreen sound={selectedSound} lang={lang} onBack={() => setScreen('library')} onPracticeWord={handlePracticeWord} />
        </Suspense>
      )}
      {screen === 'practiceWord' && practiceWord && (
        <PracticeWordScreen
          word={practiceWord.word}
          meaning={practiceWord.meaning}
          lang={azureCode}
          prebuiltPhonemes={getWordPhonemes(practiceWord)}
          source={practiceSentence ? 'sentence-word' : null}
          onBack={() => practiceSentence ? setScreen('practiceSentence') : setScreen('soundDetail')}
          onHome={() => handleNavigate('library')}
          onLibrary={() => handleNavigate('library')}
          onDictionary={() => handleNavigate('dictionary')}
          onNext={onNextWord}
          onPrev={onPrevWord}
          onSearchWord={handleSearchPracticeWord}
          onScoreResult={(result, scoreMeta = {}) => handlePronunciationResult(practiceWord.word, result, {
            meaning: practiceWord.meaning,
            language: scoreMeta.language || AZURE_TO_LANGUAGE[azureCode] || 'english',
            source: practiceSentence ? 'sentence-word' : 'sound-library',
          })}
          practiceSettings={practiceSettings}
          recordingDurationSetting={recordingDurationSetting}
        />
      )}
      {screen === 'dictionary' && (
        <DictionaryScreen
          onBack={() => handleNavigate('library')}
          practiceSettings={practiceSettings}
          recordingDurationSetting={recordingDurationSetting}
          learnedCommonWords={learnedCommonWords}
          commonWordScores={commonWordScores}
          onToggleCommonLearned={handleToggleCommonLearned}
          onPronunciationResult={handlePronunciationResult}
        />
      )}
      {screen === 'sentences' && (
        <Suspense fallback={<div className="px-4 py-6 text-sm text-white/70">Loading sentences...</div>}>
          <SentenceLibraryScreen
            sentenceProgress={sentenceProgress}
            onPracticeSentence={handlePracticeSentence}
          />
        </Suspense>
      )}
      {screen === 'practiceSentence' && practiceSentence && (
        <Suspense fallback={<div className="px-4 py-6 text-sm text-white/70">Loading practice...</div>}>
          <PracticeSentenceScreen
            sentenceItem={practiceSentence}
            onBack={() => setScreen('sentences')}
            onSaveResult={(result) => handleSentencePronunciationResult(practiceSentence.id, result)}
            onPracticeWord={handlePracticeSentenceWord}
            recordingDurationSetting={sentenceRecordingDurationSetting}
          />
        </Suspense>
      )}
      <BottomNav
        screen={screen}
        onNavigate={handleNavigate}
        settingsOpen={settingsOpen}
        onSettingsOpenChange={setSettingsOpen}
        recordingDurationSetting={recordingDurationSetting}
        onRecordingDurationChange={changeRecordingDurationSetting}
        sentenceRecordingDurationSetting={sentenceRecordingDurationSetting}
        onSentenceRecordingDurationChange={changeSentenceRecordingDurationSetting}
        practiceSettings={practiceSettings}
        onPracticeSettingsChange={setPracticeSettings}
        canAdmin={profile?.role === 'admin'}
      />
    </div>
  )
}

export default function App() {
  return (
    <AuthGate>
      {({ profile }) => <MainApp profile={profile} />}
    </AuthGate>
  )
}
