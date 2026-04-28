import sys

with open('../src/App.jsx', 'r') as f:
    content = f.read()

# 1. Disable guessing in lookupWord
content = content.replace(
    "useState(() => prebuiltPhonemes || lookupWord(word, { allowGuess: !strictLookup }))",
    "useState(() => prebuiltPhonemes || lookupWord(word, { allowGuess: false }))"
)

# 2. Change default state for using fetched IPA to true
content = content.replace(
    "const [useGuessedIpaForScore, setUseGuessedIpaForScore] = useState(false)",
    "const [useGuessedIpaForScore, setUseGuessedIpaForScore] = useState(true)"
)

# 3. Ensure dictionaryIpa fetch logic is clean and update UI
# Find the section where word and IPA are displayed (around line 1450)
old_ipa_display = """              {phonemes.length > 0 ? (
                <div className="flex flex-wrap gap-2 mt-4">
                  {phonemes.map((p, idx) => (
                    <div key={idx} className="flex flex-col items-center">
                      <div className="text-white font-mono text-lg">/{p.ipa}/</div>
                      {p.lookupNote && <div className="text-[10px] text-white/40 mt-0.5">{p.lookupNote}</div>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 text-white/40 text-sm">No IPA available for this word.</div>
              )}"""

new_ipa_display = """              {/* IPA Display Logic */}
              <div className="mt-4 flex flex-col gap-3">
                {phonemes.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {phonemes.map((p, idx) => (
                      <div key={idx} className="flex flex-col items-start">
                        <div className="text-white font-mono text-xl">/{p.ipa}/</div>
                        {p.lookupNote && <div className="text-[10px] text-emerald-400 mt-0.5 font-medium">{p.lookupNote}</div>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Dictionary API IPA Fallback */}
                {dictionaryIpa && (
                  <div className="flex items-center gap-3 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3">
                    <div className="flex-1">
                      <div className="text-[10px] text-cyan-300/60 uppercase tracking-widest font-bold">Dictionary IPA</div>
                      <div className="text-cyan-100 font-mono text-lg">/{dictionaryIpa}/</div>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <span className="text-[11px] text-white/50 group-hover:text-white/80 transition-colors">Use for score</span>
                      <input
                        type="checkbox"
                        checked={useGuessedIpaForScore}
                        onChange={e => setUseGuessedIpaForScore(e.target.checked)}
                        className="w-5 h-5 rounded-lg accent-cyan-500"
                      />
                    </label>
                  </div>
                )}

                {!dictionaryIpa && phonemes.length === 0 && (
                  <div className="text-white/40 text-sm italic">Searching for IPA...</div>
                )}
              </div>"""

if old_ipa_display in content:
    content = content.replace(old_ipa_display, new_ipa_display)
else:
    print("Warning: Could not find exact old_ipa_display string for UI replacement.")

with open('../src/App.jsx', 'w') as f:
    f.write(content)
