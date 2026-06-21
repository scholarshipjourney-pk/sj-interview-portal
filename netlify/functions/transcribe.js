// netlify/functions/transcribe.js
// Groq Whisper - accepts any audio format (webm, mp4, ogg) for cross-platform support

export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type':                 'application/json',
  }

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' }
  if (event.httpMethod !== 'POST')   return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'GROQ_API_KEY not configured' }) }

  let audioBase64, mimeType
  try {
    const body  = JSON.parse(event.body || '{}')
    audioBase64 = body.audio
    // mimeType sent from the browser tells us exactly what format was recorded
    // Safari records audio/mp4, Chrome/Firefox record audio/webm, etc.
    mimeType    = body.mimeType || 'audio/webm'
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Bad request' }) }
  }

  if (!audioBase64) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'No audio data provided' }) }
  }

  // Reject oversized payloads (roughly 7.5 MB of raw audio)
  if (audioBase64.length > 10 * 1024 * 1024) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Audio too large. Keep answers under 3 minutes.' }) }
  }

  try {
    const audioBuffer = Buffer.from(audioBase64, 'base64')
    const blob        = new Blob([audioBuffer], { type: mimeType })

    // Pick the correct file extension based on what the browser sent
    // Whisper supports: mp4, webm, ogg, wav, mp3, m4a, flac
    let ext = 'webm'
    if (mimeType.includes('mp4')) ext = 'mp4'
    else if (mimeType.includes('ogg')) ext = 'ogg'
    else if (mimeType.includes('wav')) ext = 'wav'
    else if (mimeType.includes('m4a')) ext = 'm4a'

    const formData = new FormData()
    formData.append('file',     blob, `recording.${ext}`)
    formData.append('model',    'whisper-large-v3-turbo')
    formData.append('language', 'en')  // Force English output regardless of accent

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method:  'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body:    formData,
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('Groq Whisper error:', response.status, errText.slice(0, 300))
      throw new Error(`Groq Whisper responded with ${response.status}`)
    }

    const data = await response.json()
    return { statusCode: 200, headers, body: JSON.stringify({ text: data.text || '' }) }

  } catch (err) {
    console.error('Transcribe error:', err)
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Transcription failed' }) }
  }
}
