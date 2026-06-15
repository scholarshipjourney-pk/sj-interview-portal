// netlify/functions/complete-interview.js
// Called at the end of every interview to mark the email as used

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

  let email, disqualified
  try {
    const body = JSON.parse(event.body || '{}')
    email = (body.email || '').trim().toLowerCase()
    disqualified = Boolean(body.disqualified)
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Bad request' }) }
  }

  if (!email) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email required' }) }
  }

  try {
    const store = getStore('sj-interview-whitelist')

    let record = {}
    try {
      const raw = await store.get(email)
      if (raw) record = JSON.parse(raw)
    } catch {
      // Record might not exist in rare edge cases; still mark as used
    }

    await store.set(
      email,
      JSON.stringify({
        ...record,
        used: true,
        inProgress: false,
        completedAt: new Date().toISOString(),
        disqualified,
      })
    )

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true }),
    }
  } catch (err) {
    console.error('complete-interview error:', err)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to mark interview complete', detail: err.message }),
    }
  }
}
