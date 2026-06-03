function clampScore(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return null
  return Math.round(Math.max(0, Math.min(100, number)))
}

function firstScore(...values) {
  for (const value of values) {
    const score = clampScore(value)
    if (score != null) return score
  }
  return null
}

function seconds(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number / 10_000_000 : null
}

function assessmentOf(node) {
  return node?.PronunciationAssessment || {}
}

function splitPhoneme(value) {
  const raw = String(value || '').trim()
  const stressMark = raw.startsWith('ˈ') ? 'ˈ' : raw.startsWith('ˌ') ? 'ˌ' : ''
  return { ipa: raw.replace(/^[ˈˌ]/u, '') || raw, stressMark }
}

function azurePhonemes(words = [], overallScore = 0) {
  return words.flatMap(word => (word?.Phonemes || []).map((phoneme, index) => {
    const score = firstScore(phoneme?.AccuracyScore, assessmentOf(phoneme).AccuracyScore, overallScore) ?? 0
    const { ipa, stressMark } = splitPhoneme(phoneme?.Phoneme)
    return {
      index,
      ipa,
      stressMark,
      isStressed: stressMark === 'ˈ',
      score,
      audioOffset: seconds(phoneme?.Offset),
      audioDuration: seconds(phoneme?.Duration),
      word: word?.Word || '',
    }
  })).filter(item => item.ipa)
}

export function normalizeWordResult(nbest, targetPhonemes = []) {
  const pa = assessmentOf(nbest)
  const spokenWord = (nbest?.Lexical || nbest?.Display || '').trim().toLowerCase().replace(/[.,!?]/g, '')
  const overallScore = firstScore(nbest?.PronScore, pa.PronScore, nbest?.AccuracyScore, pa.AccuracyScore) ?? 0
  const sourcePhonemes = azurePhonemes(nbest?.Words || [], overallScore)
  const scored = targetPhonemes.length
    ? targetPhonemes.map((target, index) => {
        const match = sourcePhonemes[index]
        const score = firstScore(match?.score, overallScore) ?? 0
        const label = target.ipa || target.text || match?.ipa || ''
        return {
          ...target,
          score,
          audioOffset: match?.audioOffset ?? null,
          audioDuration: match?.audioDuration ?? null,
          note: score < 60 ? `Âm /${label}/ cần luyện thêm` : null,
        }
      })
    : sourcePhonemes.map(item => ({
        text: item.word || item.ipa,
        ipa: item.ipa,
        isStressed: item.isStressed,
        score: item.score,
        audioOffset: item.audioOffset,
        audioDuration: item.audioDuration,
        note: item.score < 60 ? `Âm /${item.ipa}/ cần luyện thêm` : null,
      }))
  const overall = scored.length
    ? Math.round(scored.reduce((sum, item) => sum + (item.score || 0), 0) / scored.length)
    : overallScore
  return {
    phonemes: scored,
    overall,
    spokenWord,
    stress: null,
    prosodyScore: firstScore(nbest?.ProsodyScore, pa.ProsodyScore),
    azureIpa: sourcePhonemes.map(item => `${item.stressMark || ''}${item.ipa}`).join(''),
  }
}

export function normalizeSentenceResult(nbest) {
  const pa = assessmentOf(nbest)
  const overallScore = firstScore(nbest?.PronScore, pa.PronScore, nbest?.AccuracyScore, pa.AccuracyScore) ?? 0
  const accuracyScore = firstScore(nbest?.AccuracyScore, pa.AccuracyScore, overallScore) ?? overallScore
  const fluencyScore = firstScore(nbest?.FluencyScore, pa.FluencyScore) ?? 0
  const completenessScore = firstScore(nbest?.CompletenessScore, pa.CompletenessScore) ?? 0
  const prosodyScore = firstScore(nbest?.ProsodyScore, pa.ProsodyScore) ?? 0
  const words = (nbest?.Words || []).map((word, index) => {
    const wordAssessment = assessmentOf(word)
    const phonemeScores = (word?.Phonemes || [])
      .map(item => firstScore(item?.AccuracyScore, assessmentOf(item).AccuracyScore))
      .filter(Number.isFinite)
    const score = firstScore(
      word?.AccuracyScore,
      wordAssessment.AccuracyScore,
      phonemeScores.length ? phonemeScores.reduce((sum, item) => sum + item, 0) / phonemeScores.length : null,
      overallScore,
    ) ?? overallScore
    return {
      index,
      text: word?.Word || '',
      score,
      errorType: word?.ErrorType || wordAssessment.ErrorType || null,
      audioOffset: seconds(word?.Offset),
      audioDuration: seconds(word?.Duration),
      phonemeCount: word?.Phonemes?.length || 0,
    }
  }).filter(item => item.text)
  const phonemes = azurePhonemes(nbest?.Words || [], overallScore).map((item, index) => ({
    index,
    text: item.word || item.ipa,
    ipa: item.ipa,
    isStressed: item.isStressed,
    score: item.score,
    audioOffset: item.audioOffset,
    audioDuration: item.audioDuration,
    note: item.score < 60 ? `Âm /${item.ipa}/ cần luyện thêm` : null,
    word: item.word,
    stressMark: item.stressMark,
  }))
  return {
    phonemes,
    overall: overallScore,
    spokenText: (nbest?.Display || nbest?.Lexical || '').trim(),
    spokenWord: (nbest?.Display || nbest?.Lexical || '').trim(),
    accuracyScore,
    fluencyScore,
    completenessScore,
    prosodyScore,
    prosodyDetail: { score: prosodyScore, raw: nbest?.ProsodyAssessment || pa.ProsodyAssessment || null },
    words,
    azureIpa: phonemes.map(item => `${item.stressMark || ''}${item.ipa}`).join(' '),
  }
}
