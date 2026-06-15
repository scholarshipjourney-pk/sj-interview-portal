// netlify/functions/check-email.js
// Checks if a candidate email is whitelisted and unused

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

  let email
  try {
    const body = JSON.parse(event.body || '{}')
    email = (body.email || '').trim().toLowerCase()
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ allowed: false, reason: 'bad_request' }) }
  }

  if (!email || !email.includes('@')) {
    return { statusCode: 400, headers, body: JSON.stringify({ allowed: false, reason: 'invalid_email' }) }
  }

  // -------------------------------------------------------
  // TEST MODE: set TEST_MODE=true in your .env to bypass
  // the whitelist and let any email through. Remove or set
  // to false before going live with real candidates.
  // -------------------------------------------------------
  if (process.env.TEST_MODE === 'true') {
    return { statusCode: 200, headers, body: JSON.stringify({ allowed: true }) }
  }

  // -------------------------------------------------------
  // UNLIMITED ACCESS EMAILS: these emails can enter the
  // interview as many times as they want. Used for testing
  // by the Scholarship Journey admin team. Never marked used.
  // -------------------------------------------------------
  const UNLIMITED_EMAILS = [
    'sarfraz.mb.ahmed2006@gmail.com',
  ]
  if (UNLIMITED_EMAILS.includes(email)) {
    return { statusCode: 200, headers, body: JSON.stringify({ allowed: true }) }
  }

  try {
    const store = getStore('sj-interview-whitelist')
    let record

    try {
      const raw = await store.get(email)
      if (raw) record = JSON.parse(raw)
    } catch {
      record = null
    }

    if (!record || !record.allowed) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ allowed: false, reason: 'not_whitelisted' }),
      }
    }

    if (record.used) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ allowed: false, reason: 'already_used' }),
      }
    }

    // Mark in-progress so they can't open a second tab
    await store.set(
      email,
      JSON.stringify({
        ...record,
        inProgress: true,
        startedAt: new Date().toISOString(),
      })
    )

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ allowed: true }),
    }
  } catch (err) {
    console.error('check-email error:', err)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ allowed: false, reason: 'server_error', detail: err.message }),
    }
  }
}
