import { ChevronLeft, Mic, Play, Square, Volume2 } from 'lucide-react'

export default function RecordingConsole({
  compact,
  phase,
  playModel,
  recordingUrl,
  playbackRecording,
  isPlayingBack,
  reset,
  resetAndRecord,
  source,
  onBack,
  startRecording,
  canScoreWord,
  isResolvingPhonemes,
  recordingDuration,
  countdown,
  stopRecording,
}) {
  return (
    <div className={`fixed left-1/2 bottom-[4.75rem] z-30 w-full max-w-sm -translate-x-1/2 px-4 pt-3 pb-3 flex flex-col ${compact ? 'gap-2' : 'gap-3'} rounded-t-[2rem] bg-gradient-to-t from-[#0f0f1a] via-[#0f0f1a]/95 to-transparent`}>
      {(phase === 'ready' || phase === 'recording') && (
        <button onClick={playModel} className={`w-full bg-blue-600/20 border border-blue-500/30 text-blue-300 rounded-2xl ${compact ? 'py-1.5 text-sm' : 'py-3'} flex items-center justify-center gap-2 active:scale-95 transition-transform`}>
          <Volume2 size={18} />
          Model Audio
        </button>
      )}

      {phase === 'scoring' && (
        <>
          {recordingUrl && (
            <button onClick={playbackRecording}
              className={`w-full rounded-2xl ${compact ? 'py-1.5 text-sm' : 'py-3'} flex items-center justify-center gap-2 active:scale-95 transition-transform border ${isPlayingBack ? 'bg-orange-500/20 border-orange-500/40 text-orange-300' : 'bg-green-600/20 border-green-500/30 text-green-300'}`}>
              {isPlayingBack ? <Square size={16} /> : <Play size={16} />}
              {isPlayingBack ? 'Stop Recording' : 'Your Recording'}
            </button>
          )}
          <div className="w-full rounded-2xl py-3 bg-white/5 border border-white/10 text-white/50 flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
            Analyzing pronunciation...
          </div>
          <button onClick={reset} className={`order-last w-full bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-2xl ${compact ? 'py-1.5 text-sm' : 'py-3'} flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg shadow-red-900/30`}>
            <Mic size={18} />
            Retry
          </button>
        </>
      )}

      {phase === 'result' && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={playModel} className={`w-full bg-blue-600/20 border border-blue-500/30 text-blue-300 rounded-2xl ${compact ? 'py-1.5 text-sm' : 'py-3'} flex items-center justify-center gap-2 active:scale-95 transition-transform`}>
              <Volume2 size={16} />
              Model Audio
            </button>
            <button onClick={playbackRecording} disabled={!recordingUrl}
              className={`w-full rounded-2xl ${compact ? 'py-1.5 text-sm' : 'py-3'} flex items-center justify-center gap-2 active:scale-95 transition-transform border disabled:opacity-40 ${isPlayingBack ? 'bg-orange-500/20 border-orange-500/40 text-orange-300' : 'bg-green-600/20 border-green-500/30 text-green-300'}`}>
              {isPlayingBack ? <Square size={16} /> : <Play size={16} />}
              {isPlayingBack ? 'Stop Recording' : 'Your Recording'}
            </button>
          </div>
          <button onClick={resetAndRecord} className={`order-last w-full bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-2xl ${compact ? 'py-1.5 text-sm' : 'py-3'} flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg shadow-red-900/30`}>
            <Mic size={18} />
            Retry
          </button>
          {source === 'sentence-word' && onBack && (
            <button
              type="button"
              onClick={onBack}
              className={`w-full rounded-2xl bg-emerald-500/20 border border-emerald-400/35 text-emerald-100 ${compact ? 'py-1.5 text-sm' : 'py-3'} flex items-center justify-center gap-2 font-bold active:scale-95 transition-transform`}
            >
              <ChevronLeft size={16} />
              Quay láº¡i cÃ¢u Ä‘ang há»c
            </button>
          )}
        </>
      )}

      {phase === 'ready' && (
        <button onClick={startRecording} disabled={!canScoreWord || isResolvingPhonemes}
          className={`order-last w-full rounded-2xl ${compact ? 'py-2 text-base' : 'py-6 text-xl'} flex items-center justify-center gap-3 font-bold transition-transform shadow-lg ${
            canScoreWord && !isResolvingPhonemes
              ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white active:scale-95 shadow-red-900/30'
              : 'bg-white/5 border border-white/10 text-white/25 cursor-not-allowed shadow-none'
          }`}>
          <Mic size={28} />
          {isResolvingPhonemes ? 'Resolving IPA...' : canScoreWord ? `Speak (${recordingDuration}s)` : 'Cannot score this word'}
        </button>
      )}
      {phase === 'recording' && (
        <button onClick={stopRecording}
          className={`order-last w-full bg-red-600/20 border-2 border-red-500/50 rounded-2xl ${compact ? 'py-2 text-base' : 'py-6'} flex items-center justify-center gap-3 text-red-400 active:scale-95 transition-transform`}>
          <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse" />
          <span className="font-bold text-xl">Speaking...</span>
          <span className="font-bold tabular-nums text-red-300 text-2xl">{countdown}s</span>
        </button>
      )}
    </div>
  )
}
