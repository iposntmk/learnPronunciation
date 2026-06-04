import { Plus, Minus, Pencil } from 'lucide-react'
import { LANGUAGE_FLAG } from '../../utils/constants/languages.js'
import { buildSupabaseWordDetail, dictionaryWordKey } from '../../utils/dictionaryHelpers.js'
import { buildWordStructures } from '../../utils/words/wordRelations.js'

// One vocabulary row + its expandable meaning/example/relations panel.
export default function DictionaryWordItem({
  entry, index, learnedWords, wordScores,
  expandedCommonWords, commonTranslations, meaningUpdates,
  showRefreshMeaningAction, filteredCommonWords,
  onOpenWord, onUpdateMeaning, onToggleDetail, onTranslateInList,
}) {
  const key = dictionaryWordKey(entry.word, entry.language)
  const isLearned = learnedWords.has(entry.word.toLowerCase())
  const savedScore = wordScores[entry.word.toLowerCase()]
  const detail = buildSupabaseWordDetail(entry)
  const firstMeaning = detail?.meanings?.find(item => item.pos !== 'translate')
  const isExpanded = expandedCommonWords.has(key)
  const hasDetails = detail?.meanings?.length > 0
  const listTranslation = commonTranslations[key]
  const meaningUpdate = meaningUpdates[key]
  const listStructures = buildWordStructures(entry.word)

  return (
    <div
      className={`min-w-0 border rounded-xl transition ${isLearned ? 'bg-emerald-500/10 border-emerald-500/25' : 'bg-white/5 border-white/10'}`}
    >
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={() => onOpenWord(entry.word, {
            meaning: firstMeaning?.meaningVi || `${entry.level} · ${entry.pos}`,
            strictLookup: true,
            source: 'common',
            entry,
            detail,
            commonList: filteredCommonWords,
            commonIndex: index,
          })}
          className="min-w-0 flex-1 px-3 py-2.5 text-left hover:bg-white/10 active:scale-[0.98] transition rounded-l-xl"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="shrink-0 text-base leading-none" title={entry.language || 'english'}>{LANGUAGE_FLAG[entry.language || 'english']}</span>
            <span className="text-white text-sm font-medium">{entry.word}</span>
            {entry.ipa && <span className="shrink-0 text-white/35 font-mono text-[11px]">/{entry.ipa}/</span>}
            {isLearned && <span className="shrink-0 text-emerald-300 text-xs">✓</span>}
            {Number.isFinite(savedScore) && (
              <span className={`shrink-0 text-[10px] leading-none rounded px-1.5 py-1 border ${savedScore >= 85 ? 'text-emerald-200 border-emerald-400/30 bg-emerald-500/10' : savedScore >= 65 ? 'text-yellow-200 border-yellow-400/30 bg-yellow-500/10' : 'text-red-200 border-red-400/30 bg-red-500/10'}`}>
                {savedScore}%
              </span>
            )}
            <span className="ml-auto shrink-0 text-[10px] leading-none text-white/50 border border-white/10 rounded px-1.5 py-1">{entry.level}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-white/35 text-xs">
            <span>
              {firstMeaning?.meaningVi || entry.pos}
              {entry.categoryName ? ` · ${entry.categoryName}` : ''}
            </span>
            {showRefreshMeaningAction && (
              <>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(event) => {
                    event.stopPropagation()
                    onUpdateMeaning(entry.word, entry.pos, entry.language).catch(() => {})
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return
                    event.preventDefault()
                    event.stopPropagation()
                    onUpdateMeaning(entry.word, entry.pos, entry.language).catch(() => {})
                  }}
                  className={`inline-flex items-center gap-1 rounded-lg border px-1.5 py-0.5 text-[10px] font-semibold ${meaningUpdate?.loading ? 'border-white/10 bg-white/5 text-white/35' : 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200'}`}
                  aria-label={`Tự tìm và cập nhật dữ liệu cho ${entry.word}`}
                >
                  <Pencil size={10} />
                  {meaningUpdate?.loading ? 'Đang cập nhật' : 'Sửa nghĩa'}
                </span>
                {meaningUpdate?.error && <span className="text-red-200">{meaningUpdate.error}</span>}
                {meaningUpdate?.text && !meaningUpdate.loading && !meaningUpdate.error && <span className="text-emerald-200">Đã cập nhật theo {meaningUpdate.type || entry.pos}</span>}
              </>
            )}
          </div>
        </button>
        {hasDetails && (
          <button
            type="button"
            onClick={() => {
              onToggleDetail(entry.word, entry.language)
              if (!isExpanded && !listTranslation?.text && !listTranslation?.loading) {
                onTranslateInList(entry.word, entry.language)
              }
            }}
            className="w-12 shrink-0 border-l border-white/10 text-white/65 flex items-center justify-center rounded-r-xl hover:bg-white/10 active:scale-95 transition-transform"
            aria-label={isExpanded ? 'Thu gọn nghĩa và ví dụ' : 'Mở rộng nghĩa và ví dụ'}
          >
            {isExpanded ? <Minus size={18} /> : <Plus size={18} />}
          </button>
        )}
      </div>
      {isExpanded && hasDetails && (
        <div className="border-t border-white/10 px-3 py-2.5 flex flex-col gap-2">
          <div className="rounded-lg border border-cyan-400/20 bg-cyan-500/10 px-2.5 py-2">
            <div className="text-cyan-100/60 text-[10px] font-semibold uppercase tracking-wide">Google Translate</div>
            {listTranslation?.loading && <div className="text-cyan-100/70 text-sm mt-0.5">Translating...</div>}
            {listTranslation?.text && <div className="text-cyan-50 text-sm font-semibold leading-snug mt-0.5">Google Translate: {listTranslation.text}</div>}
            {listTranslation?.error && <div className="text-red-200 text-xs mt-0.5">{listTranslation.error}</div>}
          </div>
          {detail.meanings.map((item, itemIndex) => (
            <div key={`${entry.word}-${item.pos}-${itemIndex}`} className="min-w-0">
              {item.pos !== 'translate' && (
                <>
                  <div className="text-emerald-300 font-semibold text-sm capitalize leading-snug">{item.pos}</div>
                  <div className="text-white/85 text-sm leading-snug"><span className="text-emerald-300 font-semibold">Meaning:</span> {item.meaningVi}</div>
                  <div className="text-white/45 text-xs leading-snug mt-1"><span className="text-emerald-300 font-semibold">Example:</span> {item.exampleEn}</div>
                  <div className="text-white/35 text-xs leading-snug">{item.exampleVi}</div>
                </>
              )}
            </div>
          ))}
          {['family', 'synonyms', 'antonyms'].map(keyName => {
            const values = detail.relations?.[keyName] || []
            if (!values.length) return null
            return (
              <div key={keyName} className="border-t border-white/10 pt-2">
                <div className="text-emerald-300 font-semibold text-sm leading-snug capitalize">{keyName}</div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {values.map(value => (
                    <span key={value} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-white/70 text-xs">{value}</span>
                  ))}
                </div>
              </div>
            )
          })}
          {listStructures.length > 0 && (
            <div className="border-t border-white/10 pt-2">
              <div className="text-emerald-300 font-semibold text-sm leading-snug">Collocations & Structures:</div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {listStructures.map(pattern => (
                  <span key={pattern} className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-2 py-1 text-white/75 text-xs">{pattern}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
