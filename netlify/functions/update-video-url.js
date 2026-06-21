// netlify/functions/update-video-url.js
// Called after Cloudinary upload completes to save the video URL into the transcript record

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

  let email, videoUrl
  try {
    const body = JSON.parse(event.body || '{}')
    email    = (body.email    || '').trim().toLowerCase()
    videoUrl = (body.videoUrl || '').trim()
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Bad request' }) }
  }

  if (!email || !videoUrl) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'email and videoUrl required' }) }
  }

  try {
    const store = getBlobStore('sj-interview-transcripts')
    const raw   = await store.get(email)

    if (raw) {
      const record   = JSON.parse(raw)
      record.videoUrl = videoUrl
      await store.set(email, JSON.stringify(record))
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
  } catch (err) {
    console.error('update-video-url error:', err)
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) }
  }
}
