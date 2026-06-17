// netlify/functions/complete-interview.js
// Marks interview done and saves the full transcript

import { getStore } from '@netlify/blobs'

export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  let email, disqualified, messages, closedEarly
  try {
    const body = JSON.parse(event.body || '{}')
    email        = (body.email || '').trim().toLowerCase()
    disqualified = Boolean(body.disqualified)
    closedEarly  = Boolean(body.closedEarly)
    messages     = body.messages || []
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Bad request' }) }
  }

  if (!email) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email required' }) }
  }

  try {
    const whitelist    = getStore('sj-interview-whitelist')
    const transcripts  = getStore('sj-interview-transcripts')

    // Update whitelist record
    let record = {}
    try {
      const raw = await whitelist.get(email)
      if (raw) record = JSON.parse(raw)
    } catch {}

    // Unlimited emails are never marked used
    const UNLIMITED = ['sarfraz.mb.ahmed2006@gmail.com']
    const markUsed = !UNLIMITED.includes(email)

    await whitelist.set(
      email,
      JSON.stringify({
        ...record,
        used: markUsed ? true : false,
        inProgress: false,
        completedAt: new Date().toISOString(),
        disqualified,
        closedEarly,
      })
    )

    // Save transcript (clean internal flags from messages)
    const cleanMessages = messages
      .filter(m => m.content !== 'START_INTERVIEW')
      .map(m => ({
        ...m,
        content: m.content
          .replace(/\[TIME_WARNING\]/gi, '')
          .replace(/\[END_INTERVIEW[^\]]*\]/gi, '')
          .trim()
      }))
      .filter(m => m.content.length > 0)

    await transcripts.set(
      email,
      JSON.stringify({
        email,
        completedAt: new Date().toISOString(),
        disqualified,
        closedEarly,
        messages: cleanMessages,
      })
    )

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
  } catch (err) {
    console.error('complete-interview error:', err)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to save', detail: err.message }),
    }
  }
}
