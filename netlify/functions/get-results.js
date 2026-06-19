// netlify/functions/get-results.js
// Admin: view all interview results, transcripts, ratings

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

  let adminKey, emailQuery
  try {
    const body = JSON.parse(event.body || '{}')
    adminKey   = body.adminKey
    emailQuery = (body.email || '').trim().toLowerCase()
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Bad request' }) }
  }

  if (adminKey !== process.env.ADMIN_SECRET_KEY) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) }
  }

  try {
    const whitelistStore  = getBlobStore('sj-interview-whitelist')
    const usedStore       = getBlobStore('sj-used-emails')
    const transcriptStore = getBlobStore('sj-interview-transcripts')
    const reviewStore     = getBlobStore('sj-interview-reviews')

    // ---- Single email lookup ----
    if (emailQuery) {
      let usedRecord = null, transcript = null, review = null

      try { const r = await usedStore.get(emailQuery);       if (r) usedRecord  = JSON.parse(r) } catch {}
      try { const r = await transcriptStore.get(emailQuery); if (r) transcript = JSON.parse(r) } catch {}
      try { const r = await reviewStore.get(emailQuery);     if (r) review      = JSON.parse(r) } catch {}

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ email: emailQuery, status: usedRecord, transcript, review }),
      }
    }

    // ---- List all emails from both sources ----
    // Source A: env var
    const envEmails = (process.env.WHITELISTED_EMAILS || '')
      .split(',')
      .map(e => e.trim().toLowerCase())
      .filter(Boolean)

    // Source B: Blobs whitelist (added via admin panel)
    let blobEmails = []
    try {
      const listed = await whitelistStore.list()
      blobEmails = (listed.blobs || []).map(b => b.key)
    } catch {}

    // Merge and deduplicate
    const allEmails = [...new Set([...envEmails, ...blobEmails])]

    if (allEmails.length === 0) {
      return { statusCode: 200, headers, body: JSON.stringify({ results: [] }) }
    }

    // Fetch status for each email
    const results = await Promise.all(
      allEmails.map(async (em) => {
        let whitelistRecord = null, usedRecord = null, review = null

        try { const r = await whitelistStore.get(em); if (r) whitelistRecord = JSON.parse(r) } catch {}
        try { const r = await usedStore.get(em);      if (r) usedRecord      = JSON.parse(r) } catch {}
        try { const r = await reviewStore.get(em);    if (r) review          = JSON.parse(r) } catch {}

        return {
          email: em,
          allowed: whitelistRecord?.allowed ?? envEmails.includes(em),
          addedAt: whitelistRecord?.addedAt || null,
          ...(usedRecord || {}),
          review,
        }
      })
    )

    // Sort: completed first, then started, then pending
    results.sort((a, b) => {
      if (a.completedAt && !b.completedAt) return -1
      if (!a.completedAt && b.completedAt) return 1
      return 0
    })

    return { statusCode: 200, headers, body: JSON.stringify({ results }) }

  } catch (err) {
    console.error('get-results error:', err)
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) }
  }
}
