import { useState, useEffect, useCallback, useDeferredValue, useMemo } from 'react'
import { DICTIONARY_CACHE_KEY, DICTIONARY_PAGE_SIZE, buildSupabaseWordDetail, buildTranslateFallbackDetail, dictionaryWordKey, saveDictionaryCache, searchDictionaryEntries, supabaseWordToEntry } from '../../utils/dictionaryHelpers.js'
import { getWordByText, listWords, normalizeLanguage, updateWordStudyFields } from '../../supabaseData.js'
import { fetchWordStudyFields, fetchVietnameseTranslation } from '../../utils/words/wordStudyFields.js'
import { useDictionaryData } from '../../hooks/useDictionaryData.js'
import DictionarySearchPanel from './DictionarySearchPanel.jsx'
import DictionaryFilters from './DictionaryFilters.jsx'
import DictionaryWordItem from './DictionaryWordItem.jsx'
import DictionaryActiveWord from './DictionaryActiveWord.jsx'

export default function DictionaryScreen({ onBack, practiceSettings, recordingDurationSetting, learnedCommonWords, commonWordScores, onToggleCommonLearned, onPronunciationResult }) {
  const {
    supabaseWords, setSupabaseWords,
    supabaseCategories,
    supabaseLevels,
    dictionaryCachedAt, setDictionaryCachedAt,
    supabaseLoading, setSupabaseLoading,
    supabaseError, setSupabaseError,
    refreshDictionary,
  } = useDictionaryData()

  const [query, setQuery] = useState('')
  const [commonQuery, setCommonQuery] = useState('')
  const deferredCommonQuery = useDeferredValue(commonQuery)
  const [commonLevel, setCommonLevel] = useState('all')
  const [commonCategory, setCommonCategory] = useState('all')
  const [commonLanguage, setCommonLanguage] = useState('all')
  const [searchLanguages, setSearchLanguages] = useState(['english'])
  const [commonLearnedFilter, setCommonLearnedFilter] = useState('all')
  const [visibleCommonLimit, setVisibleCommonLimit] = useState(DICTIONARY_PAGE_SIZE)
  const learnedWords = learnedCommonWords || loadLearnedCommonWords()
  const wordScores = commonWordScores || loadCommonWordScores()
  const [expandedCommonWords, setExpandedCommonWords] = useState(() => new Set())
  const [commonTranslations, setCommonTranslations] = useState({})
  const [meaningUpdates, setMeaningUpdates] = useState({})
  const [activeWord, setActiveWord] = useState(null)
  const [searchResult, setSearchResult] = useState(null)
  const showRefreshMeaningAction = practiceSettings.showRefreshMeaningAction !== false
  const showDictionarySearch = practiceSettings.showDictionarySubtitle !== false

  useEffect(() => {
    setVisibleCommonLimit(DICTIONARY_PAGE_SIZE)
  }, [commonCategory, deferredCommonQuery, commonLanguage, commonLearnedFilter, commonLevel, supabaseWords])

  const openWord = (word, meta = {}) => {
    const w = word.trim().toLowerCase()
    const initialLanguage = normalizeLanguage(
      meta.language || meta.entry?.language || meta.detail?.language || (commonLanguage !== 'all' ? commonLanguage : 'english')
    )
    const fallbackDetail = meta.detail || buildTranslateFallbackDetail(w, meta.meaning, initialLanguage)
    const firstMeaning = fallbackDetail?.meanings?.find(item => item.pos !== 'translate')
    if (!w) return
    setActiveWord({
      word: w,
      meaning: meta.meaning || firstMeaning?.meaningVi || 'Google Translate available',
      strictLookup: meta.strictLookup ?? true,
      source: meta.source || 'search',
      entry: meta.entry || null,
      detail: fallbackDetail,
      language: initialLanguage,
      commonList: meta.commonList || null,
      commonIndex: meta.commonIndex ?? null,
    })
    if (!meta.entry && !meta.detail) {
      getWordByText(w, commonLanguage !== 'all' ? commonLanguage : null)
        .then(row => {
          if (!row) return
          const entry = supabaseWordToEntry(row)
          const detail = buildSupabaseWordDetail(entry)
          const meaning = detail.meanings?.[0]?.meaningVi || entry.meaningVi || 'Google Translate available'
          setActiveWord(prev => {
            if (!prev || prev.word !== w) return prev
            return {
              ...prev,
              word: entry.word,
              meaning,
              strictLookup: true,
              source: 'common',
              entry,
              detail,
              language: normalizeLanguage(entry.language),
              commonList: [entry],
              commonIndex: 0,
            }
          })
        })
        .catch(err => setSupabaseError(err.message))
    }
  }

  const handleSearch = async (e) => {
    e.preventDefault()
    const term = query.trim()
    if (!term) return
    setSupabaseError(null)
    setSearchResult(null)

    const langsToSearch = searchLanguages.length > 0 ? searchLanguages : ['english']

    for (const lang of langsToSearch) {
      const localMatch = searchDictionaryEntries(supabaseWords, term, lang)[0]
      if (localMatch) {
        setSearchResult({
          word: localMatch.word,
          meaning: localMatch.meaningVi,
          language: lang,
          source: 'common',
          entry: localMatch
        })
        return
      }
    }

    try {
      setSupabaseLoading(true)
      for (const lang of langsToSearch) {
        const rows = await listWords({ query: term, language: lang, limit: 1 })
        const entry = rows[0] ? supabaseWordToEntry(rows[0]) : null
        if (entry) {
          setSearchResult({
            word: entry.word,
            meaning: entry.meaningVi,
            language: lang,
            source: 'common',
            entry: entry
          })
          return
        }
      }

      const firstLang = langsToSearch[0]
      setSearchResult({
        word: term,
        meaning: 'Chưa có trong từ điển',
        language: firstLang,
        source: 'external'
      })
    } catch (err) {
      setSupabaseError(err.message)
    } finally {
      setSupabaseLoading(false)
    }
  }

  const toggleCommonLearned = (word, score = null, language = 'english') => {
    const key = word.toLowerCase()
    const willLearn = !learnedWords.has(key)
    onToggleCommonLearned?.(word, willLearn, score, { language })
  }

  const toggleCommonDetail = (word, language = 'english') => {
    const key = dictionaryWordKey(word, language)
    setExpandedCommonWords(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const translateCommonInList = async (word, language = 'english') => {
    const key = dictionaryWordKey(word, language)
    setCommonTranslations(prev => ({ ...prev, [key]: { text: '', loading: true, error: null } }))
    try {
      const text = await fetchVietnameseTranslation(word, language)
      setCommonTranslations(prev => ({ ...prev, [key]: { text, loading: false, error: null } }))
    } catch (err) {
      setCommonTranslations(prev => ({ ...prev, [key]: { text: '', loading: false, error: err.message || 'Không dịch tự động được.' } }))
    }
  }

  const updateMeaningFromWeb = useCallback(async (word, type = 'other', language = 'english') => {
    const sourceLanguage = normalizeLanguage(language)
    const wordKey = word.toLowerCase()
    const key = dictionaryWordKey(word, sourceLanguage)
    setMeaningUpdates(prev => ({ ...prev, [key]: { loading: true, error: null, text: '', type } }))
    try {
      const fields = await fetchWordStudyFields(word, type, sourceLanguage)
      const row = await updateWordStudyFields(word, fields, sourceLanguage)
      const entry = supabaseWordToEntry(row)
      const matchesLanguage = item => item.word.toLowerCase() === wordKey && normalizeLanguage(item.language) === sourceLanguage
      const stamp = new Date().toISOString()
      setSupabaseWords(prev => {
        const next = prev.map(item => matchesLanguage(item) ? entry : item)
        saveDictionaryCache(DICTIONARY_CACHE_KEY, next)
        return next
      })
      setDictionaryCachedAt(stamp)
      setActiveWord(prev => {
        if (!prev || prev.word.toLowerCase() !== wordKey || normalizeLanguage(prev.language || prev.entry?.language) !== sourceLanguage) return prev
        const nextDetail = buildSupabaseWordDetail(entry)
        return {
          ...prev,
          meaning: fields.vietnamese_definition,
          entry,
          detail: nextDetail,
          language: normalizeLanguage(entry.language),
          commonList: prev.commonList?.map(item => matchesLanguage(item) ? entry : item) || prev.commonList,
        }
      })
      setCommonTranslations(prev => ({ ...prev, [key]: { text: fields.vietnamese_definition, loading: false, error: null } }))
      setMeaningUpdates(prev => ({ ...prev, [key]: { loading: false, error: null, text: fields.vietnamese_definition, type } }))
      return fields.vietnamese_definition
    } catch (err) {
      const message = err.message || 'Không cập nhật nghĩa được.'
      setMeaningUpdates(prev => ({ ...prev, [key]: { loading: false, error: message, text: '', type } }))
      throw new Error(message)
    }
  }, [setSupabaseWords, setDictionaryCachedAt])

  const levelScopedCommonWords = useMemo(() => {
    let list = supabaseWords
    if (commonLanguage !== 'all') {
      const language = normalizeLanguage(commonLanguage)
      list = list.filter(entry => normalizeLanguage(entry.language) === language)
    }
    if (commonLevel === 'none') list = list.filter(entry => !entry.level)
    else if (commonLevel !== 'all') list = list.filter(entry => entry.level === commonLevel)
    if (commonCategory !== 'all') list = list.filter(entry => entry.categoryId === commonCategory)
    const matchesQuery = searchDictionaryEntries(list, deferredCommonQuery, 'all')
    return deferredCommonQuery.trim() ? matchesQuery : list
  }, [commonCategory, commonLanguage, commonLevel, deferredCommonQuery, supabaseWords])

  const filteredCommonWords = useMemo(() => levelScopedCommonWords.filter(entry => {
    const isLearned = learnedWords.has(entry.word.toLowerCase())
    return commonLearnedFilter === 'all'
      || (commonLearnedFilter === 'learned' && isLearned)
      || (commonLearnedFilter === 'unlearned' && !isLearned)
  }), [commonLearnedFilter, learnedWords, levelScopedCommonWords])

  const visibleCommonWords = useMemo(
    () => filteredCommonWords.slice(0, visibleCommonLimit),
    [filteredCommonWords, visibleCommonLimit]
  )
  const scopedLearnedCount = useMemo(
    () => levelScopedCommonWords.filter(entry => learnedWords.has(entry.word.toLowerCase())).length,
    [learnedWords, levelScopedCommonWords]
  )
  const scopedUnlearnedCount = Math.max(0, levelScopedCommonWords.length - scopedLearnedCount)

  if (activeWord) {
    return (
      <DictionaryActiveWord
        activeWord={activeWord}
        onClose={() => setActiveWord(null)}
        onBack={onBack}
        onOpenWord={openWord}
        practiceSettings={practiceSettings}
        recordingDurationSetting={recordingDurationSetting}
        learnedWords={learnedWords}
        onToggleCommonLearned={toggleCommonLearned}
        onPronunciationResult={onPronunciationResult}
        onUpdateMeaning={updateMeaningFromWeb}
      />
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-[#0f0f1a] to-[#0f0f1a] pb-24">
      <div className="px-4 pt-10 pb-4">
        <h1 className="text-2xl font-bold text-white">Từ Điển Phát Âm</h1>
        {showDictionarySearch && <p className="text-white/40 text-sm">Nhập từ để chẩn đoán phát âm</p>}
      </div>
      {showDictionarySearch && (
        <DictionarySearchPanel
          query={query}
          setQuery={setQuery}
          searchLanguages={searchLanguages}
          setSearchLanguages={setSearchLanguages}
          onSubmit={handleSearch}
          searchResult={searchResult}
          onClearResult={() => setSearchResult(null)}
          onOpenWord={openWord}
        />
      )}

      <div className="px-4">
        <DictionaryFilters
          visibleCount={visibleCommonWords.length}
          filteredCount={filteredCommonWords.length}
          onRefresh={() => refreshDictionary()}
          supabaseLoading={supabaseLoading}
          commonQuery={commonQuery}
          setCommonQuery={setCommonQuery}
          deferredCommonQuery={deferredCommonQuery}
          commonLanguage={commonLanguage}
          setCommonLanguage={setCommonLanguage}
          supabaseLevels={supabaseLevels}
          commonLevel={commonLevel}
          setCommonLevel={setCommonLevel}
          supabaseCategories={supabaseCategories}
          commonCategory={commonCategory}
          setCommonCategory={setCommonCategory}
          supabaseError={supabaseError}
          supabaseWordsCount={supabaseWords.length}
          dictionaryCachedAt={dictionaryCachedAt}
          levelScopedCount={levelScopedCommonWords.length}
          scopedUnlearnedCount={scopedUnlearnedCount}
          scopedLearnedCount={scopedLearnedCount}
          commonLearnedFilter={commonLearnedFilter}
          setCommonLearnedFilter={setCommonLearnedFilter}
        />

        <div className="flex flex-col gap-2">
          {visibleCommonWords.map((entry, index) => (
            <DictionaryWordItem
              key={entry.id || `${entry.level}-${entry.word}`}
              entry={entry}
              index={index}
              learnedWords={learnedWords}
              wordScores={wordScores}
              expandedCommonWords={expandedCommonWords}
              commonTranslations={commonTranslations}
              meaningUpdates={meaningUpdates}
              showRefreshMeaningAction={showRefreshMeaningAction}
              filteredCommonWords={filteredCommonWords}
              onOpenWord={openWord}
              onUpdateMeaning={updateMeaningFromWeb}
              onToggleDetail={toggleCommonDetail}
              onTranslateInList={translateCommonInList}
            />
          ))}
          {visibleCommonWords.length < filteredCommonWords.length && (
            <button
              type="button"
              onClick={() => setVisibleCommonLimit(limit => limit + DICTIONARY_PAGE_SIZE)}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/70 active:scale-[0.99]"
            >
              Xem thêm {Math.min(DICTIONARY_PAGE_SIZE, filteredCommonWords.length - visibleCommonWords.length)} từ
            </button>
          )}
        </div>

        {filteredCommonWords.length === 0 && (
          <div className="text-white/40 text-sm py-10 text-center">Không tìm thấy từ phù hợp.</div>
        )}
      </div>
    </div>
  )
}
