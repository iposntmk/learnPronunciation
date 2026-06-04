import { Search } from 'lucide-react'
import LevelCombobox from '../common/LevelCombobox.jsx'
import { DICTIONARY_LANGUAGES, LANGUAGE_FLAG, LANGUAGE_SHORT } from '../../utils/constants/languages.js'

// Header + all list filters (language / level / category / learned) + status messages.
export default function DictionaryFilters({
  visibleCount, filteredCount, onRefresh, supabaseLoading,
  commonQuery, setCommonQuery, deferredCommonQuery,
  commonLanguage, setCommonLanguage,
  supabaseLevels, commonLevel, setCommonLevel,
  supabaseCategories, commonCategory, setCommonCategory,
  supabaseError, supabaseWordsCount, dictionaryCachedAt,
  levelScopedCount, scopedUnlearnedCount, scopedLearnedCount,
  commonLearnedFilter, setCommonLearnedFilter,
}) {
  return (
    <>
      <div className="flex items-end justify-between gap-3 mb-3">
        <div>
          <h2 className="text-white font-semibold">Supabase Vocabulary</h2>
          <p className="text-white/40 text-xs">Dữ liệu từ bảng words/categories</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="text-white/35 text-xs">{visibleCount}/{filteredCount} từ</div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={supabaseLoading}
            className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold text-white/55 disabled:opacity-40"
          >
            Tải lại
          </button>
        </div>
      </div>

      <div className="relative mb-3">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          value={commonQuery}
          onChange={e => setCommonQuery(e.target.value)}
          placeholder="Tìm từ trong Supabase..."
          className="w-full bg-white/5 border border-white/10 rounded-2xl pl-9 pr-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-white/30 text-sm"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setCommonLanguage('all')}
          className={`shrink-0 rounded-xl px-3 py-2 text-xs font-semibold border transition-colors ${commonLanguage === 'all' ? 'bg-white text-gray-950 border-white' : 'bg-white/5 text-white/60 border-white/10'}`}
        >
          🌐 Tất cả
        </button>
        {DICTIONARY_LANGUAGES.map(lang => (
          <button
            key={lang}
            onClick={() => setCommonLanguage(lang)}
            className={`shrink-0 rounded-xl px-3 py-2 text-xs font-semibold border transition-colors flex items-center gap-1 ${commonLanguage === lang ? 'bg-white text-gray-950 border-white' : 'bg-white/5 text-white/60 border-white/10'}`}
          >
            <span>{LANGUAGE_FLAG[lang]}</span>
            <span>{LANGUAGE_SHORT[lang]}</span>
          </button>
        ))}
      </div>

      <div className="pb-3">
        <LevelCombobox value={commonLevel} onChange={setCommonLevel} levels={supabaseLevels} />
      </div>

      <select
        value={commonCategory}
        onChange={e => setCommonCategory(e.target.value)}
        className="w-full mb-3 bg-white/5 border border-white/10 rounded-2xl px-3 py-3 text-white focus:outline-none focus:border-white/30 text-sm"
      >
        <option value="all">Tất cả chủ đề</option>
        {supabaseCategories.map(category => (
          <option key={category.id} value={category.id}>
            {category.level ? `${category.level} · ` : ''}{category.name}
          </option>
        ))}
      </select>

      {supabaseError && (
        <div className="mb-3 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-red-100 text-sm">
          Supabase error: {supabaseError}
        </div>
      )}

      {supabaseLoading && (
        <div className="mb-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white/50 text-sm">
          {supabaseWordsCount > 0 ? 'Đang cập nhật dữ liệu nền...' : 'Đang tải từ Supabase...'}
        </div>
      )}

      {!supabaseLoading && dictionaryCachedAt && (
        <div className="mb-3 text-[11px] text-white/30">
          Cache local: {new Date(dictionaryCachedAt).toLocaleString()}
          {commonQuery !== deferredCommonQuery ? ' · đang lọc...' : ''}
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-3">
        {[
          ['all', `Tất cả · ${levelScopedCount}`],
          ['unlearned', `Chưa học · ${scopedUnlearnedCount}`],
          ['learned', `Đã học · ${scopedLearnedCount}`],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setCommonLearnedFilter(key)}
            className={`shrink-0 rounded-xl px-3 py-2 text-xs font-semibold border transition-colors ${commonLearnedFilter === key ? 'bg-emerald-400 text-gray-950 border-emerald-300' : 'bg-white/5 text-white/60 border-white/10'}`}
          >
            {label}
          </button>
        ))}
      </div>
    </>
  )
}
