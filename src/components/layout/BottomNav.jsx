import { BookOpen, Home, Library, Mic, Settings, Shield } from 'lucide-react'

export default function BottomNav({
  screen,
  onNavigate,
  settingsOpen,
  onSettingsOpenChange,
  recordingDurationSetting,
  onRecordingDurationChange,
  sentenceRecordingDurationSetting,
  onSentenceRecordingDurationChange,
  practiceSettings,
  onPracticeSettingsChange,
  canAdmin = false,
}) {
  const items = [
    { label: 'Home', icon: Home, target: 'library', active: screen === 'library' },
    { label: 'Library', icon: Library, target: 'library', active: ['soundDetail', 'practiceWord'].includes(screen) },
    { label: 'Sentences', icon: Mic, target: 'sentences', active: ['sentences', 'practiceSentence'].includes(screen) },
    { label: 'Dictionary', icon: BookOpen, target: 'dictionary', active: screen === 'dictionary' },
  ]

  if (canAdmin) items.push({ label: 'Admin', icon: Shield, target: 'admin', active: screen === 'admin' })

  const settingItems = [
    ['readNewWordAloud', 'Read aloud when a new word appears'],
    ['unlearnedNavOnly', 'Next/Back only unlearned words'],
    ['autoTranslateOnLoad', 'Automatically translate new words'],
    ['autoExpandUsage', 'Automatically expand usage'],
    ['showRefreshMeaningAction', 'Show "Sửa nghĩa" in practice/dictionary'],
    ['showIncorrectAction', 'Show "Incorrect" on practice screen'],
    ['showTranslateAction', 'Show "Translate" on practice screen'],
    ['showDictionarySubtitle', 'Show dictionary search block'],
  ]

  const changePracticeSetting = (key, value) => {
    onPracticeSettingsChange({ ...practiceSettings, [key]: value })
  }

  return (
    <>
      {settingsOpen && (
        <div className="fixed left-3 right-3 bottom-20 z-50 max-w-md mx-auto max-h-[calc(100dvh-6.5rem)] rounded-2xl border border-gray-200 bg-white shadow-2xl p-3 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-gray-200">
            <div>
              <div className="text-gray-950 text-sm font-semibold">Settings</div>
              <div className="text-gray-500 text-xs">Practice behavior</div>
            </div>
            <button
              type="button"
              onClick={() => onSettingsOpenChange(false)}
              className="w-9 h-9 rounded-xl bg-gray-100 border border-gray-200 text-gray-500 hover:text-gray-950 hover:bg-gray-200 transition-colors"
              aria-label="Close settings"
            >
              x
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
            <div className="flex items-center justify-between gap-3 py-3">
              <div>
                <div className="text-gray-900 text-sm font-medium">Recording Duration</div>
                <div className="text-gray-500 text-xs">Speak timer length</div>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => onRecordingDurationChange(recordingDurationSetting - 1)} className="w-9 h-9 rounded-xl bg-gray-100 border border-gray-200 text-gray-700 text-lg font-bold flex items-center justify-center active:scale-90" aria-label="Decrease recording duration">&minus;</button>
                <span className="text-gray-900 text-sm w-10 text-center">{recordingDurationSetting}s</span>
                <button type="button" onClick={() => onRecordingDurationChange(recordingDurationSetting + 1)} className="w-9 h-9 rounded-xl bg-gray-100 border border-gray-200 text-gray-700 text-lg font-bold flex items-center justify-center active:scale-90" aria-label="Increase recording duration">+</button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 py-3 border-t border-gray-100">
              <div>
                <div className="text-gray-900 text-sm font-medium">Sentence Duration</div>
                <div className="text-gray-500 text-xs">Sentence practice timer</div>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => onSentenceRecordingDurationChange(sentenceRecordingDurationSetting - 1)} className="w-9 h-9 rounded-xl bg-gray-100 border border-gray-200 text-gray-700 text-lg font-bold flex items-center justify-center active:scale-90" aria-label="Decrease sentence recording duration">&minus;</button>
                <span className="text-gray-900 text-sm w-10 text-center">{sentenceRecordingDurationSetting}s</span>
                <button type="button" onClick={() => onSentenceRecordingDurationChange(sentenceRecordingDurationSetting + 1)} className="w-9 h-9 rounded-xl bg-gray-100 border border-gray-200 text-gray-700 text-lg font-bold flex items-center justify-center active:scale-90" aria-label="Increase sentence recording duration">+</button>
              </div>
            </div>

            <div className="grid gap-2 pb-1">
              {settingItems.map(([key, label]) => (
                <label key={key} className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 border border-gray-200 px-3 py-2.5 text-gray-700 text-xs">
                  <span className="leading-snug">{label}</span>
                  <input type="checkbox" checked={Boolean(practiceSettings[key])} onChange={e => changePracticeSetting(key, e.target.checked)} className="h-4 w-4 shrink-0 accent-emerald-400" />
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur border-t border-white/10 flex z-40">
        {items.map(({ label, icon: Icon, target, active }) => (
          <button key={label} onClick={() => onNavigate(target)} className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${active ? 'text-white' : 'text-white/30 hover:text-white/60'}`}>
            <Icon size={22} strokeWidth={active ? 2.5 : 1.5} />
            <span className="text-xs">{label}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => onSettingsOpenChange(!settingsOpen)}
          className={`w-16 shrink-0 flex flex-col items-center gap-1 py-3 border-l border-white/10 transition-colors ${settingsOpen ? 'text-white bg-white/10' : 'text-white/35 hover:text-white/60'}`}
          aria-label="Settings"
        >
          <Settings size={22} strokeWidth={settingsOpen ? 2.5 : 1.5} />
          <span className="text-xs">Settings</span>
        </button>
      </div>
    </>
  )
}
