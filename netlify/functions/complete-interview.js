// netlify/functions/complete-interview.js
import { getStore } from '@netlify/blobs'

export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  }

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }

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

  try {
    // EXPLICITLY CONNECT TO BLOBS
    const usedEmails = getStore({
      name: 'sj-used-emails',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_API_TOKEN
    })
    const transcripts = getStore({
      name: 'sj-interview-transcripts',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_API_TOKEN
    })

    const UNLIMITED = ['sarfraz.mb.ahmed2006@gmail.com']
    const markUsed = !UNLIMITED.includes(email)

    if (markUsed) {
      await usedEmails.set(email, JSON.stringify({ used: true, completedAt: new Date().toISOString(), disqualified, closedEarly }))
    }

    const cleanMessages = messages
      .filter(m => m.content !== 'START_INTERVIEW')
      .map(m => ({ ...m, content: m.content.replace(/\[TIME_WARNING\]/gi, '').replace(/\[END_INTERVIEW[^\]]*\]/gi, '').trim() }))
      .filter(m => m.content.length > 0)

    await transcripts.set(email, JSON.stringify({ email, completedAt: new Date().toISOString(), disqualified, closedEarly, messages: cleanMessages }))

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
  } catch (err) {
    console.error('complete-interview error:', err)
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to save to Blobs', detail: err.message }) }
  }
}