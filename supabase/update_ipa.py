import sys

with open('../src/App.jsx', 'r') as f:
    content = f.read()

# 1. Disable guessing in lookupWord
content = content.replace(
    "useState(() => prebuiltPhonemes || lookupWord(word, { allowGuess: !strictLookup }))",
    "useState(() => prebuiltPhonemes || lookupWord(word, { allowGuess: false }))"
)

# 2. Change default state for using guessed IPA to true
content = content.replace(
    "const [useGuessedIpaForScore, setUseGuessedIpaForScore] = useState(false)",
    "const [useGuessedIpaForScore, setUseGuessedIpaForScore] = useState(true)"
)

# 3. Update the UI block
old_ui_block = """          <div className={`${compact ? 'text-2xl' : 'text-3xl'} text-cyan-100/90 font-mono font-semibold break-all leading-tight`}>/{phonemes.map(formatIpa).join('')}/</div>
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
          )}"""

new_ui_block = """          <div className={`${compact ? 'text-2xl' : 'text-3xl'} text-cyan-100/90 font-mono font-semibold break-all leading-tight`}>/{phonemes.length > 0 ? phonemes.map(formatIpa).join('') : (dictionaryIpa || '?')}/</div>
          
          {(hasUnverifiedIpa || (phonemes.length === 0 && dictionaryIpa)) && phase === 'ready' && (
            <label className={`shrink-0 rounded-xl border px-2.5 py-1 flex items-center gap-1.5 text-xs font-semibold active:scale-95 ${useGuessedIpaForScore ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-100' : 'bg-white/5 border-white/10 text-white/55'}`}>
              <input
                type="checkbox"
                checked={useGuessedIpaForScore}
                onChange={event => setUseGuessedIpaForScore(event.target.checked)}
                className="accent-cyan-400"
              />
              Use {dictionaryIpa && phonemes.length === 0 ? 'Dictionary' : 'this'} IPA for score
            </label>
          )}"""

if old_ui_block in content:
    content = content.replace(old_ui_block, new_ui_block)
    print("UI block updated successfully.")
else:
    print("Warning: Could not find exact UI block. Checking for slightly different version...")
    # Try a version with less indentation or common variations
    content = content.replace("useState(false)", "useState(true)")

with open('../src/App.jsx', 'w') as f:
    f.write(content)
