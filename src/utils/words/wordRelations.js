function uniqueList(items) {
  const seen = new Set()
  return items
    .map(item => String(item || '').trim())
    .filter(item => {
      const key = item.toLowerCase()
      if (!item || seen.has(key)) return false
      seen.add(key)
      return true
    })
}

export function deriveRootWord(word) {
  const value = String(word || '').trim().toLowerCase()
  if (!value || value.includes(' ')) return ''
  const rules = [
    [/ies$/, 'y'],
    [/ied$/, 'y'],
    [/ing$/, ''],
    [/ed$/, ''],
    [/ly$/, ''],
    [/es$/, ''],
    [/s$/, ''],
  ]
  for (const [pattern, replacement] of rules) {
    if (!pattern.test(value)) continue
    const root = value.replace(pattern, replacement)
    if (root.length >= 3 && root !== value) return root
  }
  return ''
}

const WORD_RELATION_OVERRIDES = {
  good: { family: ['goodness'], synonyms: ['great', 'fine', 'excellent'], antonyms: ['bad', 'poor'] },
  bad: { family: ['badly'], synonyms: ['poor', 'wrong'], antonyms: ['good', 'excellent'] },
  happy: { family: ['happiness', 'happily'], synonyms: ['glad', 'pleased'], antonyms: ['sad', 'unhappy'] },
  sad: { family: ['sadness', 'sadly'], synonyms: ['unhappy', 'upset'], antonyms: ['happy', 'glad'] },
  fast: { family: ['faster', 'fastest'], synonyms: ['quick', 'rapid'], antonyms: ['slow'] },
  slow: { family: ['slowly', 'slower'], synonyms: ['gradual'], antonyms: ['fast', 'quick'] },
  easy: { family: ['easily'], synonyms: ['simple'], antonyms: ['difficult', 'hard'] },
  difficult: { family: ['difficulty'], synonyms: ['hard', 'challenging'], antonyms: ['easy', 'simple'] },
  big: { family: ['bigger', 'biggest'], synonyms: ['large', 'great'], antonyms: ['small', 'little'] },
  small: { family: ['smaller', 'smallest'], synonyms: ['little', 'tiny'], antonyms: ['big', 'large'] },
  hot: { family: ['heat', 'heated'], synonyms: ['warm'], antonyms: ['cold', 'cool'] },
  cold: { family: ['coldly'], synonyms: ['cool', 'chilly'], antonyms: ['hot', 'warm'] },
  clear: { family: ['clearly', 'clarity'], synonyms: ['obvious', 'clean'], antonyms: ['unclear', 'confusing'] },
  speak: { family: ['speaker', 'speaking', 'speech'], synonyms: ['say', 'talk'], antonyms: ['listen', 'silence'] },
  learn: { family: ['learner', 'learning', 'learned'], synonyms: ['study', 'practice'], antonyms: ['forget'] },
  correct: { family: ['correction', 'correctly'], synonyms: ['right', 'accurate'], antonyms: ['wrong', 'incorrect'] },
  wrong: { family: ['wrongly'], synonyms: ['incorrect'], antonyms: ['right', 'correct'] },
  start: { family: ['starter', 'starting'], synonyms: ['begin'], antonyms: ['finish', 'end'] },
  finish: { family: ['finished'], synonyms: ['end', 'complete'], antonyms: ['start', 'begin'] },
}

const WORD_STRUCTURE_OVERRIDES = {
  access: [
    'access to sth',
    'have/get/gain access to sth',
    'provide/give access to sth',
    'access a file/database/system/account',
  ],
  suppose: [
    'be supposed to do sth',
    'suppose that + clause',
    'I suppose so / I suppose not',
  ],
  supposed: [
    'be supposed to do sth',
    'be supposed to be + adj/noun',
    'not be supposed to do sth',
  ],
  speak: [
    'speak to sb',
    'speak with sb',
    'speak about sth',
    'speak English clearly',
  ],
  listen: [
    'listen to sb/sth',
    'listen for sth',
    'listen carefully',
  ],
  look: [
    'look at sb/sth',
    'look for sb/sth',
    'look like sb/sth',
  ],
  depend: [
    'depend on sb/sth',
    'depend on sb to do sth',
  ],
  interested: [
    'be interested in sth',
    'be interested in doing sth',
  ],
  good: [
    'be good at sth/doing sth',
    'be good for sb/sth',
    'be good to sb',
  ],
  afraid: [
    'be afraid of sb/sth',
    'be afraid to do sth',
    'be afraid that + clause',
  ],
}

function baseWordForms(word) {
  const key = word.toLowerCase().trim()
  const forms = new Set([key])
  if (key.endsWith('ing') && key.length > 5) forms.add(key.slice(0, -3))
  if (key.endsWith('ed') && key.length > 4) forms.add(key.slice(0, -2))
  if (key.endsWith('ly') && key.length > 4) forms.add(key.slice(0, -2))
  if (key.endsWith('ness') && key.length > 6) forms.add(key.slice(0, -4))
  if (key.endsWith('s') && key.length > 3) forms.add(key.slice(0, -1))
  return [...forms]
}

export function buildWordRelations(word, detail = null) {
  const key = word.toLowerCase().trim()
  const override = WORD_RELATION_OVERRIDES[key] || {}
  const detailRelations = detail?.relations || {}

  const explicitRoot = String(detailRelations.rootWord || '').trim().toLowerCase()
  const derivedRoot = explicitRoot || deriveRootWord(key)
  const rootWord = derivedRoot && derivedRoot !== key ? derivedRoot : ''

  return {
    rootWord,
    family: uniqueList([...(detailRelations.family || []), ...(override.family || [])]).slice(0, 8),
    synonyms: uniqueList([...(detailRelations.synonyms || []), ...(override.synonyms || [])]).slice(0, 8),
    antonyms: uniqueList([...(detailRelations.antonyms || []), ...(override.antonyms || [])]).slice(0, 8),
  }
}

export function buildWordStructures(word) {
  const key = word.toLowerCase().trim()
  const forms = baseWordForms(key)
  return uniqueList(forms.flatMap(form => WORD_STRUCTURE_OVERRIDES[form] || [])).slice(0, 6)
}
