export async function audioBlobToPcmWav(blob) {
  const arrayBuffer = await blob.arrayBuffer()
  const ctx = new (window.AudioContext || window.webkitAudioContext)()
  const decoded = await ctx.decodeAudioData(arrayBuffer)
  ctx.close()

  const frames = Math.ceil(decoded.length / decoded.sampleRate * 16000)
  const offCtx = new OfflineAudioContext(1, frames, 16000)
  const src = offCtx.createBufferSource()
  src.buffer = decoded
  src.connect(offCtx.destination)
  src.start()
  const resampled = await offCtx.startRendering()
  const pcm = resampled.getChannelData(0)
  const wavBuf = new ArrayBuffer(44 + pcm.length * 2)
  const view = new DataView(wavBuf)
  const writeString = (offset, value) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i))
  }
  writeString(0, 'RIFF'); view.setUint32(4, 36 + pcm.length * 2, true)
  writeString(8, 'WAVE'); writeString(12, 'fmt ')
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true)
  view.setUint32(24, 16000, true); view.setUint32(28, 32000, true)
  view.setUint16(32, 2, true); view.setUint16(34, 16, true)
  writeString(36, 'data'); view.setUint32(40, pcm.length * 2, true)
  for (let i = 0; i < pcm.length; i++) {
    view.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, pcm[i])) * 32767), true)
  }
  return new Blob([wavBuf], { type: 'audio/wav' })
}
