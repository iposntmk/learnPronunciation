import { AutoProcessor, AutoModelForCTC, env } from '@huggingface/transformers'

env.allowLocalModels = false
env.useBrowserCache = true

const MODEL_ID = 'Xenova/wav2vec2-base-960h'

const VOCAB_ARR = ['<pad>','<unk>','|','E','T','A','O','I','N','S','R','H','L','D','C','U','M','F','P','G','W','Y','B','V','K','X','J','Q','Z']
const VOCAB = Object.fromEntries(VOCAB_ARR.map((c, i) => [c, i]))

let _processor = null
let _model = null
let _loadPromise = null

export function isModelReady() {
  return _processor !== null && _model !== null
}

export async function ensureModelLoaded(onProgress) {
  if (isModelReady()) return
  if (!_loadPromise) {
    _loadPromise = (async () => {
      const opts = onProgress ? { progress_callback: onProgress } : {}
      _processor = await AutoProcessor.from_pretrained(MODEL_ID, opts)
      _model = await AutoModelForCTC.from_pretrained(MODEL_ID, opts)
    })().catch(e => { _loadPromise = null; throw e })
  }
  return _loadPromise
}

async function decodeAudioTo16kHz(blob) {
  const buf = await blob.arrayBuffer()
  const ctx = new AudioContext()
  const decoded = await ctx.decodeAudioData(buf)
  ctx.close()

  if (decoded.sampleRate === 16000) return decoded.getChannelData(0)

  const frames = Math.ceil(decoded.length / decoded.sampleRate * 16000)
  const offCtx = new OfflineAudioContext(1, frames, 16000)
  const src = offCtx.createBufferSource()
  src.buffer = decoded
  src.connect(offCtx.destination)
  src.start()
  const resampled = await offCtx.startRendering()
  return resampled.getChannelData(0)
}

function buildCharMap(phonemes) {
  const result = []
  for (let pi = 0; pi < phonemes.length; pi++) {
    for (const c of phonemes[pi].text.toUpperCase()) {
      if (c >= 'A' && c <= 'Z') result.push({ pi, id: VOCAB[c] ?? VOCAB['<unk>'] })
    }
  }
  return result
}

function logSoftmax(data, T, V) {
  const out = new Float32Array(T * V)
  for (let t = 0; t < T; t++) {
    const off = t * V
    let mx = -Infinity
    for (let v = 0; v < V; v++) if (data[off + v] > mx) mx = data[off + v]
    let sum = 0
    for (let v = 0; v < V; v++) sum += Math.exp(data[off + v] - mx)
    const logSum = mx + Math.log(sum)
    for (let v = 0; v < V; v++) out[off + v] = data[off + v] - logSum
  }
  return out
}

// Viterbi CTC forced alignment. Returns state-index sequence length T.
// Odd states 2i+1 correspond to targets[i]; even states = blank.
function ctcForcedAlign(lp, targets, T, V, blank = 0) {
  const N = targets.length
  if (N === 0) return new Int16Array(T)

  const ext = new Int32Array(2 * N + 1)
  for (let i = 0; i <= N; i++) ext[2 * i] = blank
  for (let i = 0; i < N; i++) ext[2 * i + 1] = targets[i]
  const S = ext.length
  const NEG = -1e30

  let alpha = new Float64Array(S).fill(NEG)
  const bp = new Int16Array(T * S).fill(-1)
  const get = (t, v) => lp[t * V + v]

  alpha[0] = get(0, blank)
  if (S > 1) alpha[1] = get(0, ext[1])

  for (let t = 1; t < T; t++) {
    const prev = alpha.slice()
    alpha.fill(NEG)
    const base = t * S
    for (let s = 0; s < S; s++) {
      let best = prev[s], from = s
      if (s > 0 && prev[s - 1] > best) { best = prev[s - 1]; from = s - 1 }
      if (s > 1 && ext[s] !== blank && ext[s] !== ext[s - 2] && prev[s - 2] > best) {
        best = prev[s - 2]; from = s - 2
      }
      if (best > NEG) { alpha[s] = best + get(t, ext[s]); bp[base + s] = from }
    }
  }

  let s = S < 2 ? 0 : (alpha[S - 1] >= alpha[S - 2] ? S - 1 : S - 2)
  const seq = new Int16Array(T)
  seq[T - 1] = s
  for (let t = T - 1; t > 0; t--) {
    const from = bp[t * S + s]
    if (from >= 0) s = from
    seq[t - 1] = s
  }
  return seq
}

