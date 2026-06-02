export function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Access-Control-Allow-Origin': '*', ...headers })
  res.end(body)
}

export function json(res, status, value) {
  send(res, status, JSON.stringify(value), { 'Content-Type': 'application/json; charset=utf-8' })
}

export async function readBody(req) {
  if (req.body != null) {
    if (Buffer.isBuffer(req.body)) return req.body
    if (typeof req.body === 'string') return Buffer.from(req.body)
    if (req.body instanceof Uint8Array) return Buffer.from(req.body)
    return Buffer.from(JSON.stringify(req.body))
  }
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return Buffer.concat(chunks)
}

export function parseMultipart(req, body) {
  const contentType = req.headers['content-type'] || ''
  const boundary = contentType.match(/boundary=([^;]+)/)?.[1]?.replace(/^"|"$/g, '')
  if (!boundary) throw new Error('Missing multipart boundary.')
  const marker = Buffer.from(`--${boundary}`)
  const fields = {}
  const files = {}
  let cursor = body.indexOf(marker)

  while (cursor !== -1) {
    let start = cursor + marker.length
    if (body.slice(start, start + 2).toString() === '--') break
    if (body.slice(start, start + 2).toString() === '\r\n') start += 2
    const next = body.indexOf(marker, start)
    if (next === -1) break
    let part = body.slice(start, next)
    if (part.slice(-2).toString() === '\r\n') part = part.slice(0, -2)
    const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'))
    if (headerEnd === -1) {
      cursor = next
      continue
    }
    const headerText = part.slice(0, headerEnd).toString('utf8')
    const content = part.slice(headerEnd + 4)
    const name = headerText.match(/name="([^"]+)"/)?.[1]
    if (!name) {
      cursor = next
      continue
    }
    const filename = headerText.match(/filename="([^"]*)"/)?.[1]
    const type = headerText.match(/Content-Type:\s*([^\r\n]+)/i)?.[1] || 'application/octet-stream'
    if (filename != null) files[name] = { filename: filename || 'audio.wav', type, content }
    else fields[name] = content.toString('utf8')
    cursor = next
  }
  return { fields, files }
}
