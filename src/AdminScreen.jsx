import React, { useEffect, useMemo, useState, useCallback, useDeferredValue } from 'react'
import { read, utils, writeFile } from 'xlsx'
import { CheckSquare, ChevronLeft, Download, Plus, RefreshCw, Search, Square, Trash2, Flag } from 'lucide-react'
import {
  GENERIC_VIETNAMESE_DEFINITIONS,
  LEVELS,
  WORD_LANGUAGES,
  WORD_TYPES,
  deleteCategory,
  deleteLevel,
  deleteSentencesBulk,
  deleteWord,
  deleteWordsBulk,
  fetchAllSentences,
  fetchAllWords,
  importCategories,
  importResolvedWords,
  importSentences,
  importWords,
  previewCategoriesImport,
  previewSentencesImport,
  previewWordsImport,
  listCategories,
  listLevels,
  listProfiles,
  listSentenceTopics,
  listSentences,
  setWordFlagged,
  updateProfile,
  upsertCategory,
  upsertLevel,
  upsertWord,
} from './supabaseData.js'

const WORDS_CACHE_KEY = 'admin_words_cache_v2'
const STRESS_CHARS = ["ˈ", "ˌ", "'", "ʹ", "´"]
const WORDS_PAGE_SIZE = 150
const SENTENCES_PAGE_SIZE = 100

function loadCachedWords() {
  try {
    const raw = localStorage.getItem(WORDS_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.items) return null
    return parsed
  } catch {
    return null
  }
}

function saveCachedWords(items) {
  try {
    localStorage.setItem(WORDS_CACHE_KEY, JSON.stringify({ updatedAt: new Date().toISOString(), items }))
  } catch {}
}

function ipaMissingStress(ipa) {
  if (!ipa) return false
  const v = String(ipa)
  if (!v.trim()) return false
  return !STRESS_CHARS.some(ch => v.includes(ch))
}

const emptyWord = {
  word: '',
  type: 'other',
  ipa: '',
  vietnamese_definition: '',
  example_sentence: '',
  root_word: '',
  family_words: '',
  synonyms: '',
  antonyms: '',
  category_id: '',
  level: '',
  language: 'english',
}

const LANGUAGE_LABEL = {
  english: 'English',
  spanish: 'Spanish',
  italian: 'Italian',
  french: 'French',
}

const emptyCategory = { name: '', slug: '', description: '', level: '' }

const emptyLevel = { code: '', name: '', order_index: 0, originalCode: null }

function Field({ label, children }) {
  return (
    <label className="grid gap-1 text-xs text-white/50">
      <span>{label}</span>
      {children}
    </label>
  )
}

function inputClass() {
  return 'w-full rounded-xl bg-white/10 border border-white/10 px-3 py-2.5 text-white outline-none focus:border-emerald-300'
}

function importPhaseLabel(phase) {
  switch (phase) {
    case 'reading': return 'Đang đọc Excel...'
    case 'fetching': return 'Đang tra từ trong DB...'
    case 'inserting': return 'Đang thêm từ mới...'
    case 'updating': return 'Đang cập nhật từ...'
    case 'done': return 'Hoàn tất'
    default: return 'Đang xử lý...'
  }
}

