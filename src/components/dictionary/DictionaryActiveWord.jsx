import { ChevronLeft } from 'lucide-react'
import { LANGUAGE_SHORT, LANGUAGE_TO_AZURE } from '../../utils/constants/languages.js'
import { buildSupabaseWordDetail, buildTranslateFallbackDetail } from '../../utils/dictionaryHelpers.js'
import { normalizeLanguage } from '../../supabaseData.js'
import { phonemesFromSupabaseIpa } from '../../phonemes/phonemeEngine.js'
import PronunciationPractice from '../practice/PronunciationPractice.jsx'

// The "open one word and practice it" view (the activeWord branch of the dictionary).
export default function DictionaryActiveWord({
  activeWord, onClose, onBack, onOpenWord, practiceSettings, recordingDurationSetting,
  learnedWords, onToggleCommonLearned, onPronunciationResult, onUpdateMeaning,
}) {
  const isCommonWord = activeWord.source === 'common'
  const isLearned = learnedWords.has(activeWord.word)
  const commonList = activeWord.commonList || []
  const commonIndex = activeWord.commonIndex ?? -1
  const commonEntry = activeWord.entry || commonList[commonIndex] || null
  const activeLanguage = normalizeLanguage(activeWord.language || commonEntry?.language || activeWord.detail?.language || 'english')
  const activeAzureCode = LANGUAGE_TO_AZURE[activeLanguage] || 'en-US'
  const activePhonemes = commonEntry?.ipa ? phonemesFromSupabaseIpa(commonEntry.ipa, activeLanguage, activeWord.word) : null
  const commonDetail = activeWord.detail || buildTranslateFallbackDetail(activeWord.word, activeWord.meaning, activeLanguage)
  const openCommonAt = (nextIndex) => {
    const nextEntry = commonList[nextIndex]
    if (!nextEntry) return
    const nextDetail = nextEntry.detail || buildSupabaseWordDetail(nextEntry)
    onOpenWord(nextEntry.word, {
      meaning: nextDetail.meanings?.[0]?.meaningVi || `${nextEntry.level} · ${nextEntry.pos}`,
      strictLookup: true,
      source: 'common',
      entry: nextEntry,
      detail: nextDetail,
      language: normalizeLanguage(nextEntry.language),
      commonList,
      commonIndex: nextIndex,
    })
  }
  const findCommonNavIndex = (direction) => {
    if (!isCommonWord || commonIndex < 0) return -1
    for (let i = commonIndex + direction; i >= 0 && i < commonList.length; i += direction) {
      if (!practiceSettings.unlearnedNavOnly || !learnedWords.has(commonList[i].word.toLowerCase())) return i
    }
    return -1
  }
  const prevCommonIndex = findCommonNavIndex(-1)
  const nextCommonIndex = findCommonNavIndex(1)
  const onPrevCommon = prevCommonIndex >= 0 ? () => openCommonAt(prevCommonIndex) : null
  const onNextCommon = nextCommonIndex >= 0 ? () => openCommonAt(nextCommonIndex) : null

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-[#0f0f1a] to-[#0f0f1a] pb-24">
      <div className="px-4 pt-6 pb-2 flex items-center gap-3">
        <button onClick={onClose} aria-label="Back" className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center text-white/70">
          <ChevronLeft size={20} />
        </button>
        <span className="text-white/50 text-sm">Dictionary</span>
      </div>
      <PronunciationPractice
        key={`${activeWord.word}:${activeAzureCode}`}
        word={activeWord.word}
        meaning={activeWord.meaning}
        metaLine={isCommonWord ? `${commonIndex + 1}/${commonList.length}${commonEntry ? ` · ${commonEntry.level} · ${commonEntry.pos} · ${LANGUAGE_SHORT[activeLanguage]}` : ''}` : null}
        lang={activeAzureCode}
        prebuiltPhonemes={activePhonemes}
        strictLookup={activeWord.strictLookup}
        compact={isCommonWord}
        detail={commonDetail}
        source={activeWord.source}
        learnedControl={isCommonWord ? {
          checked: isLearned,
          onToggle: (latestScore) => onToggleCommonLearned(activeWord.word, latestScore, activeLanguage),
        } : null}
        onBack={onClose}
        onHome={onBack}
        onLibrary={onBack}
        onDictionary={onClose}
        onPrev={onPrevCommon}
        onNext={onNextCommon}
        onSearchWord={onOpenWord}
        onScoreResult={(result) => onPronunciationResult?.(activeWord.word, result, {
          meaning: commonDetail?.meanings?.find(item => item.pos !== 'translate')?.meaningVi || activeWord.meaning,
          level: commonEntry?.level || null,
          pos: commonEntry?.pos || null,
          language: activeLanguage,
          source: activeWord.source || 'dictionary',
        })}
        onRefreshMeaning={isCommonWord ? (word, language) => onUpdateMeaning(word, commonEntry?.pos || activeWord.entry?.pos || 'other', language || activeLanguage) : null}
        practiceSettings={practiceSettings}
        recordingDurationSetting={recordingDurationSetting}
      />
    </div>
  )
}
