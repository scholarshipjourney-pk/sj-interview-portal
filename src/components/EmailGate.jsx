import { useState } from 'react'

export default function EmailGate({ onVerified }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    const trimmed = email.trim().toLowerCase()
    if (!trimmed || !trimmed.includes('@')) {
      setError('Please enter a valid email address.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      })

      const data = await res.json()

      if (data.allowed) {
        onVerified(trimmed)
      } else if (data.reason === 'already_used') {
        setError(
          'This email has already been used for an interview session. Each candidate gets one attempt only.'
        )
      } else if (data.reason === 'not_whitelisted') {
        setError(
          'This email is not on the invite list. Please check your invitation email or contact us at careers@scholarshipjourney.pk'
        )
      } else {
        setError('Something went wrong. Please try again in a moment.')
      }
    } catch (err) {
      setError('Connection error. Please check your internet and try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit()
  }

  return (
    <div className="page">
      <div
        className="glass-gold fade-in-up"
        style={{
          width: '100%',
          maxWidth: 460,
          padding: '44px 40px',
          textAlign: 'center',
        }}
      >
        {/* Logo */}
        <div className="sj-logo" style={{ justifyContent: 'center', marginBottom: 28 }}>
          <div className="sj-logo-icon">SJ</div>
          <div className="sj-logo-text">
            Scholarship <span>Journey</span>
          </div>
        </div>

        {/* Heading */}
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            background: 'rgba(253,179,2,0.12)',
            border: '1px solid rgba(253,179,2,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.6rem',
            margin: '0 auto 20px',
          }}
        >
          🎯
        </div>

        <h1 style={{ fontSize: '1.6rem', marginBottom: 8 }}>AI Interview Portal</h1>
        <p className="text-secondary" style={{ fontSize: '0.92rem', marginBottom: 32 }}>
          AI &amp; ML Internship Screening · Scholarship Journey
        </p>

        {/* Email input */}
        <div style={{ textAlign: 'left', marginBottom: 20 }}>
          <label
            style={{
              display: 'block',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: 'rgba(255,255,255,0.6)',
              marginBottom: 8,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            Your Invitation Email
          </label>
          <input
            className="input"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setError('')
            }}
            onKeyDown={handleKeyDown}
            autoFocus
            autoComplete="email"
            disabled={loading}
          />
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: 16, textAlign: 'left' }}>
            {error}
          </div>
        )}

        <button
          className="btn btn-gold"
          style={{ width: '100%', fontSize: '1rem', padding: '15px 32px' }}
          onClick={handleSubmit}
          disabled={loading || !email.trim()}
        >
          {loading ? (
            <>
              <span className="spinner" />
              Verifying...
            </>
          ) : (
            <>
              Enter Interview Portal
              <span style={{ fontSize: '1.1rem' }}>→</span>
            </>
          )}
        </button>

        <p
          className="text-muted"
          style={{ fontSize: '0.78rem', marginTop: 20, lineHeight: 1.6 }}
        >
          Only candidates who received an invitation link may access this portal.
          <br />
          Each email address gets exactly one attempt.
        </p>
      </div>

      {/* Footer */}
      <p
        className="text-muted"
        style={{ fontSize: '0.75rem', marginTop: 24, textAlign: 'center' }}
      >
        &copy; {new Date().getFullYear()} Scholarship Journey · Powered by AI
      </p>
    </div>
  )
}
