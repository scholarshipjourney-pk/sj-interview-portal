// netlify/functions/check-email.js
import { getStore } from '@netlify/blobs'

export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  }

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }

  let email
  try {
    const body = JSON.parse(event.body || '{}')
    email = (body.email || '').trim().toLowerCase()
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ allowed: false, reason: 'bad_request' }) }
  }

  if (!email || !email.includes('@')) return { statusCode: 400, headers, body: JSON.stringify({ allowed: false, reason: 'invalid_email' }) }

  const UNLIMITED_EMAILS = ['sarfraz.mb.ahmed2006@gmail.com']

  try {
    // 1. CHECK WHITELIST
    const whitelistedString = process.env.WHITELISTED_EMAILS || ''
    const allowedEmails = whitelistedString.split(',').map(e => e.trim().toLowerCase())

    const isWhitelisted = allowedEmails.includes(email) || UNLIMITED_EMAILS.includes(email)
    
    if (!isWhitelisted) {
      return { statusCode: 200, headers, body: JSON.stringify({ allowed: false, reason: 'not_whitelisted' }) }
    }

    if (UNLIMITED_EMAILS.includes(email)) {
      return { statusCode: 200, headers, body: JSON.stringify({ allowed: true }) }
    }

    // 2. EXPLICITLY CONNECT TO BLOBS (Fixes the 500 crash)
    const usedEmails = getStore({
      name: 'sj-used-emails',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_API_TOKEN
    })
    
    const rawRecord = await usedEmails.get(email)
    if (rawRecord) {
      const record = JSON.parse(rawRecord)
      if (record.used) {
        return { statusCode: 200, headers, body: JSON.stringify({ allowed: false, reason: 'already_used' }) }
      }
    }

    return { statusCode: 200, headers, body: JSON.stringify({ allowed: true }) }

  } catch (err) {
    console.error('check-email error:', err)
    return { statusCode: 500, headers, body: JSON.stringify({ allowed: false, reason: 'server_error', detail: err.message }) }
  }
}