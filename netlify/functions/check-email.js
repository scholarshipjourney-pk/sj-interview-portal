// netlify/functions/check-email.js
// Checks Environment Variables for whitelist, and Blobs for used status

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

  if (process.env.TEST_MODE === 'true') {
    return { statusCode: 200, headers, body: JSON.stringify({ allowed: true }) }
  }

  const UNLIMITED_EMAILS = ['sarfraz.mb.ahmed2006@gmail.com']

  try {
    // 1. CHECK WHITELIST (Environment Variables)
    const whitelistedString = process.env.WHITELISTED_EMAILS || ''
    const allowedEmails = whitelistedString.split(',').map(e => e.trim().toLowerCase())

    const isWhitelisted = allowedEmails.includes(email) || UNLIMITED_EMAILS.includes(email)
    
    if (!isWhitelisted) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ allowed: false, reason: 'not_whitelisted' }),
      }
    }

    // Unlimited emails bypass the "already used" database check
    if (UNLIMITED_EMAILS.includes(email)) {
      return { statusCode: 200, headers, body: JSON.stringify({ allowed: true }) }
    }

    // 2. CHECK DATABASE FOR PREVIOUS USE (Cross-Device Security)
    const usedEmails = getStore('sj-used-emails')
    const rawRecord = await usedEmails.get(email)
    
    if (rawRecord) {
      const record = JSON.parse(rawRecord)
      if (record.used) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ allowed: false, reason: 'already_used' }),
        }
      }
    }

    // If on the list and not used, let them in!
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