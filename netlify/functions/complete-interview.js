// netlify/functions/complete-interview.js
// Marks interview done in Blobs and saves the full transcript

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
    const usedEmails  = getStore('sj-used-emails')
    const transcripts = getStore('sj-interview-transcripts')

    // Unlimited emails are never marked as used
    const UNLIMITED = ['sarfraz.mb.ahmed2006@gmail.com']
    const markUsed = !UNLIMITED.includes(email)

    // 1. Mark Email as Used (Cross-Device Security)
    if (markUsed) {
      await usedEmails.set(
        email,
        JSON.stringify({
          used: true,
          completedAt: new Date().toISOString(),
          disqualified,
          closedEarly,
        })
      )
    }

    // 2. Clean and Save Transcript for Admin Panel
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
      body: JSON.stringify({ error: 'Failed to save to Blobs', detail: err.message }),
    }
  }
}