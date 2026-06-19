// netlify/functions/check-email.js
// Checks: 1) env var whitelist OR Blobs whitelist, 2) used-emails Blobs

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

  let email
  try {
    email = (JSON.parse(event.body || '{}').email || '').trim().toLowerCase()
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ allowed: false, reason: 'bad_request' }) }
  }

  if (!email || !email.includes('@')) {
    return { statusCode: 400, headers, body: JSON.stringify({ allowed: false, reason: 'invalid_email' }) }
  }

  // Unlimited access — never blocked
  if (UNLIMITED_EMAILS.includes(email)) {
    return { statusCode: 200, headers, body: JSON.stringify({ allowed: true }) }
  }

  try {
    // ---- STEP 1: Check whitelist ----
    // Source A: WHITELISTED_EMAILS environment variable (added via Netlify dashboard)
    const envList = (process.env.WHITELISTED_EMAILS || '')
      .split(',')
      .map(e => e.trim().toLowerCase())
      .filter(Boolean)

    let isWhitelisted = envList.includes(email)

    // Source B: sj-interview-whitelist Blobs (added via admin panel)
    if (!isWhitelisted) {
      try {
        const whitelistStore = getBlobStore('sj-interview-whitelist')
        const raw = await whitelistStore.get(email)
        if (raw) {
          const record = JSON.parse(raw)
          if (record.allowed) isWhitelisted = true
        }
      } catch {
        // Blobs unavailable — only env var whitelist applies
      }
    }

    if (!isWhitelisted) {
      return { statusCode: 200, headers, body: JSON.stringify({ allowed: false, reason: 'not_whitelisted' }) }
    }

    // ---- STEP 2: Check if already used ----
    try {
      const usedStore = getBlobStore('sj-used-emails')
      const raw = await usedStore.get(email)
      if (raw) {
        const record = JSON.parse(raw)
        if (record.used) {
          return { statusCode: 200, headers, body: JSON.stringify({ allowed: false, reason: 'already_used' }) }
        }
      }
    } catch {
      // If Blobs is down, allow through — better to let a candidate in than block unfairly
    }

    return { statusCode: 200, headers, body: JSON.stringify({ allowed: true }) }

  } catch (err) {
    console.error('check-email error:', err)
    return { statusCode: 500, headers, body: JSON.stringify({ allowed: false, reason: 'server_error', detail: err.message }) }
  }
}
