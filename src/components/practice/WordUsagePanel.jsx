export default function WordUsagePanel({
  compact,
  word,
  usageMeanings,
  isUsageExpanded,
  setIsUsageExpanded,
  wordStructures,
  wordRelations,
}) {
  if (usageMeanings.length === 0) return null

  return (
    <button
      type="button"
      onClick={() => setIsUsageExpanded(prev => !prev)}
      className={`block w-full ${compact ? 'mt-1' : 'mt-3'} text-left bg-white/5 border border-white/10 rounded-xl overflow-hidden active:bg-white/10 transition-colors`}
      aria-expanded={isUsageExpanded}
    >
      <div className={`w-full ${compact ? 'px-2 py-1.5' : 'px-3 py-2.5'} flex items-center justify-between gap-2 active:bg-white/10 transition-colors`}>
        <span className="text-white/55 text-xs font-semibold uppercase tracking-wide">Usage</span>
        <span className="text-white/45 text-xs">{isUsageExpanded ? 'Close' : 'Expand'}</span>
      </div>
      {isUsageExpanded && (
        <div className={`${compact ? 'px-2 pb-1.5' : 'px-3 pb-2.5'} flex flex-col gap-1.5`}>
          {usageMeanings.map((item, idx) => (
            <div key={`${word}-${item.pos}-${idx}`} className="min-w-0 text-sm leading-snug border-b border-white/10 last:border-b-0 pb-1.5 last:pb-0">
              <div className="text-emerald-300 font-semibold capitalize">{item.pos}</div>
              <div><span className="text-emerald-300 font-semibold">Meaning:</span> <span className="text-white/85">{item.meaningVi}</span></div>
              <div className="mt-1"><span className="text-emerald-300 font-semibold">Example:</span> <span className="text-white/75">{item.exampleEn}</span></div>
              <div className="text-white/50">{item.exampleVi}</div>
            </div>
          ))}
          {wordStructures.length > 0 && (
            <div className="border-t border-white/10 pt-1.5 mt-1 text-sm leading-snug">
              <div className="text-emerald-300 font-semibold">Collocations & Structures:</div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {wordStructures.map(pattern => (
                  <span key={pattern} className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-2 py-1 text-white/75">{pattern}</span>
                ))}
              </div>
            </div>
          )}
          {(wordRelations.family.length > 0 || wordRelations.synonyms.length > 0 || wordRelations.antonyms.length > 0) && (
            <div className="border-t border-white/10 pt-1.5 mt-1 grid gap-1 text-sm leading-snug">
              {wordRelations.family.length > 0 && <div><span className="text-emerald-300 font-semibold">Word Family:</span> <span className="text-white/75">{wordRelations.family.join(', ')}</span></div>}
              {wordRelations.synonyms.length > 0 && <div><span className="text-emerald-300 font-semibold">Synonyms:</span> <span className="text-white/75">{wordRelations.synonyms.join(', ')}</span></div>}
              {wordRelations.antonyms.length > 0 && <div><span className="text-emerald-300 font-semibold">Antonyms:</span> <span className="text-white/75">{wordRelations.antonyms.join(', ')}</span></div>}
            </div>
          )}
        </div>
      )}
    </button>
  )
}
