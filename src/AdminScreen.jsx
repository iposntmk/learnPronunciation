import React, { useEffect, useMemo, useState, useCallback, useDeferredValue } from 'react'
import { read, utils, writeFile } from 'xlsx'
import { ChevronLeft, Download, Plus, RefreshCw, Search, Trash2, Flag } from 'lucide-react'
import {
  GENERIC_VIETNAMESE_DEFINITIONS,
  LEVELS,
  WORD_LANGUAGES,
  WORD_TYPES,
  deleteCategory,
  deleteWord,
  fetchAllWords,
  importCategories,
  importSentences,
  importWords,
  listCategories,
  listProfiles,
  listSentences,
  setWordFlagged,
  updateProfile,
  upsertCategory,
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

const WordListItem = React.memo(function WordListItem({ item, onEdit, onToggleFlag, onDelete }) {
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
  const [sentencesLoaded, setSentencesLoaded] = useState(false)
  const [sentencesRefreshing, setSentencesRefreshing] = useState(false)
  const [wordsLoaded, setWordsLoaded] = useState(false)
  const [wordsCacheChecked, setWordsCacheChecked] = useState(false)
  const [wordsCachedAt, setWordsCachedAt] = useState(null)
  const [wordsRefreshing, setWordsRefreshing] = useState(false)
  const [profiles, setProfiles] = useState([])
  const [profilesLoaded, setProfilesLoaded] = useState(false)
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const [sentenceQuery, setSentenceQuery] = useState('')
  const deferredSentenceQuery = useDeferredValue(sentenceQuery)
  const [sentenceLevelFilter, setSentenceLevelFilter] = useState('all')
  const [sentenceTopicFilter, setSentenceTopicFilter] = useState('all')
  const [sentenceLanguageFilter, setSentenceLanguageFilter] = useState('all')
  const [visibleSentenceLimit, setVisibleSentenceLimit] = useState(SENTENCES_PAGE_SIZE)
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [languageFilter, setLanguageFilter] = useState('all')
  const [wordStatusFilter, setWordStatusFilter] = useState('all')
  const [visibleWordLimit, setVisibleWordLimit] = useState(WORDS_PAGE_SIZE)
  const [wordForm, setWordForm] = useState(emptyWord)
  const [wordFormOpen, setWordFormOpen] = useState(false)
  const [categoryForm, setCategoryForm] = useState(emptyCategory)
  const [categoryFormOpen, setCategoryFormOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [importProgress, setImportProgress] = useState(null)
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
      const data = await listSentences({ limit: 2000 })
      setSentences(data)
      setSentencesLoaded(true)
    } catch (err) {
      setSentencesLoaded(true)
      setToast({ type: 'error', message: `Sentence load failed: ${err.message}` })
    } finally {
      setSentencesRefreshing(false)
    }
  }, [])
  const refreshProfiles = useCallback(async () => {
    setProfiles(await listProfiles())
    setProfilesLoaded(true)
  }, [])

  useEffect(() => {
    refreshCategories().catch(err => setMessage(err.message))
  }, [refreshCategories])

  useEffect(() => {
    if (tab === 'words' && wordsCacheChecked && !wordsLoaded && !wordsRefreshing) refreshWords()
    if (tab === 'sentences' && !sentencesLoaded && !sentencesRefreshing) refreshSentences()
    if (tab === 'users' && !profilesLoaded) refreshProfiles().catch(err => {
      setProfilesLoaded(true)
      setMessage(err.message)
    })
  }, [profilesLoaded, refreshProfiles, refreshSentences, refreshWords, sentencesLoaded, sentencesRefreshing, tab, wordsCacheChecked, wordsLoaded, wordsRefreshing])

  useEffect(() => {
    setVisibleWordLimit(WORDS_PAGE_SIZE)
  }, [allWords, categoryFilter, deferredQuery, languageFilter, wordStatusFilter])

  useEffect(() => {
    setVisibleSentenceLimit(SENTENCES_PAGE_SIZE)
  }, [deferredSentenceQuery, sentenceLanguageFilter, sentenceLevelFilter, sentenceTopicFilter, sentences])

  useEffect(() => {
    if (tab !== 'words') return
    if (wordStatusFilter !== 'missing-root') return
    if (wordsRefreshing) return
    refreshWords()
  }, [tab, wordStatusFilter, wordsRefreshing, refreshWords])

  const categoryOptions = useMemo(() => categories.map(c => ({ value: c.id, label: `${c.level ? `${c.level} · ` : ''}${c.name}` })), [categories])

  const displayedWords = useMemo(() => {
    let list = allWords
    if (categoryFilter !== 'all') list = list.filter(w => (w.category_id || '') === categoryFilter)
    if (languageFilter !== 'all') list = list.filter(w => (w.language || 'english') === languageFilter)
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
  }, [allWords, categoryFilter, languageFilter, wordStatusFilter, deferredQuery])

  const visibleWords = useMemo(
    () => displayedWords.slice(0, visibleWordLimit),
    [displayedWords, visibleWordLimit]
  )

  const sentenceTopicOptions = useMemo(
    () => [...new Set(sentences.map(item => String(item.topic || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [sentences]
  )

  const displayedSentences = useMemo(() => {
    let list = sentences
    if (sentenceLanguageFilter !== 'all') list = list.filter(item => (item.language || 'english') === sentenceLanguageFilter)
    if (sentenceLevelFilter !== 'all') list = list.filter(item => item.level === sentenceLevelFilter)
    if (sentenceTopicFilter !== 'all') list = list.filter(item => item.topic === sentenceTopicFilter)
    const q = deferredSentenceQuery.trim().toLowerCase()
    if (q) {
      list = list.filter(item =>
        (item.sentence || '').toLowerCase().includes(q) ||
        (item.vietnamese_translation || '').toLowerCase().includes(q) ||
        (item.topic || '').toLowerCase().includes(q)
      )
    }
    return list
  }, [deferredSentenceQuery, sentenceLanguageFilter, sentenceLevelFilter, sentenceTopicFilter, sentences])

  const visibleSentences = useMemo(
    () => displayedSentences.slice(0, visibleSentenceLimit),
    [displayedSentences, visibleSentenceLimit]
  )

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
    setImportProgress({ phase: 'reading', current: 0, total: 0 })
    try {
      const buf = await file.arrayBuffer()
      const workbook = read(buf)
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows = utils.sheet_to_json(sheet, { defval: '' })
      const { inserted, updated } = await importWords(rows, categories, {
        onProgress: (event) => setImportProgress(event),
      })
      await refreshWords()
      setToast({ type: 'success', message: `Import xong: thêm mới ${inserted.length}, cập nhật ${updated.length}.` })
    } catch (err) {
      setToast({ type: 'error', message: `Import lỗi: ${err.message}` })
    } finally {
      setLoading(false)
      setImportProgress(null)
      event.target.value = ''
    }
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
    setImportProgress({ phase: 'reading', current: 0, total: 0 })
    try {
      const buf = await file.arrayBuffer()
      const workbook = read(buf)
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows = utils.sheet_to_json(sheet, { defval: '' })
      const imported = await importSentences(rows, {
        onProgress: (event) => setImportProgress(event),
      })
      await refreshSentences()
      setToast({ type: 'success', message: `Imported ${imported.length} sentences.` })
    } catch (err) {
      setToast({ type: 'error', message: `Sentence import failed: ${err.message}` })
    } finally {
      setLoading(false)
      setImportProgress(null)
      event.target.value = ''
    }
  }

  const exportSentences = () => {
    const rows = displayedSentences.map(item => ({
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
      const imported = await importCategories(rows)
      await refreshCategories()
      setMessage(`Đã import ${imported.length} chủ đề từ Excel.`)
    } catch (err) {
      setMessage(err.message)
    } finally {
      setLoading(false)
      event.target.value = ''
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
        {['words', 'sentences', 'categories', 'users'].map(item => (
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
                  <Field label="Level"><select className={inputClass()} value={wordForm.level || ''} onChange={e => setWordForm({ ...wordForm, level: e.target.value })}><option value="">None</option>{LEVELS.map(l => <option key={l}>{l}</option>)}</select></Field>
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
            <div className="grid gap-2 mb-3 sm:grid-cols-3">
              <select className={inputClass()} value={languageFilter} onChange={e => setLanguageFilter(e.target.value)}>
                <option value="all">Tất cả ngôn ngữ</option>
                {WORD_LANGUAGES.map(l => <option key={l} value={l}>{LANGUAGE_LABEL[l]}</option>)}
              </select>
              <select className={inputClass()} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                <option value="all">Tất cả chủ đề</option>
                {categoryOptions.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
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
            <div className="grid gap-2">
              {visibleWords.map(item => (
                <WordListItem
                  key={item.id}
                  item={item}
                  onEdit={editWord}
                  onToggleFlag={toggleFlag}
                  onDelete={deleteWordAndRefresh}
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
              <button type="button" onClick={exportSentences} disabled={displayedSentences.length === 0} className="rounded-xl bg-emerald-300 text-gray-950 px-3 py-2.5 text-xs font-bold disabled:opacity-40 flex items-center justify-center gap-2">
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
                {LEVELS.map(level => <option key={level} value={level}>{level}</option>)}
              </select>
              <select className={inputClass()} value={sentenceTopicFilter} onChange={e => setSentenceTopicFilter(e.target.value)}>
                <option value="all">All topics</option>
                {sentenceTopicOptions.map(topic => <option key={topic} value={topic}>{topic}</option>)}
              </select>
            </div>
            <div className="mb-3 flex flex-wrap gap-x-2 gap-y-1 text-xs text-white/45">
              <span>Showing {visibleSentences.length}/{displayedSentences.length} sentences</span>
              <span>· total {sentences.length}</span>
              {sentencesRefreshing && <span>· loading...</span>}
              {sentenceQuery !== deferredSentenceQuery && <span>· filtering...</span>}
            </div>
            <div className="grid gap-2">
              {visibleSentences.map(item => (
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
              ))}
              {visibleSentences.length < displayedSentences.length && (
                <button
                  type="button"
                  onClick={() => setVisibleSentenceLimit(limit => limit + SENTENCES_PAGE_SIZE)}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/70 active:scale-[0.99]"
                >
                  Show more {Math.min(SENTENCES_PAGE_SIZE, displayedSentences.length - visibleSentences.length)} sentences
                </button>
              )}
              {displayedSentences.length === 0 && (
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
                <Field label="Level"><select className={inputClass()} value={categoryForm.level || ''} onChange={e => setCategoryForm({ ...categoryForm, level: e.target.value })}><option value="">None</option>{LEVELS.map(l => <option key={l}>{l}</option>)}</select></Field>
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
    </div>
  )
}
