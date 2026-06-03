import { ChevronLeft, Mic, Play, Square, Volume2 } from 'lucide-react'
import { speakNeural, speakPhoneme } from '../../tts.js'
import { normalizeLanguage } from '../../supabaseData.js'
import { useSentencePronunciation } from '../../hooks/useSentencePronunciation.js'
import { cleanPracticeWord } from '../../utils/words/wordNormalize.js'
import { LANGUAGE_FLAG, LANGUAGE_LABEL, LANGUAGE_TO_AZURE } from '../../utils/constants/languages.js'
import { scoreBg, scoreColor, scoreTextBg } from '../../utils/scoring/scoreUi.js'
import ScoreCircle from '../common/ScoreCircle.jsx'

export default function PracticeSentenceScreen({ sentenceItem, onBack, onSaveResult, onPracticeWord, recordingDurationSetting }) {
  const sentenceLanguage = normalizeLanguage(sentenceItem?.language || 'english')
  const lang = LANGUAGE_TO_AZURE[sentenceLanguage] || 'en-US'
  const {
    audioRef,
    countdown,
    recordingUrl,
    isPlayingBack,
    phase,
    errorMsg,
    result,
    showPhonemeDetails,
    setShowPhonemeDetails,
    visiblePhonemeLimit,
    setVisiblePhonemeLimit,
    phonemeRows,
    visiblePhonemeRows,
    wordRows,
    startRecording,
    stopRecording,
    playbackRecording,
  } = useSentencePronunciation({
    sentenceText: sentenceItem.sentence,
    lang,
    recordingDuration: recordingDurationSetting,
    onSaveResult,
  })

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-[#0f0f1a] to-[#0f0f1a] pb-56">
      <audio ref={audioRef} className="hidden" />
      <div className="px-4 pt-6 pb-2 flex items-center gap-3">
        <button onClick={onBack} aria-label="Back" className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center text-white/70 hover:bg-white/10 transition-colors">
          <ChevronLeft size={20} />
        </button>
        <span className="text-white/50 text-sm">Sentence Practice</span>
      </div>

      <div className="px-4 pb-4">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-white text-2xl font-bold leading-snug">{sentenceItem.sentence}</div>
              <div className="text-white/55 mt-2 leading-snug">{sentenceItem.vietnamese_translation}</div>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                <span className="rounded-lg border border-cyan-400/20 bg-cyan-500/10 px-2 py-1 text-cyan-100">{LANGUAGE_FLAG[sentenceLanguage] || ''} {LANGUAGE_LABEL[sentenceLanguage] || sentenceLanguage}</span>
                {sentenceItem.topic && <span className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-white/60">{sentenceItem.topic}</span>}
                {sentenceItem.level && <span className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-2 py-1 text-emerald-200">{sentenceItem.level}</span>}
              </div>
            </div>
            {result && <ScoreCircle score={result.overall} size={52} />}
          </div>

          {phase === 'scoring' && <div className="mt-4 text-white/60 text-sm">Analyzing pronunciation...</div>}
          {errorMsg && <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-red-200 text-sm">{errorMsg}</div>}

          {result && (
            <>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                  <div className="text-white/45 text-[11px] uppercase tracking-wide">Overall</div>
                  <div className={`mt-1 text-2xl font-bold ${scoreColor(result.overall)}`}>{result.overall}%</div>
                </div>
                <div className="rounded-2xl border border-fuchsia-400/20 bg-fuchsia-500/10 px-3 py-3">
                  <div className="text-fuchsia-200/70 text-[11px] uppercase tracking-wide">Intonation</div>
                  <div className="mt-1 text-2xl font-bold text-fuchsia-100">{result.prosodyScore ?? 0}%</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                  <div className="text-white/45 text-[11px] uppercase tracking-wide">Accuracy</div>
                  <div className="mt-1 text-xl font-bold text-white">{result.accuracyScore ?? 0}%</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                  <div className="text-white/45 text-[11px] uppercase tracking-wide">Fluency</div>
                  <div className="mt-1 text-xl font-bold text-white">{result.fluencyScore ?? 0}%</div>
                </div>
              </div>

              {wordRows.length > 0 && (
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-white/45 text-[11px] uppercase tracking-wide">Word scores</div>
                    <div className="text-white/35 text-[11px]">tap tung tu</div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {wordRows.map((item, index) => {
                      const cleanWord = cleanPracticeWord(item.text)
                      return (
                        <button
                          key={`${item.text}-${index}`}
                          type="button"
                          onClick={() => cleanWord && onPracticeWord?.(cleanWord)}
                          disabled={!cleanWord}
                          className={`rounded-xl border px-2.5 py-2 text-left active:scale-95 disabled:opacity-40 ${scoreTextBg(item.score)}`}
                          title={cleanWord ? `Practice ${cleanWord}` : undefined}
                        >
                          <div className="font-semibold text-sm leading-tight">{item.text}</div>
                          <div className="mt-0.5 text-[11px] opacity-75">{Math.round(item.score ?? 0)}%</div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-white/45 text-[11px] uppercase tracking-wide">Heard</div>
                <div className="mt-1 text-white text-sm leading-snug">{result.spokenText || '-'}</div>
                {showPhonemeDetails && result.azureIpa && <div className="mt-2 text-cyan-100/90 text-xs font-mono leading-relaxed break-all">/{result.azureIpa}/</div>}
              </div>

              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setShowPhonemeDetails(value => !value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm font-semibold text-white/70 active:scale-[0.99]"
                >
                  {showPhonemeDetails ? 'Hide phoneme details' : `Show phoneme details (${phonemeRows.length})`}
                </button>
                {showPhonemeDetails && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {visiblePhonemeRows.map((item, index) => (
                      <button
                        key={`${item.ipa}-${index}`}
                        type="button"
                        onClick={() => speakPhoneme(item.word || item.ipa, item.ipa, lang)}
                        className={`rounded-xl border px-3 py-2 text-left ${scoreBg(item.score)} active:scale-95 transition-transform`}
                      >
                        <div className="text-white/45 text-[10px] uppercase tracking-wide">{item.word || 'phoneme'}</div>
                        <div className="text-white font-mono text-sm">/{item.isStressed ? 'ˆ' : ''}{item.ipa}/</div>
                        <div className={`text-xs font-bold mt-1 ${scoreColor(item.score)}`}>{item.score}%</div>
                      </button>
                    ))}
                    {visiblePhonemeRows.length < phonemeRows.length && (
                      <button
                        type="button"
                        onClick={() => setVisiblePhonemeLimit(limit => limit + 48)}
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/60 active:scale-95"
                      >
                        Show more
                      </button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="fixed left-1/2 bottom-[4.75rem] z-30 w-full max-w-md -translate-x-1/2 px-4 pt-3 pb-3 flex flex-col gap-3 rounded-t-[2rem] bg-gradient-to-t from-[#0f0f1a] via-[#0f0f1a]/95 to-transparent">
        {(phase === 'ready' || phase === 'recording') && (
          <button onClick={() => speakNeural(sentenceItem.sentence, lang)} className="w-full bg-blue-600/20 border border-blue-500/30 text-blue-300 rounded-2xl py-3 flex items-center justify-center gap-2 active:scale-95 transition-transform">
            <Volume2 size={18} />
            Model Audio
          </button>
        )}

        {phase === 'scoring' && (
          <>
            {recordingUrl && (
              <button onClick={playbackRecording}
                className={`w-full rounded-2xl py-3 flex items-center justify-center gap-2 active:scale-95 transition-transform border ${isPlayingBack ? 'bg-orange-500/20 border-orange-500/40 text-orange-300' : 'bg-green-600/20 border-green-500/30 text-green-300'}`}>
                {isPlayingBack ? <Square size={16} /> : <Play size={16} />}
                {isPlayingBack ? 'Stop Recording' : 'Your Recording'}
              </button>
            )}
            <div className="w-full rounded-2xl py-3 bg-white/5 border border-white/10 text-white/50 flex items-center justify-center gap-2">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
              Analyzing pronunciation...
            </div>
          </>
        )}

        {phase === 'result' && (
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => speakNeural(sentenceItem.sentence, lang)} className="w-full bg-blue-600/20 border border-blue-500/30 text-blue-300 rounded-2xl py-3 flex items-center justify-center gap-2 active:scale-95 transition-transform">
              <Volume2 size={16} />
              Model Audio
            </button>
            <button onClick={playbackRecording} disabled={!recordingUrl}
              className={`w-full rounded-2xl py-3 flex items-center justify-center gap-2 active:scale-95 transition-transform border disabled:opacity-40 ${isPlayingBack ? 'bg-orange-500/20 border-orange-500/40 text-orange-300' : 'bg-green-600/20 border-green-500/30 text-green-300'}`}>
              {isPlayingBack ? <Square size={16} /> : <Play size={16} />}
              {isPlayingBack ? 'Stop Recording' : 'Your Recording'}
            </button>
          </div>
        )}

        {(phase === 'ready' || phase === 'result') && (
          <button onClick={startRecording}
            className="order-last w-full rounded-2xl py-6 text-xl flex items-center justify-center gap-3 font-bold transition-transform shadow-lg bg-gradient-to-r from-red-600 to-rose-600 text-white active:scale-95 shadow-red-900/30">
            <Mic size={28} />
            {result ? 'Record again' : `Speak (${recordingDurationSetting}s)`}
          </button>
        )}
        {phase === 'recording' && (
          <button onClick={stopRecording}
            className="order-last w-full bg-red-600/20 border-2 border-red-500/50 rounded-2xl py-6 flex items-center justify-center gap-3 text-red-400 active:scale-95 transition-transform">
            <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse" />
            <span className="font-bold text-xl">Speaking...</span>
            <span className="font-bold tabular-nums text-red-300 text-2xl">{countdown}s</span>
          </button>
        )}
      </div>
    </div>
  )
}
