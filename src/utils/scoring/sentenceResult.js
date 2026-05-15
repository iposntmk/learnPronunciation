export function compactSentenceResultForSave(result) {
  if (!result) return result

  return {
    overall: result.overall,
    spokenText: result.spokenText,
    spokenWord: result.spokenWord,
    accuracyScore: result.accuracyScore,
    fluencyScore: result.fluencyScore,
    completenessScore: result.completenessScore,
    prosodyScore: result.prosodyScore,
    words: result.words || [],
    azureIpa: result.azureIpa || '',
    phonemes: (result.phonemes || []).slice(0, 80),
  }
}