const WordListItem = React.memo(function WordListItem({ item, onEdit, onToggleFlag, onDelete, selectMode, isSelected, onToggleSelect }) {
  if (selectMode) {
    return (
      <button
        type="button"
        onClick={() => onToggleSelect(item.id)}
        className={`w-full text-left rounded-xl border p-3 flex items-start gap-3 ${isSelected ? 'border-red-400/60 bg-red-500/10' : item.flagged_incorrect ? 'border-amber-400/40 bg-amber-400/5' : 'border-white/10 bg-gray-950/40'}`}
      >
        <span className={`mt-0.5 ${isSelected ? 'text-red-300' : 'text-white/40'}`}>
          {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-semibold break-words">{item.word} <span className="text-white/35 text-xs">{item.ipa ? `/${item.ipa}/` : 'Thiếu IPA'}</span></div>
          <div className="text-white/45 text-xs truncate">{item.vietnamese_definition}</div>
          <div className="text-white/30 text-[11px] break-words">{LANGUAGE_LABEL[item.language || 'english']} · {item.categories?.name || 'No category'} · {item.level || 'No level'}</div>
        </div>
      </button>
    )
  }
  return (
    <div className={`rounded-xl border p-3 ${item.flagged_incorrect ? 'border-amber-400/40 bg-amber-400/5' : 'border-white/10 bg-gray-950/40'}`}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2 items-start">
        <button onClick={() => onEdit(item)} className="min-w-0 flex-1 text-left">
          <div className="font-semibold break-words">{item.word} <span className="text-white/35 text-xs">{item.ipa ? `/${item.ipa}/` : 'Thiếu IPA'}</span></div>
          <div className="text-white/45 text-xs truncate">{item.vietnamese_definition}</div>
          <div className="text-white/30 text-[11px] break-words">{LANGUAGE_LABEL[item.language || 'english']} · {item.categories?.name || 'No category'} · {item.level || 'No level'}</div>
        </button>
        <button
          onClick={() => onToggleFlag(item)}
          title={item.flagged_incorrect ? 'Bỏ đánh dấu sai' : 'Đánh dấu sai'}
          className={`w-9 h-9 rounded-xl flex items-center justify-center ${item.flagged_incorrect ? 'bg-amber-400 text-gray-950' : 'bg-white/10 text-white/55'}`}
        >
          <Flag size={15} />
        </button>
        <button onClick={() => onDelete(item.id)} className="w-9 h-9 rounded-xl bg-red-500/10 text-red-200 flex items-center justify-center">
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  )
})

export default function AdminScreen({ profile, onBack }) {
  const [tab, setTab] = useState('words')
  const [categories, setCategories] = useState([])
  const [allWords, setAllWords] = useState([])
  const [sentences, setSentences] = useState([])
  const [sentencesTotal, setSentencesTotal] = useState(0)
  const [sentencesHasMore, setSentencesHasMore] = useState(false)
  const [sentencesRefreshing, setSentencesRefreshing] = useState(false)
  const [sentencesLoadingMore, setSentencesLoadingMore] = useState(false)
  const [wordsLoaded, setWordsLoaded] = useState(false)
  const [wordsCacheChecked, setWordsCacheChecked] = useState(false)
  const [wordsCachedAt, setWordsCachedAt] = useState(null)
  const [wordsRefreshing, setWordsRefreshing] = useState(false)
  const [profiles, setProfiles] = useState([])
  const [profilesLoaded, setProfilesLoaded] = useState(false)
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const [sentenceQuery, setSentenceQuery] = useState('')
  const [sentenceLevelFilter, setSentenceLevelFilter] = useState('all')
  const [sentenceTopicFilter, setSentenceTopicFilter] = useState('all')
  const [sentenceLanguageFilter, setSentenceLanguageFilter] = useState('all')
  const [sentenceTopics, setSentenceTopics] = useState([])
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [languageFilter, setLanguageFilter] = useState('all')
  const [wordStatusFilter, setWordStatusFilter] = useState('all')
  const [wordLevelFilter, setWordLevelFilter] = useState('all')
  const [visibleWordLimit, setVisibleWordLimit] = useState(WORDS_PAGE_SIZE)
  const [wordForm, setWordForm] = useState(emptyWord)
  const [wordFormOpen, setWordFormOpen] = useState(false)
  const [categoryForm, setCategoryForm] = useState(emptyCategory)
  const [categoryFormOpen, setCategoryFormOpen] = useState(false)
  const [levelsList, setLevelsList] = useState([])
  const [levelForm, setLevelForm] = useState(emptyLevel)
  const [levelFormOpen, setLevelFormOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [importProgress, setImportProgress] = useState(null)
  const [wordImportPreview, setWordImportPreview] = useState(null)
  const [sentenceImportPreview, setSentenceImportPreview] = useState(null)
  const [categoryImportPreview, setCategoryImportPreview] = useState(null)
  const [wordsDeleteMode, setWordsDeleteMode] = useState(false)
  const [selectedWordIds, setSelectedWordIds] = useState(() => new Set())
  const [sentencesDeleteMode, setSentencesDeleteMode] = useState(false)
  const [selectedSentenceIds, setSelectedSentenceIds] = useState(() => new Set())
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 4500)
    return () => clearTimeout(id)
  }, [toast])

  const isAdmin = profile?.role === 'admin'

  useEffect(() => {
    let cancelled = false
    const id = setTimeout(() => {
      const cached = loadCachedWords()
      if (cancelled) return
      if (cached?.items) {
        setAllWords(cached.items)
        setWordsCachedAt(cached.updatedAt || null)
        setWordsLoaded(true)
      }
      setWordsCacheChecked(true)
    }, 0)
    return () => {
      cancelled = true
      clearTimeout(id)
    }
  }, [])

  const refreshCategories = useCallback(async () => setCategories(await listCategories()), [])
  const refreshLevels = useCallback(async () => {
    const rows = await listLevels()
    setLevelsList(rows)
  }, [])
  const saveLevel = useCallback(async (event) => {
    event?.preventDefault?.()
    setLoading(true)
    try {
      await upsertLevel({
        code: levelForm.code,
        name: levelForm.name,
        order_index: levelForm.order_index,
        originalCode: levelForm.originalCode,
      })
      await refreshLevels()
      setLevelForm(emptyLevel)
      setMessage('Đã lưu level.')
    } catch (err) {
      setToast({ type: 'error', message: `Lưu level lỗi: ${err.message}` })
    } finally {
      setLoading(false)
    }
  }, [levelForm, refreshLevels])
  const removeLevel = useCallback(async (code) => {
    setLoading(true)
    try {
      await deleteLevel(code)
      await refreshLevels()
      if (levelForm.originalCode === code) setLevelForm(emptyLevel)
      setMessage(`Đã xoá level "${code}". Các từ/chủ đề/câu đang dùng level này đã được set null.`)
    } catch (err) {
      setToast({ type: 'error', message: `Xoá level lỗi: ${err.message}` })
    } finally {
      setLoading(false)
    }
  }, [levelForm.originalCode, refreshLevels])
  const refreshWords = useCallback(async () => {
    setWordsRefreshing(true)
    try {
      const data = await fetchAllWords()
      setAllWords(data)
      setWordsLoaded(true)
      const stamp = new Date().toISOString()
      setWordsCachedAt(stamp)
      saveCachedWords(data)
    } catch (err) {
      setWordsLoaded(true)
      setToast({ type: 'error', message: `Tải danh sách lỗi: ${err.message}` })
    } finally {
      setWordsRefreshing(false)
    }
  }, [])
  const refreshSentences = useCallback(async () => {
    setSentencesRefreshing(true)
    try {
      const [result, topics] = await Promise.all([
        listSentences({
          query: sentenceQuery,
          language: sentenceLanguageFilter,
          level: sentenceLevelFilter,
          topic: sentenceTopicFilter,
          limit: SENTENCES_PAGE_SIZE,
          offset: 0,
        }),
        listSentenceTopics({
          language: sentenceLanguageFilter,
          level: sentenceLevelFilter,
        }),
      ])
      setSentences(result.items)
      setSentencesTotal(result.total)
      setSentencesHasMore(result.hasMore)
      setSentenceTopics(topics)
    } catch (err) {
      setToast({ type: 'error', message: `Sentence load failed: ${err.message}` })
    } finally {
      setSentencesRefreshing(false)
    }
  }, [sentenceLanguageFilter, sentenceLevelFilter, sentenceQuery, sentenceTopicFilter])
  const loadMoreSentences = useCallback(async () => {
    if (sentencesLoadingMore || sentencesRefreshing || !sentencesHasMore) return
    setSentencesLoadingMore(true)
    try {
      const result = await listSentences({
        query: sentenceQuery,
        language: sentenceLanguageFilter,
        level: sentenceLevelFilter,
        topic: sentenceTopicFilter,
        limit: SENTENCES_PAGE_SIZE,
        offset: sentences.length,
      })
      setSentences(prev => [...prev, ...result.items])
      setSentencesTotal(result.total)
      setSentencesHasMore(result.hasMore)
    } catch (err) {
      setToast({ type: 'error', message: `Sentence load failed: ${err.message}` })
    } finally {
      setSentencesLoadingMore(false)
    }
  }, [sentenceLanguageFilter, sentenceLevelFilter, sentenceQuery, sentenceTopicFilter, sentences.length, sentencesHasMore, sentencesLoadingMore, sentencesRefreshing])
  const refreshProfiles = useCallback(async () => {
    setProfiles(await listProfiles())
    setProfilesLoaded(true)
  }, [])

  useEffect(() => {
    refreshCategories().catch(err => setMessage(err.message))
  }, [refreshCategories])

  useEffect(() => {
    refreshLevels().catch(err => setMessage(err.message))
  }, [refreshLevels])

  useEffect(() => {
    if (tab === 'words' && wordsCacheChecked && !wordsLoaded && !wordsRefreshing) refreshWords()
    if (tab === 'users' && !profilesLoaded) refreshProfiles().catch(err => {
      setProfilesLoaded(true)
      setMessage(err.message)
    })
  }, [profilesLoaded, refreshProfiles, refreshWords, tab, wordsCacheChecked, wordsLoaded, wordsRefreshing])

  useEffect(() => {
    setVisibleWordLimit(WORDS_PAGE_SIZE)
  }, [allWords, categoryFilter, deferredQuery, languageFilter, wordLevelFilter, wordStatusFilter])

  useEffect(() => {
    if (tab !== 'sentences') return
    refreshSentences()
  }, [tab, refreshSentences])

  useEffect(() => {
    if (tab !== 'words') return
    if (wordStatusFilter !== 'missing-root') return
    refreshWords()
  }, [tab, wordStatusFilter, refreshWords])

  const categoryOptions = useMemo(() => categories.map(c => ({ value: c.id, label: `${c.level ? `${c.level} · ` : ''}${c.name}` })), [categories])

  const levelOptions = useMemo(() => {
    if (levelsList.length > 0) return levelsList.map(l => l.code)
    return LEVELS
  }, [levelsList])

  const displayedWords = useMemo(() => {
    let list = allWords
    if (categoryFilter !== 'all') list = list.filter(w => (w.category_id || '') === categoryFilter)
    if (languageFilter !== 'all') list = list.filter(w => (w.language || 'english') === languageFilter)
    if (wordLevelFilter !== 'all') {
      if (wordLevelFilter === 'none') list = list.filter(w => !w.level)
      else list = list.filter(w => w.level === wordLevelFilter)
    }
    switch (wordStatusFilter) {
      case 'missing-ipa':
        list = list.filter(w => !w.ipa || !String(w.ipa).trim())
        break
      case 'missing-stress':
        list = list.filter(w => ipaMissingStress(w.ipa))
        break
      case 'generic-definition':
        list = list.filter(w => GENERIC_VIETNAMESE_DEFINITIONS.includes(w.vietnamese_definition))
        break
      case 'flagged':
        list = list.filter(w => w.flagged_incorrect)
        break
      case 'missing-root':
        list = list.filter(w => !w.root_word || !String(w.root_word).trim())
        break
      default:
        break
    }
    const q = deferredQuery.trim().toLowerCase()
    if (q) {
      list = list.filter(w =>
        (w.word || '').toLowerCase().includes(q) ||
        (w.vietnamese_definition || '').toLowerCase().includes(q) ||
        (w.root_word || '').toLowerCase().includes(q)
      )
    }
    return list
  }, [allWords, categoryFilter, languageFilter, wordLevelFilter, wordStatusFilter, deferredQuery])

  const visibleWords = useMemo(
    () => displayedWords.slice(0, visibleWordLimit),
    [displayedWords, visibleWordLimit]
  )

  const sentenceTopicOptions = useMemo(() => sentenceTopics, [sentenceTopics])

  const editWord = useCallback((item) => {
    setWordForm({
      ...item,
      family_words: (item.family_words || []).join(', '),
      synonyms: (item.synonyms || []).join(', '),
      antonyms: (item.antonyms || []).join(', '),
      category_id: item.category_id || '',
      level: item.level || '',
      language: item.language || 'english',
    })
    setWordFormOpen(true)
  }, [])

  const deleteWordAndRefresh = useCallback(async (id) => {
    await deleteWord(id)
    await refreshWords()
  }, [refreshWords])

  const enterWordsDeleteMode = useCallback(() => {
    setWordsDeleteMode(true)
    setSelectedWordIds(new Set())
  }, [])

  const exitWordsDeleteMode = useCallback(() => {
    setWordsDeleteMode(false)
    setSelectedWordIds(new Set())
  }, [])

  const toggleSelectWord = useCallback((id) => {
    setSelectedWordIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectAllWordsInDb = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchAllWords()
      setAllWords(data)
      setWordsLoaded(true)
      const stamp = new Date().toISOString()
      setWordsCachedAt(stamp)
      saveCachedWords(data)
      setSelectedWordIds(new Set(data.map(w => w.id)))
      setMessage(`Đã chọn ${data.length} từ trong DB.`)
    } catch (err) {
      setToast({ type: 'error', message: `Lấy toàn bộ từ DB lỗi: ${err.message}` })
    } finally {
      setLoading(false)
    }
  }, [])

  const requestDeleteSelectedWords = useCallback(() => {
    if (selectedWordIds.size === 0) return
    setDeleteConfirm({ type: 'words', count: selectedWordIds.size })
  }, [selectedWordIds.size])

  const executeDeleteWords = useCallback(async () => {
    setLoading(true)
    try {
      const ids = [...selectedWordIds]
      await deleteWordsBulk(ids)
      setDeleteConfirm(null)
      exitWordsDeleteMode()
      await refreshWords()
      setMessage(`Đã xoá ${ids.length} từ.`)
    } catch (err) {
      setToast({ type: 'error', message: `Xoá từ lỗi: ${err.message}` })
    } finally {
      setLoading(false)
    }
  }, [selectedWordIds, exitWordsDeleteMode, refreshWords])

  const enterSentencesDeleteMode = useCallback(() => {
    setSentencesDeleteMode(true)
    setSelectedSentenceIds(new Set())
  }, [])

  const exitSentencesDeleteMode = useCallback(() => {
    setSentencesDeleteMode(false)
    setSelectedSentenceIds(new Set())
  }, [])

  const toggleSelectSentence = useCallback((id) => {
    setSelectedSentenceIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectAllSentencesInDb = useCallback(async () => {
    setLoading(true)
    try {
      const all = await fetchAllSentences({
        query: sentenceQuery,
        language: sentenceLanguageFilter,
        level: sentenceLevelFilter,
        topic: sentenceTopicFilter,
      })
      setSelectedSentenceIds(new Set(all.map(s => s.id)))
      setMessage(`Đã chọn ${all.length} câu trong DB (theo bộ lọc).`)
    } catch (err) {
      setToast({ type: 'error', message: `Lấy toàn bộ câu DB lỗi: ${err.message}` })
    } finally {
      setLoading(false)
    }
  }, [sentenceQuery, sentenceLanguageFilter, sentenceLevelFilter, sentenceTopicFilter])

  const requestDeleteSelectedSentences = useCallback(() => {
    if (selectedSentenceIds.size === 0) return
    setDeleteConfirm({ type: 'sentences', count: selectedSentenceIds.size })
  }, [selectedSentenceIds.size])

  const executeDeleteSentences = useCallback(async () => {
    setLoading(true)
    try {
      const ids = [...selectedSentenceIds]
      await deleteSentencesBulk(ids)
      setDeleteConfirm(null)
      exitSentencesDeleteMode()
      await refreshSentences()
      setMessage(`Đã xoá ${ids.length} câu.`)
    } catch (err) {
      setToast({ type: 'error', message: `Xoá câu lỗi: ${err.message}` })
    } finally {
      setLoading(false)
    }
  }, [selectedSentenceIds, exitSentencesDeleteMode, refreshSentences])

  const toggleFlag = useCallback(async (item) => {
    const next = !item.flagged_incorrect
    setAllWords(prev => {
      const updated = prev.map(w => w.id === item.id ? { ...w, flagged_incorrect: next } : w)
      saveCachedWords(updated)
      return updated
    })
    try {
      const updated = await setWordFlagged(item.id, next)
      setAllWords(prev => {
        const merged = prev.map(w => w.id === item.id ? updated : w)
        saveCachedWords(merged)
        return merged
      })
    } catch (err) {
      setAllWords(prev => {
        const reverted = prev.map(w => w.id === item.id ? { ...w, flagged_incorrect: !next } : w)
        saveCachedWords(reverted)
        return reverted
      })
      setToast({ type: 'error', message: `Đánh dấu lỗi: ${err.message}` })
    }
  }, [])

  const saveWord = async (event) => {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    try {
      await upsertWord(wordForm)
      setWordForm(emptyWord)
      setWordFormOpen(false)
      await refreshWords()
      setMessage('Đã lưu từ.')
    } catch (err) {
      setMessage(err.message)
    } finally {
      setLoading(false)
    }
  }

  const saveCategory = async (event) => {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    try {
      await upsertCategory(categoryForm)
      setCategoryForm(emptyCategory)
      setCategoryFormOpen(false)
      await refreshCategories()
      setMessage('Đã lưu chủ đề.')
    } catch (err) {
      setMessage(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setLoading(true)
    setMessage('')
    try {
      const buf = await file.arrayBuffer()
      const workbook = read(buf)
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows = utils.sheet_to_json(sheet, { defval: '' })
      const preview = await previewWordsImport(rows, categories, levelsList)
      if (preview.totalParsed === 0) {
        setToast({ type: 'error', message: 'Không có dòng hợp lệ để import.' })
        return
      }
      setWordImportPreview({ ...preview, fileName: file.name })
    } catch (err) {
      setToast({ type: 'error', message: `Đọc file lỗi: ${err.message}` })
    } finally {
      setLoading(false)
      event.target.value = ''
    }
  }

  const confirmWordImport = async () => {
    if (!wordImportPreview) return
    setLoading(true)
    setImportProgress({ phase: 'reading', current: 0, total: 0 })
    try {
      const { inserted, updated } = await importResolvedWords(wordImportPreview.rows, {
        onProgress: (e) => setImportProgress(e),
      })
      await refreshWords()
      setWordImportPreview(null)
      setToast({ type: 'success', message: `Import xong: thêm mới ${inserted.length}, cập nhật ${updated.length}.` })
    } catch (err) {
      setToast({ type: 'error', message: `Import lỗi: ${err.message}` })
    } finally {
      setLoading(false)
      setImportProgress(null)
    }
  }

  const updateWordPreviewRow = (rowIndex, patch) => {
    setWordImportPreview(prev => {
      if (!prev) return prev
      const rows = prev.rows.map((row, i) => (i === rowIndex ? { ...row, ...patch } : row))
      return { ...prev, rows }
    })
  }

  const exportWords = () => {
    const rows = displayedWords.map(item => ({
      word: item.word || '',
      language: item.language || 'english',
      type: item.type || '',
      ipa: item.ipa || '',
      vietnamese_definition: item.vietnamese_definition || '',
      example_sentence: item.example_sentence || '',
      root_word: item.root_word || '',
      family_words: (item.family_words || []).join(', '),
      synonyms: (item.synonyms || []).join(', '),
      antonyms: (item.antonyms || []).join(', '),
      category: item.categories?.name || '',
      level: item.level || '',
      source: item.source || '',
    }))
    const worksheet = utils.json_to_sheet(rows)
    const workbook = utils.book_new()
    utils.book_append_sheet(workbook, worksheet, 'words')
    const suffix = wordStatusFilter === 'missing-ipa'
      ? 'missing-ipa'
      : wordStatusFilter === 'generic-definition'
        ? 'generic-vietnamese-definition'
        : wordStatusFilter === 'missing-root'
          ? 'missing-root-word'
          : 'words'
    writeFile(workbook, `pronunciation-${suffix}.xlsx`)
  }

  const downloadImportTemplate = () => {
    const rows = [
      {
        word: 'example',
        language: 'english',
        type: 'noun',
        ipa: 'ɪɡˈzæmpəl',
        vietnamese_definition: 'ví dụ',
        example_sentence: 'This is an example sentence.',
        root_word: '',
        family_words: 'examples, exemplary',
        synonyms: 'sample, instance',
        antonyms: '',
        category: 'A1 Core',
        level: 'A1',
      },
      {
        word: 'casa',
        language: 'spanish',
        type: 'noun',
        ipa: 'ˈka.sa',
        vietnamese_definition: 'ngôi nhà',
        example_sentence: 'Mi casa es tu casa.',
        root_word: '',
        family_words: '',
        synonyms: 'hogar',
        antonyms: '',
        category: '',
        level: 'A1',
      },
    ]
    const worksheet = utils.json_to_sheet(rows)
    const workbook = utils.book_new()
    utils.book_append_sheet(workbook, worksheet, 'import-template')
    writeFile(workbook, 'pronunciation-import-template.xlsx')
  }

  const handleImportSentences = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setLoading(true)
    setMessage('')
    try {
      const buf = await file.arrayBuffer()
      const workbook = read(buf)
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows = utils.sheet_to_json(sheet, { defval: '' })
      const preview = await previewSentencesImport(rows)
      if (preview.totalParsed === 0) {
        setToast({ type: 'error', message: 'Không có dòng câu hợp lệ để import.' })
        return
      }
      setSentenceImportPreview({ ...preview, rawRows: rows, fileName: file.name })
    } catch (err) {
      setToast({ type: 'error', message: `Đọc file lỗi: ${err.message}` })
    } finally {
      setLoading(false)
      event.target.value = ''
    }
  }

  const confirmSentenceImport = async () => {
    if (!sentenceImportPreview) return
    setLoading(true)
    setImportProgress({ phase: 'reading', current: 0, total: 0 })
    try {
      const imported = await importSentences(sentenceImportPreview.rawRows, {
        onProgress: (e) => setImportProgress(e),
      })
      await refreshSentences()
      setSentenceImportPreview(null)
      setToast({ type: 'success', message: `Imported ${imported.length} sentences.` })
    } catch (err) {
      setToast({ type: 'error', message: `Sentence import failed: ${err.message}` })
    } finally {
      setLoading(false)
      setImportProgress(null)
    }
  }

  const exportSentences = () => {
    const rows = sentences.map(item => ({
      sentence: item.sentence || '',
      language: item.language || 'english',
      vietnamese_translation: item.vietnamese_translation || '',
      topic: item.topic || '',
      level: item.level || '',
      source: item.source || '',
    }))
    const worksheet = utils.json_to_sheet(rows)
    const workbook = utils.book_new()
    utils.book_append_sheet(workbook, worksheet, 'sentences')
    writeFile(workbook, 'pronunciation-sentences.xlsx')
  }

  const downloadSentenceTemplate = () => {
    const rows = [
      {
        sentence: 'Could you speak a little more slowly?',
        language: 'english',
        vietnamese_translation: 'Ban co the noi cham hon mot chut khong?',
        topic: 'Conversation',
        level: 'A2',
        source: 'admin-import',
      },
      {
        sentence: 'Quiero practicar español todos los días.',
        language: 'spanish',
        vietnamese_translation: 'Toi muon luyen tap tieng Tay Ban Nha moi ngay.',
        topic: 'Study',
        level: 'A1',
        source: 'admin-import',
      },
    ]
    const worksheet = utils.json_to_sheet(rows)
    const workbook = utils.book_new()
    utils.book_append_sheet(workbook, worksheet, 'sentence-template')
    writeFile(workbook, 'sentence-import-template.xlsx')
  }

  const handleImportCategories = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setLoading(true)
    setMessage('')
    try {
      const buf = await file.arrayBuffer()
      const workbook = read(buf)
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows = utils.sheet_to_json(sheet, { defval: '' })
      const preview = await previewCategoriesImport(rows)
      if (preview.totalParsed === 0) {
        setToast({ type: 'error', message: 'Không có chủ đề hợp lệ để import.' })
        return
      }
      setCategoryImportPreview({ ...preview, rawRows: rows, fileName: file.name })
    } catch (err) {
      setToast({ type: 'error', message: `Đọc file lỗi: ${err.message}` })
    } finally {
      setLoading(false)
      event.target.value = ''
    }
  }

  const confirmCategoryImport = async () => {
    if (!categoryImportPreview) return
    setLoading(true)
    try {
      const imported = await importCategories(categoryImportPreview.rawRows)
      await refreshCategories()
      setCategoryImportPreview(null)
      setToast({ type: 'success', message: `Đã import ${imported.length} chủ đề.` })
    } catch (err) {
      setToast({ type: 'error', message: `Import chủ đề lỗi: ${err.message}` })
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadCategoryTemplate = () => {
    const wb = utils.book_new()
    const ws = utils.aoa_to_sheet([
      ['name', 'slug', 'level', 'description'],
      ['Business English', 'business-english', 'B1', 'Từ vựng kinh doanh'],
      ['Travel & Tourism', 'travel-tourism', 'A2', 'Từ vựng du lịch'],
      ['Technology', 'technology', 'B2', 'Từ vựng công nghệ'],
    ])
    utils.book_append_sheet(wb, ws, 'Categories')
    writeFile(wb, 'category-template.xlsx')
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-950 text-white p-4">
        <button onClick={onBack} className="mb-4 w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center"><ChevronLeft size={20} /></button>
        <h1 className="text-xl font-bold">Admin</h1>
        <p className="text-white/50 text-sm mt-2">Tài khoản hiện tại chưa có role admin. Chạy SQL: update public.profiles set role = 'admin' where email = 'email-của-bạn';</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-[#0f0f1a] to-[#0f0f1a] pb-24 text-white">
      <div className="px-4 pt-6 pb-4 flex items-center gap-3">
        <button onClick={onBack} className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center"><ChevronLeft size={20} /></button>
        <div>
          <h1 className="text-xl font-bold">Admin</h1>
          <p className="text-white/40 text-xs">Words, sentences, categories, users</p>
        </div>
      </div>

      <div className="px-4 flex gap-2 mb-4">
        {['words', 'sentences', 'categories', 'levels', 'users'].map(item => (
          <button key={item} onClick={() => setTab(item)} className={`flex-1 rounded-xl py-2 text-sm font-semibold ${tab === item ? 'bg-white text-gray-950' : 'bg-white/10 text-white/60'}`}>
            {item}
          </button>
        ))}
      </div>

      {message && <div className="mx-4 mb-4 rounded-xl border border-yellow-400/25 bg-yellow-400/10 px-3 py-2 text-yellow-100 text-sm">{message}</div>}

      {importProgress && (
        <div className="mx-4 mb-4 rounded-xl border border-emerald-300/25 bg-emerald-300/10 px-3 py-3 text-emerald-100 text-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold">{importPhaseLabel(importProgress.phase)}</span>
            <span className="text-xs tabular-nums text-emerald-200/80">
              {importProgress.total > 0 ? `${importProgress.current}/${importProgress.total}` : '...'}
            </span>
          </div>
          <div className="h-2 rounded-full bg-emerald-300/15 overflow-hidden">
            <div
              className="h-full bg-emerald-300 transition-all duration-200"
              style={{ width: `${importProgress.total > 0 ? Math.round((importProgress.current / importProgress.total) * 100) : 5}%` }}
            />
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4 pointer-events-none">
          <div
            role="status"
            onClick={() => setToast(null)}
            className={`pointer-events-auto cursor-pointer max-w-sm rounded-xl px-4 py-3 text-sm font-medium shadow-lg backdrop-blur ${
              toast.type === 'error'
                ? 'bg-red-500/90 text-white border border-red-300/40'
                : 'bg-emerald-400/95 text-gray-950 border border-emerald-200/60'
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}

      {wordImportPreview && (
        <div className="fixed inset-0 z-40 bg-gray-950/80 backdrop-blur-sm px-4 py-6 overflow-y-auto">
          <div className="mx-auto max-w-6xl rounded-2xl border border-white/10 bg-gray-950 shadow-2xl">
            <div className="flex flex-col gap-2 border-b border-white/10 p-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-bold">Xem trước import từ</h2>
                <p className="text-xs text-white/45">
                  {wordImportPreview.fileName} · {wordImportPreview.totalParsed} dòng · sau dedup {wordImportPreview.deduped}
                </p>
                <p className="text-xs text-emerald-300/90 mt-1">
                  Mới: {wordImportPreview.newCount} · Cập nhật: {wordImportPreview.updateCount} · Bỏ qua: {wordImportPreview.skipCount}
                </p>
                <p className="text-[11px] text-white/40 mt-1">
                  Category & Level đã được tự gán theo DB (gần đúng / đúng nhất). Bấm vào dropdown để sửa từng dòng.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setWordImportPreview(null)}
                  disabled={loading}
                  className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Huỷ
                </button>
                <button
                  type="button"
                  onClick={confirmWordImport}
                  disabled={loading}
                  className="rounded-xl bg-emerald-300 px-4 py-2 text-sm font-bold text-gray-950 disabled:opacity-40"
                >
                  OK, import
                </button>
              </div>
            </div>
            <div className="max-h-[70vh] overflow-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="sticky top-0 bg-gray-900 text-white/60">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Dòng</th>
                    <th className="px-3 py-2 font-semibold">Từ</th>
                    <th className="px-3 py-2 font-semibold">Ngôn ngữ</th>
                    <th className="px-3 py-2 font-semibold">Loại</th>
                    <th className="px-3 py-2 font-semibold">IPA</th>
                    <th className="px-3 py-2 font-semibold">Nghĩa</th>
                    <th className="px-3 py-2 font-semibold min-w-[180px]">Category (gán DB)</th>
                    <th className="px-3 py-2 font-semibold min-w-[140px]">Level (gán DB)</th>
                    <th className="px-3 py-2 font-semibold">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {wordImportPreview.rows.slice(0, 300).map((row, i) => (
                    <tr key={`${row.index}-${row.word}-${row.language}`}>
                      <td className="px-3 py-2 text-white/45">{row.index}</td>
                      <td className="px-3 py-2 font-semibold text-white">{row.word}</td>
                      <td className="px-3 py-2 text-white/70">{LANGUAGE_LABEL[row.language] || row.language}</td>
                      <td className="px-3 py-2 text-white/70">{row.type || 'other'}</td>
                      <td className="px-3 py-2 text-white/70">{row.ipa || '-'}</td>
                      <td className="px-3 py-2 text-white/70 max-w-[220px] truncate" title={row.vietnamese_definition}>{row.vietnamese_definition || '-'}</td>
                      <td className="px-3 py-2">
                        <select
                          value={row.categoryId || ''}
                          onChange={e => updateWordPreviewRow(i, { categoryId: e.target.value || null, categoryConfidence: 'manual' })}
                          className={`w-full rounded-md border bg-gray-900 text-white text-xs px-2 py-1 outline-none ${
                            row.categoryConfidence === 'exact' ? 'border-emerald-400/40' :
                            row.categoryConfidence === 'fuzzy' ? 'border-amber-400/50' :
                            row.categoryConfidence === 'manual' ? 'border-cyan-400/40' :
                            'border-white/10'
                          }`}
                        >
                          <option value="">— None —</option>
                          {categoryOptions.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                        {row.categoryRaw && (
                          <div className="text-[10px] text-white/40 mt-0.5 truncate" title={row.categoryRaw}>
                            Excel: "{row.categoryRaw}" {row.categoryConfidence === 'fuzzy' ? '(gần đúng)' : row.categoryConfidence === 'none' ? '(không khớp)' : ''}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={row.level || ''}
                          onChange={e => updateWordPreviewRow(i, { level: e.target.value || null, levelConfidence: 'manual' })}
                          className={`w-full rounded-md border bg-gray-900 text-white text-xs px-2 py-1 outline-none ${
                            row.levelConfidence === 'exact' ? 'border-emerald-400/40' :
                            row.levelConfidence === 'fuzzy' ? 'border-amber-400/50' :
                            row.levelConfidence === 'manual' ? 'border-cyan-400/40' :
                            'border-white/10'
                          }`}
                        >
                          <option value="">— None —</option>
                          {levelOptions.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                        {row.levelRaw && (
                          <div className="text-[10px] text-white/40 mt-0.5">
                            Excel: "{row.levelRaw}" {row.levelConfidence === 'fuzzy' ? '(gần đúng)' : row.levelConfidence === 'none' ? '(không khớp)' : ''}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                          row.status === 'new' ? 'bg-emerald-500/20 text-emerald-200' :
                          row.status === 'update' ? 'bg-cyan-500/20 text-cyan-200' :
                          'bg-white/10 text-white/50'
                        }`}>
                          {row.status === 'new' ? 'Mới' : row.status === 'update' ? 'Cập nhật' : 'Bỏ qua'}
                        </span>
                        {row.reason && <div className="text-[10px] text-white/40 mt-0.5">{row.reason}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {wordImportPreview.rows.length > 300 && (
                <div className="p-3 text-center text-xs text-white/45">Chỉ hiện 300/{wordImportPreview.rows.length} dòng đầu — bấm "OK, import" để xử lý toàn bộ (các dòng sau dùng giá trị tự động gán).</div>
              )}
            </div>
          </div>
        </div>
      )}

      {sentenceImportPreview && (
        <div className="fixed inset-0 z-40 bg-gray-950/80 backdrop-blur-sm px-4 py-6 overflow-y-auto">
          <div className="mx-auto max-w-6xl rounded-2xl border border-white/10 bg-gray-950 shadow-2xl">
            <div className="flex flex-col gap-2 border-b border-white/10 p-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-bold">Xem trước import câu</h2>
                <p className="text-xs text-white/45">
                  {sentenceImportPreview.fileName} · {sentenceImportPreview.totalParsed} dòng · sau dedup {sentenceImportPreview.deduped}
                </p>
                <p className="text-xs text-emerald-300/90 mt-1">
                  Mới: {sentenceImportPreview.newCount} · Cập nhật: {sentenceImportPreview.updateCount}
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setSentenceImportPreview(null)} disabled={loading} className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Huỷ</button>
                <button type="button" onClick={confirmSentenceImport} disabled={loading} className="rounded-xl bg-emerald-300 px-4 py-2 text-sm font-bold text-gray-950 disabled:opacity-40">OK, import</button>
              </div>
            </div>
            <div className="max-h-[70vh] overflow-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="sticky top-0 bg-gray-900 text-white/60">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Dòng</th>
                    <th className="px-3 py-2 font-semibold">Câu</th>
                    <th className="px-3 py-2 font-semibold">Ngôn ngữ</th>
                    <th className="px-3 py-2 font-semibold">Bản dịch</th>
                    <th className="px-3 py-2 font-semibold">Topic</th>
                    <th className="px-3 py-2 font-semibold">Level</th>
                    <th className="px-3 py-2 font-semibold">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {sentenceImportPreview.rows.slice(0, 300).map(row => (
                    <tr key={`${row.index}-${row.language}`}>
                      <td className="px-3 py-2 text-white/45">{row.index}</td>
                      <td className="px-3 py-2 text-white max-w-[320px] truncate" title={row.sentence}>{row.sentence}</td>
                      <td className="px-3 py-2 text-white/70">{LANGUAGE_LABEL[row.language] || row.language}</td>
                      <td className="px-3 py-2 text-white/70 max-w-[260px] truncate" title={row.vietnamese_translation}>{row.vietnamese_translation || '-'}</td>
                      <td className="px-3 py-2 text-white/70">{row.topic || '-'}</td>
                      <td className="px-3 py-2 text-white/70">{row.level || '-'}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                          row.status === 'new' ? 'bg-emerald-500/20 text-emerald-200' : 'bg-cyan-500/20 text-cyan-200'
                        }`}>
                          {row.status === 'new' ? 'Mới' : 'Cập nhật'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {sentenceImportPreview.rows.length > 300 && (
                <div className="p-3 text-center text-xs text-white/45">Chỉ hiện 300/{sentenceImportPreview.rows.length} dòng đầu — bấm "OK, import" để xử lý toàn bộ.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {categoryImportPreview && (
        <div className="fixed inset-0 z-40 bg-gray-950/80 backdrop-blur-sm px-4 py-6 overflow-y-auto">
          <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-gray-950 shadow-2xl">
            <div className="flex flex-col gap-2 border-b border-white/10 p-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-bold">Xem trước import chủ đề</h2>
                <p className="text-xs text-white/45">{categoryImportPreview.fileName} · {categoryImportPreview.totalParsed} dòng</p>
                <p className="text-xs text-emerald-300/90 mt-1">
                  Mới: {categoryImportPreview.newCount} · Cập nhật: {categoryImportPreview.updateCount}
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setCategoryImportPreview(null)} disabled={loading} className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Huỷ</button>
                <button type="button" onClick={confirmCategoryImport} disabled={loading} className="rounded-xl bg-emerald-300 px-4 py-2 text-sm font-bold text-gray-950 disabled:opacity-40">OK, import</button>
              </div>
            </div>
            <div className="max-h-[70vh] overflow-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="sticky top-0 bg-gray-900 text-white/60">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Dòng</th>
                    <th className="px-3 py-2 font-semibold">Tên</th>
                    <th className="px-3 py-2 font-semibold">Slug</th>
                    <th className="px-3 py-2 font-semibold">Level</th>
                    <th className="px-3 py-2 font-semibold">Mô tả</th>
                    <th className="px-3 py-2 font-semibold">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {categoryImportPreview.rows.slice(0, 300).map(row => (
                    <tr key={`${row.index}-${row.slug}`}>
                      <td className="px-3 py-2 text-white/45">{row.index}</td>
                      <td className="px-3 py-2 text-white">{row.name}</td>
                      <td className="px-3 py-2 text-white/70">{row.slug}</td>
                      <td className="px-3 py-2 text-white/70">{row.level || '-'}</td>
                      <td className="px-3 py-2 text-white/70 max-w-[260px] truncate" title={row.description}>{row.description || '-'}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                          row.status === 'new' ? 'bg-emerald-500/20 text-emerald-200' : 'bg-cyan-500/20 text-cyan-200'
                        }`}>
                          {row.status === 'new' ? 'Mới' : 'Cập nhật'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'words' && (
        <div className="px-4 grid gap-4">
          <section className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
            <button
              type="button"
              onClick={() => setWordFormOpen(open => !open)}
              className="w-full flex items-center justify-between gap-3 p-3 sm:p-4 text-left"
              aria-expanded={wordFormOpen}
            >
              <span className="flex items-center gap-2 text-white font-semibold">
                <Plus size={16} /> {wordForm.id ? 'Sửa từ' : 'Thêm từ'}
              </span>
              <span className="rounded-lg bg-white/10 px-2.5 py-1 text-xs text-white/70">{wordFormOpen ? 'Close' : 'Expand'}</span>
            </button>
            {wordFormOpen && (
              <form onSubmit={saveWord} className="grid gap-3 border-t border-white/10 p-3 sm:p-4">
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label="Từ"><input className={inputClass()} value={wordForm.word} onChange={e => setWordForm({ ...wordForm, word: e.target.value })} required /></Field>
                  <Field label="Loại từ">
                    <select className={inputClass()} value={wordForm.type} onChange={e => setWordForm({ ...wordForm, type: e.target.value })}>{WORD_TYPES.map(t => <option key={t}>{t}</option>)}</select>
                  </Field>
                </div>
                <Field label="IPA"><input className={inputClass()} value={wordForm.ipa || ''} onChange={e => setWordForm({ ...wordForm, ipa: e.target.value })} /></Field>
                <Field label="Nghĩa tiếng Việt"><textarea className={inputClass()} value={wordForm.vietnamese_definition} onChange={e => setWordForm({ ...wordForm, vietnamese_definition: e.target.value })} required /></Field>
                <Field label="Ví dụ"><textarea className={inputClass()} value={wordForm.example_sentence || ''} onChange={e => setWordForm({ ...wordForm, example_sentence: e.target.value })} /></Field>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label="Từ gốc"><input className={inputClass()} value={wordForm.root_word || ''} onChange={e => setWordForm({ ...wordForm, root_word: e.target.value })} /></Field>
                  <Field label="Level"><select className={inputClass()} value={wordForm.level || ''} onChange={e => setWordForm({ ...wordForm, level: e.target.value })}><option value="">None</option>{levelOptions.map(l => <option key={l}>{l}</option>)}</select></Field>
                </div>
                <Field label="Family words"><input className={inputClass()} value={wordForm.family_words || ''} onChange={e => setWordForm({ ...wordForm, family_words: e.target.value })} placeholder="comma separated" /></Field>
                <Field label="Từ đồng nghĩa"><input className={inputClass()} value={wordForm.synonyms || ''} onChange={e => setWordForm({ ...wordForm, synonyms: e.target.value })} /></Field>
                <Field label="Từ trái nghĩa"><input className={inputClass()} value={wordForm.antonyms || ''} onChange={e => setWordForm({ ...wordForm, antonyms: e.target.value })} /></Field>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label="Chủ đề"><select className={inputClass()} value={wordForm.category_id || ''} onChange={e => setWordForm({ ...wordForm, category_id: e.target.value })}><option value="">None</option>{categoryOptions.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></Field>
                  <Field label="Ngôn ngữ"><select className={inputClass()} value={wordForm.language || 'english'} onChange={e => setWordForm({ ...wordForm, language: e.target.value })}>{WORD_LANGUAGES.map(l => <option key={l} value={l}>{LANGUAGE_LABEL[l]}</option>)}</select></Field>
                </div>
                <div className="grid grid-cols-[1fr_auto_auto] gap-2">
                  <button disabled={loading} className="flex-1 rounded-xl bg-emerald-300 text-gray-950 font-bold py-3">Lưu</button>
                  <button type="button" onClick={() => setWordForm(emptyWord)} className="rounded-xl bg-white/10 px-4">Clear</button>
                  <button type="button" onClick={() => setWordFormOpen(false)} className="rounded-xl bg-white/10 px-4">Close</button>
                </div>
              </form>
            )}
          </section>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 sm:p-4">
            <div className="relative mb-3">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                className={`${inputClass()} pl-10 py-3 text-base`}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Tra từ, nghĩa, từ gốc..."
              />
            </div>
            <div className="grid gap-2 mb-3 grid-cols-2 sm:grid-cols-4">
              <button type="button" onClick={exportWords} disabled={displayedWords.length === 0} className="rounded-xl bg-emerald-300 text-gray-950 px-3 py-2.5 text-xs font-bold disabled:opacity-40 flex items-center justify-center gap-2">
                <Download size={15} />
                Export Excel
              </button>
              <button type="button" onClick={downloadImportTemplate} className="rounded-xl bg-white/10 text-white px-3 py-2.5 text-xs font-bold flex items-center justify-center gap-2">
                <Download size={15} />
                File mẫu
              </button>
              <label className="rounded-xl bg-white text-gray-950 px-3 py-2.5 text-xs font-bold cursor-pointer flex items-center justify-center">
                Import Excel
                <input type="file" accept=".xlsx,.xls,.csv" onChange={handleImport} className="hidden" />
              </label>
              <button type="button" onClick={refreshWords} disabled={wordsRefreshing} className="rounded-xl bg-white/10 text-white px-3 py-2.5 text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-2">
                <RefreshCw size={15} className={wordsRefreshing ? 'animate-spin' : ''} />
                Tải lại
              </button>
            </div>
            <div className="grid gap-2 mb-3 sm:grid-cols-2 lg:grid-cols-4">
              <select className={inputClass()} value={languageFilter} onChange={e => setLanguageFilter(e.target.value)}>
                <option value="all">Tất cả ngôn ngữ</option>
                {WORD_LANGUAGES.map(l => <option key={l} value={l}>{LANGUAGE_LABEL[l]}</option>)}
              </select>
              <select className={inputClass()} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                <option value="all">Tất cả chủ đề</option>
                {categoryOptions.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <select className={inputClass()} value={wordLevelFilter} onChange={e => setWordLevelFilter(e.target.value)}>
                <option value="all">Tất cả level</option>
                <option value="none">Chưa có level</option>
                {levelOptions.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
              <select className={inputClass()} value={wordStatusFilter} onChange={e => setWordStatusFilter(e.target.value)}>
                <option value="all">Tất cả từ</option>
                <option value="missing-ipa">Thiếu IPA</option>
                <option value="missing-stress">Lỗi IPA (thiếu stress ˈ)</option>
                <option value="generic-definition">Nghĩa mô tả chung</option>
                <option value="flagged">Đã đánh dấu sai</option>
                <option value="missing-root">Thiếu từ gốc</option>
              </select>
            </div>
            <div className="mb-3 flex flex-wrap gap-x-2 gap-y-1 text-xs text-white/45">
              <span>Hiển thị {visibleWords.length}/{displayedWords.length} từ khớp bộ lọc</span>
              <span>· tổng {allWords.length}</span>
              {wordsRefreshing && <span>· đang tải...</span>}
              {query !== deferredQuery && <span>· đang lọc...</span>}
              {!wordsRefreshing && wordsCachedAt && <span>· cache {new Date(wordsCachedAt).toLocaleTimeString()}</span>}
            </div>
            <div className="mb-3 flex flex-wrap gap-2">
              {!wordsDeleteMode && (
                <button
                  type="button"
                  onClick={enterWordsDeleteMode}
                  className="rounded-xl bg-red-500/15 text-red-200 border border-red-400/25 px-3 py-2 text-xs font-bold flex items-center gap-2"
                >
                  <Trash2 size={14} /> Xoá hàng loạt
                </button>
              )}
              {wordsDeleteMode && (
                <>
                  <button
                    type="button"
                    onClick={selectAllWordsInDb}
                    disabled={loading}
                    className="rounded-xl bg-white/10 text-white px-3 py-2 text-xs font-bold disabled:opacity-40 flex items-center gap-2"
                  >
                    <CheckSquare size={14} /> Chọn tất cả trong DB
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedWordIds(new Set())}
                    disabled={loading || selectedWordIds.size === 0}
                    className="rounded-xl bg-white/10 text-white px-3 py-2 text-xs font-bold disabled:opacity-40"
                  >
                    Bỏ chọn
                  </button>
                  <button
                    type="button"
                    onClick={requestDeleteSelectedWords}
                    disabled={loading || selectedWordIds.size === 0}
                    className="rounded-xl bg-red-500 text-white px-3 py-2 text-xs font-bold disabled:opacity-40 flex items-center gap-2"
                  >
                    <Trash2 size={14} /> Xoá {selectedWordIds.size} từ
                  </button>
                  <button
                    type="button"
                    onClick={exitWordsDeleteMode}
                    className="rounded-xl bg-white/10 text-white px-3 py-2 text-xs font-bold"
                  >
                    Huỷ
                  </button>
                </>
              )}
            </div>
            <div className="grid gap-2">
              {visibleWords.map(item => (
                <WordListItem
                  key={item.id}
                  item={item}
                  onEdit={editWord}
                  onToggleFlag={toggleFlag}
                  onDelete={deleteWordAndRefresh}
                  selectMode={wordsDeleteMode}
                  isSelected={selectedWordIds.has(item.id)}
                  onToggleSelect={toggleSelectWord}
                />
              ))}
              {visibleWords.length < displayedWords.length && (
                <button
                  type="button"
                  onClick={() => setVisibleWordLimit(limit => limit + WORDS_PAGE_SIZE)}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/70 active:scale-[0.99]"
                >
                  Xem thêm {Math.min(WORDS_PAGE_SIZE, displayedWords.length - visibleWords.length)} từ
                </button>
              )}
              {displayedWords.length === 0 && (
                <div className="rounded-xl border border-white/10 bg-gray-950/40 p-4 text-sm text-white/45 text-center">
                  Không có từ nào khớp bộ lọc.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'sentences' && (
        <div className="px-4 grid gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 sm:p-4">
            <div className="relative mb-3">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                className={`${inputClass()} pl-10 py-3 text-base`}
                value={sentenceQuery}
                onChange={e => setSentenceQuery(e.target.value)}
                placeholder="Search sentences, translation, topic..."
              />
            </div>
            <div className="grid gap-2 mb-3 grid-cols-2 sm:grid-cols-4">
              <button type="button" onClick={exportSentences} disabled={sentences.length === 0} className="rounded-xl bg-emerald-300 text-gray-950 px-3 py-2.5 text-xs font-bold disabled:opacity-40 flex items-center justify-center gap-2">
                <Download size={15} />
                Export Excel
              </button>
              <button type="button" onClick={downloadSentenceTemplate} className="rounded-xl bg-white/10 text-white px-3 py-2.5 text-xs font-bold flex items-center justify-center gap-2">
                <Download size={15} />
                File mau
              </button>
              <label className="rounded-xl bg-white text-gray-950 px-3 py-2.5 text-xs font-bold cursor-pointer flex items-center justify-center">
                Import Excel
                <input type="file" accept=".xlsx,.xls,.csv" onChange={handleImportSentences} className="hidden" />
              </label>
              <button type="button" onClick={refreshSentences} disabled={sentencesRefreshing} className="rounded-xl bg-white/10 text-white px-3 py-2.5 text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-2">
                <RefreshCw size={15} className={sentencesRefreshing ? 'animate-spin' : ''} />
                Reload
              </button>
            </div>
            <div className="grid gap-2 mb-3 sm:grid-cols-3">
              <select className={inputClass()} value={sentenceLanguageFilter} onChange={e => setSentenceLanguageFilter(e.target.value)}>
                <option value="all">All languages</option>
                {WORD_LANGUAGES.map(language => <option key={language} value={language}>{LANGUAGE_LABEL[language]}</option>)}
              </select>
              <select className={inputClass()} value={sentenceLevelFilter} onChange={e => setSentenceLevelFilter(e.target.value)}>
                <option value="all">All levels</option>
                <option value="none">No level</option>
                {levelOptions.map(level => <option key={level} value={level}>{level}</option>)}
              </select>
              <select className={inputClass()} value={sentenceTopicFilter} onChange={e => setSentenceTopicFilter(e.target.value)}>
                <option value="all">All topics</option>
                {sentenceTopicOptions.map(topic => <option key={topic} value={topic}>{topic}</option>)}
              </select>
            </div>
            <div className="mb-3 flex flex-wrap gap-x-2 gap-y-1 text-xs text-white/45">
              <span>Loaded {sentences.length}/{sentencesTotal} sentences</span>
              {(sentencesRefreshing || sentencesLoadingMore) && <span>· loading...</span>}
            </div>
            <div className="mb-3 flex flex-wrap gap-2">
              {!sentencesDeleteMode && (
                <button
                  type="button"
                  onClick={enterSentencesDeleteMode}
                  className="rounded-xl bg-red-500/15 text-red-200 border border-red-400/25 px-3 py-2 text-xs font-bold flex items-center gap-2"
                >
                  <Trash2 size={14} /> Xoá hàng loạt
                </button>
              )}
              {sentencesDeleteMode && (
                <>
                  <button
                    type="button"
                    onClick={selectAllSentencesInDb}
                    disabled={loading}
                    className="rounded-xl bg-white/10 text-white px-3 py-2 text-xs font-bold disabled:opacity-40 flex items-center gap-2"
                  >
                    <CheckSquare size={14} /> Chọn tất cả trong DB (theo bộ lọc)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSentenceIds(new Set())}
                    disabled={loading || selectedSentenceIds.size === 0}
                    className="rounded-xl bg-white/10 text-white px-3 py-2 text-xs font-bold disabled:opacity-40"
                  >
                    Bỏ chọn
                  </button>
                  <button
                    type="button"
                    onClick={requestDeleteSelectedSentences}
                    disabled={loading || selectedSentenceIds.size === 0}
                    className="rounded-xl bg-red-500 text-white px-3 py-2 text-xs font-bold disabled:opacity-40 flex items-center gap-2"
                  >
                    <Trash2 size={14} /> Xoá {selectedSentenceIds.size} câu
                  </button>
                  <button
                    type="button"
                    onClick={exitSentencesDeleteMode}
                    className="rounded-xl bg-white/10 text-white px-3 py-2 text-xs font-bold"
                  >
                    Huỷ
                  </button>
                </>
              )}
            </div>
            <div className="grid gap-2">
              {sentences.map(item => {
                const isSelected = selectedSentenceIds.has(item.id)
                if (sentencesDeleteMode) {
                  return (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => toggleSelectSentence(item.id)}
                      className={`w-full text-left rounded-xl border p-3 flex items-start gap-3 ${isSelected ? 'border-red-400/60 bg-red-500/10' : 'border-white/10 bg-gray-950/40'}`}
                    >
                      <span className={`mt-0.5 ${isSelected ? 'text-red-300' : 'text-white/40'}`}>
                        {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold leading-snug break-words">{item.sentence}</div>
                        <div className="text-white/50 text-sm leading-snug mt-1 break-words">{item.vietnamese_translation || 'No translation'}</div>
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                          <span className="rounded-lg border border-cyan-400/20 bg-cyan-500/10 px-2 py-1 text-cyan-100">{LANGUAGE_LABEL[item.language || 'english']}</span>
                          {item.topic && <span className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-white/60">{item.topic}</span>}
                          {item.level && <span className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-2 py-1 text-emerald-200">{item.level}</span>}
                        </div>
                      </div>
                    </button>
                  )
                }
                return (
                  <div key={item.id} className="rounded-xl border border-white/10 bg-gray-950/40 p-3">
                    <div className="font-semibold leading-snug break-words">{item.sentence}</div>
                    <div className="text-white/50 text-sm leading-snug mt-1 break-words">{item.vietnamese_translation || 'No translation'}</div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                      <span className="rounded-lg border border-cyan-400/20 bg-cyan-500/10 px-2 py-1 text-cyan-100">{LANGUAGE_LABEL[item.language || 'english']}</span>
                      {item.topic && <span className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-white/60">{item.topic}</span>}
                      {item.level && <span className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-2 py-1 text-emerald-200">{item.level}</span>}
                      {item.source && <span className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-white/35">{item.source}</span>}
                    </div>
                  </div>
                )
              })}
              {sentencesHasMore && (
                <button
                  type="button"
                  onClick={loadMoreSentences}
                  disabled={sentencesLoadingMore}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/70 active:scale-[0.99] disabled:opacity-50"
                >
                  {sentencesLoadingMore ? 'Loading...' : `Load more ${Math.min(SENTENCES_PAGE_SIZE, Math.max(sentencesTotal - sentences.length, 0))} sentences`}
                </button>
              )}
              {sentences.length === 0 && !sentencesRefreshing && (
                <div className="rounded-xl border border-white/10 bg-gray-950/40 p-4 text-sm text-white/45 text-center">
                  No sentences match the current filters.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'categories' && (
        <div className="px-4 grid gap-4">
          <div className="flex gap-2">
            <label className="rounded-xl bg-white text-gray-950 px-3 py-2.5 text-xs font-bold cursor-pointer">
              Import Excel
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleImportCategories} className="hidden" />
            </label>
            <button type="button" onClick={handleDownloadCategoryTemplate} className="rounded-xl bg-white/10 text-white px-3 py-2.5 text-xs font-bold flex items-center gap-2">
              <Download size={15} />
              File mẫu
            </button>
          </div>
          <section className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
            <button
              type="button"
              onClick={() => setCategoryFormOpen(open => !open)}
              className="w-full flex items-center justify-between gap-3 p-3 text-left"
              aria-expanded={categoryFormOpen}
            >
              <span className="flex items-center gap-2 text-white font-semibold">
                <Plus size={16} /> {categoryForm.id ? 'Sửa chủ đề' : 'Thêm chủ đề'}
              </span>
              <span className="rounded-lg bg-white/10 px-2.5 py-1 text-xs text-white/70">{categoryFormOpen ? 'Close' : 'Expand'}</span>
            </button>
            {categoryFormOpen && (
              <form onSubmit={saveCategory} className="grid gap-3 border-t border-white/10 p-3">
                <Field label="Tên chủ đề"><input className={inputClass()} value={categoryForm.name} onChange={e => setCategoryForm({ ...categoryForm, name: e.target.value })} required /></Field>
                <Field label="Slug"><input className={inputClass()} value={categoryForm.slug || ''} onChange={e => setCategoryForm({ ...categoryForm, slug: e.target.value })} /></Field>
                <Field label="Level"><select className={inputClass()} value={categoryForm.level || ''} onChange={e => setCategoryForm({ ...categoryForm, level: e.target.value })}><option value="">None</option>{levelOptions.map(l => <option key={l}>{l}</option>)}</select></Field>
                <Field label="Mô tả"><textarea className={inputClass()} value={categoryForm.description || ''} onChange={e => setCategoryForm({ ...categoryForm, description: e.target.value })} /></Field>
                <div className="grid grid-cols-[1fr_auto_auto] gap-2">
                  <button disabled={loading} className="rounded-xl bg-emerald-300 text-gray-950 font-bold py-3">Lưu chủ đề</button>
                  <button type="button" onClick={() => setCategoryForm(emptyCategory)} className="rounded-xl bg-white/10 px-4">Clear</button>
                  <button type="button" onClick={() => setCategoryFormOpen(false)} className="rounded-xl bg-white/10 px-4">Close</button>
                </div>
              </form>
            )}
          </section>
          <div className="grid gap-2">
            {categories.map(item => (
              <div key={item.id} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-3">
                <button onClick={() => { setCategoryForm(item); setCategoryFormOpen(true) }} className="flex-1 text-left">
                  <div className="font-semibold">{item.name}</div>
                  <div className="text-white/40 text-xs">{item.slug} · {item.level || 'No level'}</div>
                </button>
                <button onClick={async () => { await deleteCategory(item.id); await refreshCategories() }} className="w-9 h-9 rounded-xl bg-red-500/10 text-red-200 flex items-center justify-center"><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'levels' && (
        <div className="px-4 grid gap-3">
          <p className="text-xs text-white/45 leading-relaxed">
            Quản lý danh sách level (vd: A1, A2, …). Khi xoá một level, các từ / chủ đề / câu đang dùng sẽ tự động bỏ trống level (set null).
          </p>
          <section className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
            <button
              type="button"
              onClick={() => setLevelFormOpen(open => !open)}
              className="w-full flex items-center justify-between gap-3 p-3 text-left"
              aria-expanded={levelFormOpen}
            >
              <span className="flex items-center gap-2 text-white font-semibold">
                <Plus size={16} /> {levelForm.originalCode ? `Sửa level "${levelForm.originalCode}"` : 'Thêm level'}
              </span>
              <span className="rounded-lg bg-white/10 px-2.5 py-1 text-xs text-white/70">{levelFormOpen ? 'Close' : 'Expand'}</span>
            </button>
            {levelFormOpen && (
              <form onSubmit={saveLevel} className="grid gap-3 border-t border-white/10 p-3">
                <Field label="Mã level (vd: A1)">
                  <input
                    className={inputClass()}
                    value={levelForm.code}
                    onChange={e => setLevelForm({ ...levelForm, code: e.target.value })}
                    required
                    maxLength={16}
                  />
                </Field>
                <Field label="Tên hiển thị">
                  <input
                    className={inputClass()}
                    value={levelForm.name}
                    onChange={e => setLevelForm({ ...levelForm, name: e.target.value })}
                    placeholder="vd: Beginner"
                  />
                </Field>
                <Field label="Thứ tự (số nhỏ hiện trước)">
                  <input
                    type="number"
                    className={inputClass()}
                    value={levelForm.order_index}
                    onChange={e => setLevelForm({ ...levelForm, order_index: e.target.value })}
                  />
                </Field>
                <div className="grid grid-cols-[1fr_auto_auto] gap-2">
                  <button disabled={loading} className="rounded-xl bg-emerald-300 text-gray-950 font-bold py-3">Lưu level</button>
                  <button type="button" onClick={() => setLevelForm(emptyLevel)} className="rounded-xl bg-white/10 px-4">Clear</button>
                  <button type="button" onClick={() => setLevelFormOpen(false)} className="rounded-xl bg-white/10 px-4">Close</button>
                </div>
              </form>
            )}
          </section>
          <div className="grid gap-2">
            {levelsList.length === 0 && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/45">Chưa có level nào.</div>
            )}
            {levelsList.map(item => (
              <div key={item.code} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-3">
                <button
                  onClick={() => {
                    setLevelForm({
                      code: item.code,
                      name: item.name || '',
                      order_index: item.order_index ?? 0,
                      originalCode: item.code,
                    })
                    setLevelFormOpen(true)
                  }}
                  className="flex-1 text-left"
                >
                  <div className="font-semibold">{item.code}</div>
                  <div className="text-white/40 text-xs">{item.name || 'No name'} · order {item.order_index ?? 0}</div>
                </button>
                <button
                  onClick={() => {
                    if (window.confirm(`Xoá level "${item.code}"? Các từ/chủ đề/câu đang dùng sẽ bị set null.`)) {
                      removeLevel(item.code)
                    }
                  }}
                  disabled={loading}
                  className="w-9 h-9 rounded-xl bg-red-500/10 text-red-200 flex items-center justify-center disabled:opacity-40"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div className="px-4 grid gap-2">
          {profiles.map(item => (
            <div key={item.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-sm font-semibold">{item.email || item.id}</div>
              <input className={`${inputClass()} mt-2`} value={item.full_name || ''} onChange={e => setProfiles(prev => prev.map(p => p.id === item.id ? { ...p, full_name: e.target.value } : p))} placeholder="Full name" />
              <div className="grid grid-cols-2 gap-2 mt-2">
                <select className={inputClass()} value={item.role} onChange={e => setProfiles(prev => prev.map(p => p.id === item.id ? { ...p, role: e.target.value } : p))}>
                  {['admin', 'teacher', 'student'].map(role => <option key={role}>{role}</option>)}
                </select>
                <label className="rounded-xl bg-white/10 border border-white/10 px-3 py-2.5 text-sm flex items-center gap-2">
                  <input type="checkbox" checked={item.is_active} onChange={e => setProfiles(prev => prev.map(p => p.id === item.id ? { ...p, is_active: e.target.checked } : p))} />
                  Active
                </label>
              </div>
              <button onClick={async () => { await updateProfile(item); await refreshProfiles() }} className="mt-2 w-full rounded-xl bg-white text-gray-950 font-semibold py-2.5">Lưu user</button>
            </div>
          ))}
          <p className="text-white/35 text-xs leading-relaxed">Xóa Auth user cần Supabase Dashboard hoặc Edge Function dùng service_role. Frontend anon key chỉ nên sửa profile, role, active.</p>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-sm rounded-2xl border border-red-400/30 bg-gray-900 p-5 shadow-xl">
            <h3 className="mb-1 text-lg font-bold text-white">Xác nhận xoá</h3>
            <p className="mb-5 text-sm text-white/65">
              Xoá vĩnh viễn <span className="font-bold text-red-300">{deleteConfirm.count}</span> {deleteConfirm.type === 'words' ? 'từ' : 'câu'}? Thao tác không thể hoàn tác.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                disabled={loading}
                className="rounded-xl bg-white/10 py-3 font-semibold text-white disabled:opacity-50"
              >
                Huỷ
              </button>
              <button
                type="button"
                onClick={deleteConfirm.type === 'words' ? executeDeleteWords : executeDeleteSentences}
                disabled={loading}
                className="flex items-center justify-center gap-2 rounded-xl bg-red-500 py-3 font-bold text-white disabled:opacity-50"
              >
                {loading ? <RefreshCw size={15} className="animate-spin" /> : <Trash2 size={15} />}
                Xoá {deleteConfirm.count}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