// Greedy CTC decode → recognized lowercase text
function greedyCTCDecode(lp, T, V) {
  let prev = 0
  const chars = []
  for (let t = 0; t < T; t++) {
    const off = t * V
    let maxV = 0, maxLp = lp[off]
    for (let v = 1; v < V; v++) {
      if (lp[off + v] > maxLp) { maxLp = lp[off + v]; maxV = v }
    }
    if (maxV !== 0 && maxV !== prev) {
      const c = VOCAB_ARR[maxV]
      if (c && c !== '|' && c !== '<unk>') chars.push(c)
    }
    prev = maxV
  }
  return chars.join('').toLowerCase()
}

async function scoreWordOffline(audioBlob, phonemes) {
  await ensureModelLoaded()

  const pcm = await decodeAudioTo16kHz(audioBlob)
  const inputs = await _processor(pcm, { sampling_rate: 16000 })
  const { logits } = await _model(inputs)  // [1, T, V]
  const [, T, V] = logits.dims
  const lp = logSoftmax(logits.data, T, V)

  const charMap = buildCharMap(phonemes)
  if (charMap.length === 0) throw new Error('Từ không có ký tự nhận dạng được')

  const targets = charMap.map(x => x.id)
  const stateSeq = ctcForcedAlign(lp, targets, T, V)

  // Per-character: collect relative log-prob (target vs best at each frame)
  // and the most-voted non-target character for feedback notes
  const charData = Array.from({ length: charMap.length }, () => ({ relLps: [], altIds: [] }))
  for (let t = 0; t < T; t++) {
    const s = stateSeq[t]
    if (s % 2 !== 1) continue  // blank frame
    const ci = (s - 1) / 2
    if (ci >= charMap.length) continue
    const off = t * V
    let maxLp = lp[off], maxId = 0
    for (let v = 1; v < V; v++) {
      if (lp[off + v] > maxLp) { maxLp = lp[off + v]; maxId = v }
    }
    // Relative log-prob: 0 = target is best, negative = something else is better
    charData[ci].relLps.push(lp[off + targets[ci]] - maxLp)
    if (maxId !== targets[ci]) charData[ci].altIds.push(maxId)
  }

  // Score each character using relative log-prob calibrated to [0, 100]
  // Range: 0 (target is best) → 100; ~−3.4 (uniform random) → ~32; −5 → 41 clipped to 0
  // Using sigmoid-like shape: score = 100 * exp(3 * avgRel) clamped to [0, 100]
  const charScores = charData.map(({ relLps, altIds }, ci) => {
    if (relLps.length === 0) return { score: 10, heardChar: null }
    const avgRel = relLps.reduce((a, b) => a + b, 0) / relLps.length
    // 100 * e^(3*avg): at 0 → 100, at -0.7 → 12, at -1 → 5... too harsh
    // Linear: [−4, 0] → [0, 100]
    const score = Math.max(0, Math.min(100, Math.round((avgRel + 4) / 4 * 100)))

    // Most-voted alt character (what was actually heard instead)
    let heardChar = null
    if (altIds.length > altIds.length / 2) {  // majority of frames heard something else
      const freq = {}
      altIds.forEach(id => freq[id] = (freq[id] || 0) + 1)
      const topId = Number(Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0])
      // Only report if heard on > 40% of frames
      if ((freq[topId] / relLps.length) > 0.4) {
        const c = VOCAB_ARR[topId]
        if (c && c !== '|' && c !== '<unk>' && c !== '<pad>') heardChar = c.toLowerCase()
      }
    }
    return { score, heardChar }
  })

  // Aggregate characters → phonemes
  const scored = phonemes.map((p, pi) => {
    const chars = charMap.map((c, ci) => c.pi === pi ? charScores[ci] : null).filter(Boolean)
    if (chars.length === 0) return { ...p, score: 0, note: null }

    // Use minimum score across characters — weakest character limits phoneme quality
    const score = Math.round(chars.reduce((s, c) => s + c.score, 0) / chars.length)
    const heard = chars.map(c => c.heardChar).filter(Boolean).join('')
    const note = heard && score < 70 ? `Nghe như /${heard}/` : null
    return { ...p, score, note }
  })

  const spokenWord = greedyCTCDecode(lp, T, V)
  const overall = Math.round(scored.reduce((s, p) => s + p.score, 0) / scored.length)
  return { phonemes: scored, overall, spokenWord: spokenWord || phonemes.map(p => p.text).join('') }
}

export async function scoreWord(audioBlob, phonemes, language = 'en-US') {
  const key = import.meta.env.VITE_AZURE_KEY
  const region = import.meta.env.VITE_AZURE_REGION || 'southeastasia'
  console.log('[Azure] key defined:', !!key, '| key length:', key?.length ?? 0, '| region:', region, '| lang:', language)
  if (!key) throw new Error('Azure key chưa được cấu hình (VITE_AZURE_KEY)')
  const { scoreWordAzure } = await import('./api-scorers.js')
  return scoreWordAzure(audioBlob, phonemes, key, region, language)
}
