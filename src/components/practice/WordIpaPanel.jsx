import { PlusCircle, Volume2 } from 'lucide-react'
import { formatIpa } from '../../utils/phonemes/phonemeFormat.js'

function playAudioUrl(url) {
  if (!url) return
  try { new Audio(url).play().catch(() => {}) } catch { /* ignore */ }
}

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
  dictionaryIpas = [],
  dictDefVi = {},
  azureIpa,
  saveAzureIpaToDb,
  ipaSaveStatus,
  canSaveAzureIpa,
  speechSuperIpa = '',
  saveSpeechSuperIpaToDb,
  ssIpaSaveStatus = { loading: false, error: null, savedIpa: '' },
  canSaveSpeechSuperIpa = false,
}) {
  const hasIpa = phonemes.some(p => p.ipa && p.ipa !== '?')
  return (
    <>
      <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
        {hasIpa && <div className={`${compact ? 'text-2xl' : 'text-3xl'} text-cyan-100/90 font-mono font-semibold break-all leading-tight`}>/{phonemes.map(formatIpa).join('')}/</div>}
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

      {(dictionaryIpas.length > 0 || azureIpa || speechSuperIpa) && (
        <div className="mt-2 mx-auto max-w-xl grid gap-1.5 text-sm text-left">
          {dictionaryIpas.map((group, gi) => (
            <div key={gi} className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5">
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-white/45">{group.label || 'Dictionary'}</span>
              </div>
              <div className="mt-1 grid gap-1">
                {group.ipas.map((item, ii) => (
                  <div key={ii} className="flex items-center gap-2">
                    {item.accent && <span className="shrink-0 text-[10px] font-semibold text-emerald-300/70 w-6">{item.accent}</span>}
                    <span className="flex-1 font-mono text-cyan-100/90 break-all">/{item.ipa}/</span>
                    {item.audio && (
                      <button
                        type="button"
                        onClick={() => playAudioUrl(item.audio)}
                        className="shrink-0 inline-flex items-center justify-center rounded-lg border border-cyan-400/30 bg-cyan-500/15 text-cyan-100 p-1.5 active:scale-95"
                        aria-label={`Phát âm ${item.accent || group.label}`}
                      >
                        <Volume2 size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {(dictDefVi[gi] || group.definitionEn) && (
                <div className="mt-1 text-[11px] leading-snug text-white/60">
                  {dictDefVi[gi] || group.definitionEn}
                </div>
              )}
            </div>
          ))}
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
          {speechSuperIpa && (
            <div className="flex items-center gap-2 rounded-xl border border-violet-400/25 bg-violet-500/10 px-3 py-1.5">
              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-violet-200/80">SpeechSuper</span>
              <span className="flex-1 font-mono text-violet-100 break-all">/{speechSuperIpa}/</span>
              <button
                type="button"
                onClick={saveSpeechSuperIpaToDb}
                disabled={ssIpaSaveStatus.loading || !canSaveSpeechSuperIpa}
                className={`shrink-0 inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-semibold transition-all ${ssIpaSaveStatus.savedIpa === speechSuperIpa ? 'bg-violet-400/30 border-violet-300/50 text-violet-50' : 'bg-blue-500/15 border-blue-400/30 text-blue-100 active:scale-95 disabled:opacity-50'}`}
                aria-label="Lưu IPA SpeechSuper vào cơ sở dữ liệu"
                title="Update this IPA to Supabase"
              >
                <PlusCircle size={10} />
                {ssIpaSaveStatus.loading ? 'Saving...' : ssIpaSaveStatus.savedIpa === speechSuperIpa ? 'Saved' : 'Update to DB'}
              </button>
            </div>
          )}
          {ssIpaSaveStatus.error && (
            <div className="text-[11px] text-red-200">{ssIpaSaveStatus.error}</div>
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
