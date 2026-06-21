// netlify/functions/complete-interview.js
// Marks interview done, saves transcript, records used-email for cross-device blocking

import { getStore } from '@netlify/blobs'

const UNLIMITED_EMAILS = ['sarfraz.mb.ahmed2006@gmail.com']

const getBlobStore = (name) =>
  getStore({
    name,
    siteID: process.env.NETLIFY_SITE_ID,
    token:  process.env.NETLIFY_API_TOKEN,
  })

export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type':                 'application/json',
  }

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' }
  if (event.httpMethod !== 'POST')   return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }

  let email, disqualified, closedEarly, messages, videoUrl
  try {
    const body   = JSON.parse(event.body || '{}')
    email        = (body.email || '').trim().toLowerCase()
    disqualified = Boolean(body.disqualified)
    closedEarly  = Boolean(body.closedEarly)
    messages     = body.messages || []
    videoUrl     = body.videoUrl || null
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Bad request' }) }
  }

  // Guard: email is required
  if (!email || !email.includes('@')) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Valid email required' }) }
  }

  const isUnlimited = UNLIMITED_EMAILS.includes(email)
  const now = new Date().toISOString()

  // Clean messages — strip internal flags
  const cleanMessages = messages
    .filter(m => m.content !== 'START_INTERVIEW')
    .map(m => ({
      ...m,
      content: (m.content || '')
        .replace(/\[TIME_WARNING\]/gi, '')
        .replace(/\[END_INTERVIEW[^\]]*\]/gi, '')
        .trim(),
    }))
    .filter(m => m.content.length > 0)

  try {
    // ---- Mark as used (cross-device blocking) ----
    // Skip for unlimited emails so they can test unlimited times
    if (!isUnlimited) {
      const usedStore = getBlobStore('sj-used-emails')
      await usedStore.set(
        email,
        JSON.stringify({ used: true, completedAt: now, disqualified, closedEarly })
      )
    }

    // ---- Save transcript (always, even for unlimited) ----
    const transcriptStore = getBlobStore('sj-interview-transcripts')
    await transcriptStore.set(
      email,
      JSON.stringify({ email, completedAt: now, disqualified, closedEarly, messages: cleanMessages, videoUrl })
    )

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
  } catch (err) {
    console.error('complete-interview error:', err)
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to save', detail: err.message }) }
  }
}