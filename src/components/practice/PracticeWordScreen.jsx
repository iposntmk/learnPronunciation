import { useState, useEffect } from 'react'
import { ChevronLeft } from 'lucide-react'
import { AZURE_TO_LANGUAGE, LANGUAGE_TO_AZURE } from '../../utils/constants/languages.js'
import { normalizeLanguage, getWordByText } from '../../supabaseData.js'
import { supabaseWordToEntry, buildSupabaseWordDetail, buildTranslateFallbackDetail } from '../../utils/dictionaryHelpers.js'
import { phonemesFromSupabaseIpa } from '../../phonemes/phonemeEngine.js'
import PronunciationPractice from './PronunciationPractice.jsx'


export default function PracticeWordScreen({ word, meaning, lang, prebuiltPhonemes, strictLookup = false, detail = null, source = null, onBack, onHome, onLibrary, onDictionary, onNext, onPrev, onSearchWord, onScoreResult, practiceSettings, recordingDurationSetting }) {
  const [supabaseDetail, setSupabaseDetail] = useState(null)
  const [supabaseMeaning, setSupabaseMeaning] = useState(null)
  const [supabasePhonemes, setSupabasePhonemes] = useState(null)
  const [supabaseLanguage, setSupabaseLanguage] = useState(null)

  useEffect(() => {
    let cancelled = false
    setSupabaseDetail(null)
    setSupabaseMeaning(null)
    setSupabasePhonemes(null)
    setSupabaseLanguage(null)
    const uiLanguage = AZURE_TO_LANGUAGE[lang] || null
    getWordByText(word, uiLanguage)
      .then(row => {
        if (cancelled || !row) return
        const entry = supabaseWordToEntry(row)
        const nextDetail = buildSupabaseWordDetail(entry)
        const nextMeaning = row.vietnamese_definition || null
        const nextLanguage = normalizeLanguage(row.language)
        const nextPhonemes = row.ipa ? phonemesFromSupabaseIpa(row.ipa, nextLanguage, row.word || word) : null
        if (nextMeaning || row.ipa) {
          setSupabaseDetail(nextDetail)
          setSupabaseMeaning(nextMeaning)
          setSupabasePhonemes(nextPhonemes)
          setSupabaseLanguage(nextLanguage)
        }
      })
      .catch(err => console.warn('[Supabase] word fetch failed:', err.message))
    return () => { cancelled = true }
  }, [word, lang])

  const effectiveLanguage = normalizeLanguage(supabaseLanguage || detail?.language || AZURE_TO_LANGUAGE[lang] || 'english')
  const effectiveMeaning = supabaseMeaning || meaning
  const practiceDetail = supabaseDetail || detail || buildTranslateFallbackDetail(word, effectiveMeaning, effectiveLanguage)
  const effectivePhonemes = supabasePhonemes || prebuiltPhonemes
  const effectiveLang = LANGUAGE_TO_AZURE[effectiveLanguage] || lang
  const effectiveSource = source || (supabaseDetail || supabaseMeaning ? 'common' : 'external')

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-[#0f0f1a] to-[#0f0f1a] pb-24">
      <div className="px-4 pt-6 pb-2 flex items-center gap-3">
        <button onClick={onBack} aria-label="Back" className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center text-white/70 hover:bg-white/10 transition-colors">
          <ChevronLeft size={20} />
        </button>
        <span className="text-white/50 text-sm">Pronunciation Practice</span>
      </div>
      <PronunciationPractice key={`${word}:${effectiveLang}`} word={word} meaning={effectiveMeaning} lang={effectiveLang} prebuiltPhonemes={effectivePhonemes} strictLookup={strictLookup} detail={practiceDetail} source={effectiveSource} onBack={onBack} onHome={onHome} onLibrary={onLibrary} onDictionary={onDictionary} onNext={onNext} onPrev={onPrev} onSearchWord={onSearchWord} onScoreResult={(result) => onScoreResult?.(result, { language: effectiveLanguage, azureLanguage: effectiveLang })} practiceSettings={practiceSettings} recordingDurationSetting={recordingDurationSetting} />
    </div>
  )
}
