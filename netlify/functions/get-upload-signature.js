// netlify/functions/get-upload-signature.js
// Generates a signed URL so the browser can upload video directly to Cloudinary
// This keeps the API secret safe on the server side

import crypto from 'crypto'

export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type':                 'application/json',
  }

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' }
  if (event.httpMethod !== 'POST')   return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }

  const apiSecret   = process.env.CLOUDINARY_API_SECRET
  const apiKey      = process.env.CLOUDINARY_API_KEY
  const cloudName   = process.env.CLOUDINARY_CLOUD_NAME

  if (!apiSecret || !apiKey || !cloudName) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Cloudinary env vars not configured' }) }
  }

  let email = 'unknown'
  try {
    const body = JSON.parse(event.body || '{}')
    email = (body.email || 'unknown').replace(/[@.]/g, '_')
  } catch {}

  const timestamp = Math.round(Date.now() / 1000)
  const folder    = 'sj-interviews'
  const publicId  = `interview_${email}_${timestamp}`

  // Cloudinary requires signing specific params in alphabetical order
  const paramsToSign = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}`
  const signature    = crypto
    .createHash('sha256')
    .update(paramsToSign + apiSecret)
    .digest('hex')

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ signature, timestamp, apiKey, cloudName, publicId, folder }),
  }
}
