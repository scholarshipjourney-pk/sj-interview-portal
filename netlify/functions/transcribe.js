// netlify/functions/transcribe.js
// Groq Whisper API — converts candidate's recorded audio to text

export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type':                 'application/json',
  }

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' }
  if (event.httpMethod !== 'POST')   return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'GROQ_API_KEY not configured' }) }
  }

  let audioBase64
  try {
    const body  = JSON.parse(event.body || '{}')
    audioBase64 = body.audio
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Bad request' }) }
  }

  if (!audioBase64) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'No audio data provided' }) }
  }

  // Guard: reject oversized payloads (~7.5 MB raw audio limit)
  if (audioBase64.length > 10 * 1024 * 1024) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Audio too large. Please keep answers under 3 minutes.' }) }
  }

  try {
    const audioBuffer = Buffer.from(audioBase64, 'base64')
    const blob        = new Blob([audioBuffer], { type: 'audio/webm' })

    const formData = new FormData()
    formData.append('file',     blob, 'recording.webm')
    formData.append('model',    'whisper-large-v3-turbo')
    formData.append('language', 'en')  // Force English output

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method:  'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body:    formData,
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('Groq Whisper error:', response.status, errText)
      throw new Error(`Groq Whisper responded with ${response.status}`)
    }

    const data = await response.json()
    return { statusCode: 200, headers, body: JSON.stringify({ text: data.text || '' }) }

  } catch (err) {
    console.error('Transcribe error:', err)
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Transcription failed' }) }
  }
}