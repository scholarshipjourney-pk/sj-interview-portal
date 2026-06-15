import { useState } from 'react'

export default function AdminPanel() {
  const [adminKey, setAdminKey] = useState('')
  const [emailsText, setEmailsText] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [authed, setAuthed] = useState(false)
  const [authKey, setAuthKey] = useState('')
  const [authError, setAuthError] = useState('')

  // Simple front-door check (real security is on the server)
  const handleAuth = () => {
    if (!authKey.trim()) return
    setAuthed(true)
    setAdminKey(authKey.trim())
  }

  const handleAddEmails = async () => {
    const lines = emailsText
      .split(/[\n,]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes('@'))

    if (lines.length === 0) {
      setResult({ type: 'error', msg: 'No valid emails found. Paste one email per line.' })
      return
    }

    setLoading(true)
    setResult(null)

    try {
      const res = await fetch('/api/add-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: lines, adminKey }),
      })

      const data = await res.json()

      if (res.status === 401) {
        setResult({ type: 'error', msg: 'Invalid admin key. Please check ADMIN_SECRET_KEY in Netlify environment variables.' })
        return
      }

      if (data.added) {
        setResult({
          type: 'success',
          msg: `Successfully added ${data.added} candidate email${data.added > 1 ? 's' : ''} to the whitelist.`,
        })
        setEmailsText('')
      } else {
        setResult({ type: 'error', msg: data.error || 'Something went wrong.' })
      }
    } catch {
      setResult({ type: 'error', msg: 'Network error. Is the Netlify dev server running?' })
    } finally {
      setLoading(false)
    }
  }

  if (!authed) {
    return (
      <div className="page">
        <div className="glass-gold fade-in-up" style={{ width: '100%', maxWidth: 400, padding: '40px 36px', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: 16 }}>🔐</div>
          <h2 style={{ marginBottom: 6 }}>Admin Access</h2>
          <p className="text-secondary" style={{ fontSize: '0.88rem', marginBottom: 28 }}>
            Enter your admin secret key to manage interview invitations.
          </p>

          <input
            className="input"
            type="password"
            placeholder="Admin secret key"
            value={authKey}
            onChange={(e) => { setAuthKey(e.target.value); setAuthError('') }}
            onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
            style={{ marginBottom: 12 }}
            autoFocus
          />

          {authError && (
            <div className="alert alert-error" style={{ marginBottom: 12, fontSize: '0.82rem' }}>
              {authError}
            </div>
          )}

          <button className="btn btn-gold" style={{ width: '100%' }} onClick={handleAuth} disabled={!authKey.trim()}>
            Enter Admin Panel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page" style={{ padding: '32px 16px' }}>
      <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Header */}
        <div className="glass-gold fade-in-up" style={{ padding: '24px 28px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div className="sj-logo-icon">SJ</div>
          <div>
            <div style={{ fontWeight: 700 }}>Admin Panel</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Interview Whitelist Management</div>
          </div>
          <div
            style={{
              marginLeft: 'auto',
              padding: '4px 12px',
              background: 'rgba(80,220,120,0.1)',
              border: '1px solid rgba(80,220,120,0.3)',
              borderRadius: 20,
              fontSize: '0.75rem',
              fontWeight: 600,
              color: '#80e8a0',
            }}
          >
            Authenticated
          </div>
        </div>

        {/* Add emails */}
        <div className="glass fade-in-up" style={{ padding: '28px 28px', animationDelay: '0.08s' }}>
          <h3 style={{ marginBottom: 6 }}>Add Candidate Emails</h3>
          <p className="text-secondary" style={{ fontSize: '0.85rem', marginBottom: 20, lineHeight: 1.6 }}>
            Paste email addresses below — one per line, or comma-separated. Each email will be
            added to the whitelist and gets exactly one interview attempt.
          </p>

          <textarea
            className="input"
            rows={7}
            placeholder={`candidate1@gmail.com\ncandidate2@gmail.com\ncandidate3@outlook.com`}
            value={emailsText}
            onChange={(e) => setEmailsText(e.target.value)}
            style={{ marginBottom: 16, fontFamily: 'monospace', fontSize: '0.88rem' }}
          />

          {result && (
            <div
              className={`alert ${result.type === 'success' ? 'alert-success' : 'alert-error'}`}
              style={{ marginBottom: 16, fontSize: '0.88rem' }}
            >
              {result.msg}
            </div>
          )}

          <button
            className="btn btn-gold"
            onClick={handleAddEmails}
            disabled={loading || !emailsText.trim()}
            style={{ minWidth: 180 }}
          >
            {loading ? (
              <>
                <span className="spinner" /> Adding emails...
              </>
            ) : (
              <>
                Add to Whitelist
                <span>→</span>
              </>
            )}
          </button>
        </div>

        {/* Tips */}
        <div className="glass fade-in-up" style={{ padding: '20px 28px', animationDelay: '0.14s' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--gold)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 12 }}>
            Workflow Tips
          </div>
          {[
            'Send interview invites to 10 candidates at a time to monitor API usage.',
            'Each email only works once. If a candidate needs a retry, contact support.',
            'Interviews auto-end at 20 minutes to keep Groq API usage minimal.',
            'Check Netlify Blobs in your dashboard to see usage and stored records.',
          ].map((tip, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              <span style={{ color: 'var(--gold)', flexShrink: 0 }}>→</span>
              <span>{tip}</span>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center' }}>
          <a
            href="/"
            style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textDecoration: 'none' }}
          >
            ← Back to interview portal
          </a>
        </div>
      </div>
    </div>
  )
}
