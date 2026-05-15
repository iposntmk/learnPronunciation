import { PlusCircle } from 'lucide-react'
import { formatIpa } from '../../utils/phonemes/phonemeFormat.js'

export default function WordIpaPanel({
  compact,
  phonemes,
  hasUnverifiedIpa,
  phase,
  useGuessedIpaForScore,
  setUseGuessedIpaForScore,
  showIncorrectAction,
  isReportedIncorrect,
  toggleIncorrectReport,
  showTranslateAction,
  translateInApp,
  translation,
  dictionaryIpa,
  azureIpa,
  saveAzureIpaToDb,
  ipaSaveStatus,
  canSaveAzureIpa,
}) {
  return (
    <>
      <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
        <div className={`${compact ? 'text-2xl' : 'text-3xl'} text-cyan-100/90 font-mono font-semibold break-all leading-tight`}>/{phonemes.map(formatIpa).join('')}/</div>
        {hasUnverifiedIpa && phase === 'ready' && (
          <label className={`shrink-0 rounded-xl border px-2.5 py-1 flex items-center gap-1.5 text-xs font-semibold active:scale-95 ${useGuessedIpaForScore ? 'bg-amber-400/20 border-amber-300/50 text-amber-100' : 'bg-white/5 border-white/10 text-white/55'}`}>
            <input
              type="checkbox"
              checked={useGuessedIpaForScore}
              onChange={event => setUseGuessedIpaForScore(event.target.checked)}
              className="accent-amber-300"
            />
            Use this IPA for score
          </label>
        )}
        {showIncorrectAction && (
          <label className={`shrink-0 rounded-xl border px-2.5 py-1 flex items-center gap-1.5 text-xs font-semibold active:scale-95 ${isReportedIncorrect ? 'bg-red-500/20 border-red-400/40 text-red-200' : 'bg-white/5 border-white/10 text-white/55'}`}>
            <input
              type="checkbox"
              checked={isReportedIncorrect}
              onChange={toggleIncorrectReport}
              className="accent-red-400"
            />
            Incorrect
          </label>
        )}
        {showTranslateAction && (
          <button
            type="button"
            onClick={translateInApp}
            disabled={translation.loading}
            className="shrink-0 rounded-xl bg-cyan-500/15 border border-cyan-400/30 text-cyan-100 px-2.5 py-1 text-xs font-semibold active:scale-95"
          >
            {translation.loading ? 'Translating' : 'Translate'}
          </button>
        )}
      </div>

      {(dictionaryIpa || azureIpa) && (
        <div className="mt-2 mx-auto max-w-xl grid gap-1.5 text-sm text-left">
          {dictionaryIpa && (
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5">
              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-white/45">Dictionary</span>
              <span className="flex-1 font-mono text-cyan-100/90 break-all">/{dictionaryIpa}/</span>
            </div>
          )}
          {azureIpa && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-3 py-1.5">
              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-emerald-200/80">Azure</span>
              <span className="flex-1 font-mono text-emerald-100 break-all">/{azureIpa}/</span>
              <button
                type="button"
                onClick={saveAzureIpaToDb}
                disabled={ipaSaveStatus.loading || !canSaveAzureIpa}
                className={`shrink-0 inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-semibold transition-all ${ipaSaveStatus.savedIpa === azureIpa ? 'bg-emerald-400/30 border-emerald-300/50 text-emerald-50' : 'bg-blue-500/15 border-blue-400/30 text-blue-100 active:scale-95 disabled:opacity-50'}`}
                aria-label="Lưu IPA Azure vào cơ sở dữ liệu"
                title="Update this IPA to Supabase"
              >
                <PlusCircle size={10} />
                {ipaSaveStatus.loading ? 'Saving...' : ipaSaveStatus.savedIpa === azureIpa ? 'Saved' : 'Update to DB'}
              </button>
            </div>
          )}
          {ipaSaveStatus.error && (
            <div className="text-[11px] text-red-200">{ipaSaveStatus.error}</div>
          )}
        </div>
      )}

      {showTranslateAction && (translation.loading || translation.text || translation.error) && (
        <div className="mt-2 mx-auto max-w-xl rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-2.5 text-left">
          {translation.loading && <div className="text-cyan-100/70 text-sm">Translating...</div>}
          {translation.text && <div className="text-cyan-50 text-sm leading-snug"><span className="text-cyan-200/80 font-semibold">Google Translate:</span> {translation.text}</div>}
          {translation.error && <div className="text-red-200 text-sm mt-0.5">{translation.error}</div>}
        </div>
      )}
    </>
  )
}
