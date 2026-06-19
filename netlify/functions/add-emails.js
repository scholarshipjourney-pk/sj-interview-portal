// netlify/functions/add-emails.js
// Admin-only: adds candidate emails to the sj-interview-whitelist Blobs store

import { getStore } from '@netlify/blobs'

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

  let body
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Bad request' }) }
  }

  // Admin key check
  if (!process.env.ADMIN_SECRET_KEY || body.adminKey !== process.env.ADMIN_SECRET_KEY) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
  }

  const emails = (body.emails || [])
    .map(e => (e || '').trim().toLowerCase())
    .filter(e => e.includes('@') && e.includes('.'))

  if (emails.length === 0) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'No valid emails provided' }) }
  }

  try {
    const whitelistStore = getBlobStore('sj-interview-whitelist')
    const usedStore      = getBlobStore('sj-used-emails')

    let added = 0, skipped = 0

    await Promise.all(emails.map(async (email) => {
      // Don't overwrite a completed interview
      try {
        const usedRaw = await usedStore.get(email)
        if (usedRaw) {
          const used = JSON.parse(usedRaw)
          if (used.used) { skipped++; return }
        }
      } catch {}

      await whitelistStore.set(
        email,
        JSON.stringify({ allowed: true, addedAt: new Date().toISOString() })
      )
      added++
    }))

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, added, skipped, total: emails.length }),
    }
  } catch (err) {
    console.error('add-emails error:', err)
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to add emails', detail: err.message }) }
  }
}
