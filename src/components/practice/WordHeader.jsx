import { Pencil, PlusCircle, Volume2 } from 'lucide-react'
import ScoreCircle from '../common/ScoreCircle.jsx'
import { scoreColor, scoreLabel } from '../../utils/scoring/scoreUi.js'

export default function WordHeader({
  word,
  meaning,
  metaLine,
  compact,
  practiceLanguage,
  languageFlag,
  result,
  playModel,
  showRefreshMeaningAction,
  onRefreshMeaning,
  refreshMeaningFromWeb,
  meaningRefresh,
  source,
  saveWordToDb,
  saveStatus,
}) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button onClick={playModel} className={`${compact ? 'text-4xl' : 'text-5xl'} font-extrabold text-white hover:text-blue-300 transition-colors flex items-center gap-2 leading-tight`}>
          {word}
          {languageFlag && (
            <span className={compact ? 'text-2xl' : 'text-3xl'} title={practiceLanguage}>
              {languageFlag}
            </span>
          )}
          <Volume2 size={compact ? 24 : 28} className="text-white/55" />
        </button>
        {result && (
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-left">
            <ScoreCircle score={result.overall} size={compact ? 38 : 44} />
            <div className="min-w-0">
              <div className={`text-xs font-bold leading-tight ${scoreColor(result.overall)}`}>{scoreLabel(result.overall)}</div>
              <div className="max-w-28 truncate text-[10px] text-white/45">Heard: {result.spokenWord || '-'}</div>
            </div>
          </div>
        )}
      </div>

      {metaLine && <div className="text-[10px] text-white/40 mt-1">{metaLine}</div>}

      <div className="mt-0.5 flex flex-wrap items-center justify-center gap-1.5 text-[11px] text-white/60">
        <span>{meaning}</span>
        {showRefreshMeaningAction && onRefreshMeaning && (
          <button
            type="button"
            onClick={refreshMeaningFromWeb}
            disabled={meaningRefresh.loading}
            className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-200 disabled:opacity-50"
            aria-label="Tá»± tÃ¬m vÃ  cáº­p nháº­t dá»¯ liá»‡u tá»«"
          >
            <Pencil size={10} />
            {meaningRefresh.loading ? 'Äang cáº­p nháº­t' : 'Sá»­a nghÄ©a'}
          </button>
        )}
        {source === 'external' && (
          <button
            type="button"
            onClick={saveWordToDb}
            disabled={saveStatus.loading || saveStatus.saved}
            className={`inline-flex items-center gap-1 rounded-lg border px-1.5 py-0.5 text-[10px] font-semibold transition-all ${saveStatus.saved ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200' : 'bg-blue-500/10 border-blue-400/25 text-blue-200 active:scale-95 disabled:opacity-50'}`}
            aria-label="LÆ°u tá»« vÃ o tá»« Ä‘iá»ƒn cá»§a báº¡n"
          >
            <PlusCircle size={10} />
            {saveStatus.loading ? 'Äang lÆ°u...' : saveStatus.saved ? 'ÄÃ£ lÆ°u' : 'ThÃªm vÃ o tá»« Ä‘iá»ƒn'}
          </button>
        )}
      </div>

      {(meaningRefresh.text || meaningRefresh.error || saveStatus.error) && (
        <div className={`mt-1 text-[11px] ${meaningRefresh.error || saveStatus.error ? 'text-red-200' : 'text-emerald-200'}`}>
          {meaningRefresh.error || saveStatus.error || (meaningRefresh.text ? `ÄÃ£ cáº­p nháº­t: ${meaningRefresh.text}` : '')}
        </div>
      )}
    </>
  )
}
