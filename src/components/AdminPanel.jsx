import { useState } from 'react'

const TABS = { ADD: 'add', RESULTS: 'results' }

function StatusBadge({ record }) {
  if (!record) return <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Not started</span>
  if (record.disqualified) return <span style={{ fontSize: '0.75rem', color: '#ff8080', fontWeight: 600 }}>Disqualified</span>
  if (record.closedEarly)  return <span style={{ fontSize: '0.75rem', color: '#ffaa40', fontWeight: 600 }}>Closed early</span>
  if (record.used)         return <span style={{ fontSize: '0.75rem', color: '#80e8a0', fontWeight: 600 }}>Completed</span>
  if (record.inProgress)   return <span style={{ fontSize: '0.75rem', color: '#60d0ff', fontWeight: 600 }}>In progress</span>
  return <span style={{ fontSize: '0.75rem', color: 'var(--gold)', fontWeight: 600 }}>Invited</span>
}

function TranscriptModal({ data, onClose }) {
  if (!data) return null
  const msgs = data.transcript?.messages || []
  
// Safely grab the candidate rating and feedback from our new transcript fields (or fallback to old review object)
  const candidateRating = data.candidateRating || data.review?.rating;
  const candidateFeedback = data.candidateFeedback || data.review?.review;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }} onClick={onClose}>
      <div
        className="glass-gold"
        style={{ width: '100%', maxWidth: 640, maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 24 }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem' }}>Interview Transcript</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{data.email}</div>
          </div>
          <button className="btn btn-ghost" style={{ padding: '8px 16px', fontSize: '0.85rem' }} onClick={onClose}>Close</button>
        </div>

        {data.status && (
          <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
            {[
              { label: 'Completed', val: data.status.completedAt ? new Date(data.status.completedAt).toLocaleString() : 'No' },
              { label: 'Disqualified', val: data.status.disqualified ? 'Yes' : 'No' },
              { label: 'Closed early', val: data.status.closedEarly ? 'Yes' : 'No' },
              { label: 'Candidate Rating', val: candidateRating ? `${candidateRating}/5` : 'None' },
              { label: 'Video', val: data.transcript?.videoUrl ? <a href={data.transcript.videoUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gold)' }}>Watch Recording</a> : 'Not saved' },
            ].map(item => (
              <div key={item.label} style={{ background: 'rgba(0,0,0,0.2)', padding: '6px 12px', borderRadius: 8 }}>
                <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', marginBottom: 2 }}>{item.label}</div>
                <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{item.val}</div>
              </div>
            ))}
          </div>
        )}

        {/* Updated Candidate Feedback Section */}
        {(candidateRating || candidateFeedback) && (
          <div style={{ background: 'rgba(253,179,2,0.08)', border: '1px solid rgba(253,179,2,0.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--gold)', fontWeight: 700, marginBottom: 6 }}>CANDIDATE'S EXPERIENCE FEEDBACK</div>
            {candidateRating && (
              <div style={{ marginBottom: candidateFeedback ? 4 : 0 }}>
                <strong style={{ color: 'var(--text-white)' }}>Stars:</strong> {candidateRating} / 5
              </div>
            )}
            {candidateFeedback && (
              <div>
                <strong style={{ color: 'var(--text-white)' }}>Comment:</strong> "{candidateFeedback}"
              </div>
            )}
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {msgs.length === 0 ? (
            <p className="text-muted" style={{ textAlign: 'center', fontSize: '0.85rem' }}>No transcript saved.</p>
          ) : msgs.map((m, i) => (
            <div key={i} style={{
              padding: '10px 14px', borderRadius: 10, fontSize: '0.82rem', lineHeight: 1.6,
              background: m.role === 'assistant' ? 'rgba(253,179,2,0.08)' : 'rgba(255,255,255,0.05)',
              borderLeft: `2px solid ${m.role === 'assistant' ? 'var(--gold)' : 'rgba(255,255,255,0.15)'}`,
            }}>
              <div style={{ fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: m.role === 'assistant' ? 'var(--gold)' : 'var(--text-muted)', marginBottom: 4 }}>
                {m.role === 'assistant' ? 'Sarfraz (AI)' : 'Candidate'}
              </div>
              {m.content}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function AdminPanel() {
  const [authed,      setAuthed]      = useState(false)
  const [authKey,     setAuthKey]     = useState('')
  const [adminKey,    setAdminKey]    = useState('')
  const [tab,         setTab]         = useState(TABS.ADD)
  const [emailsText,  setEmailsText]  = useState('')
  const [addLoading,  setAddLoading]  = useState(false)
  const [addResult,   setAddResult]   = useState(null)
  const [results,     setResults]     = useState([])
  const [resLoading,  setResLoading]  = useState(false)
  const [resError,    setResError]    = useState('')
  const [transcript,  setTranscript]  = useState(null)
  const [transLoading, setTransLoading] = useState(false)

  const handleAuth = () => {
    if (!authKey.trim()) return
    setAuthed(true)
    setAdminKey(authKey.trim())
  }

  const handleAddEmails = async () => {
    const lines = emailsText.split(/[\n,]+/).map(e => e.trim().toLowerCase()).filter(e => e.includes('@'))
    if (lines.length === 0) { setAddResult({ type: 'error', msg: 'No valid emails found.' }); return }
    setAddLoading(true)
    setAddResult(null)
    try {
      const res  = await fetch('/api/add-emails', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emails: lines, adminKey }) })
      const data = await res.json()
      if (res.status === 401) { setAddResult({ type: 'error', msg: 'Invalid admin key.' }); return }
      setAddResult({ type: 'success', msg: `Added ${data.added} email${data.added !== 1 ? 's' : ''}. Skipped ${data.skipped || 0} already completed.` })
      setEmailsText('')
    } catch { setAddResult({ type: 'error', msg: 'Network error.' }) }
    finally { setAddLoading(false) }
  }

  const loadResults = async () => {
    setResLoading(true)
    setResError('')
    try {
      const res  = await fetch('/api/get-results', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminKey }) })
      const data = await res.json()
      if (res.status === 401) { setResError('Invalid admin key.'); return }
      setResults(data.results || [])
    } catch { setResError('Failed to load results.') }
    finally { setResLoading(false) }
  }

  const loadTranscript = async (email) => {
    setTransLoading(true)
    try {
      const res  = await fetch('/api/get-results', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminKey, email }) })
      const data = await res.json()
      setTranscript(data)
    } catch {}
    finally { setTransLoading(false) }
  }

  if (!authed) {
    return (
      <div className="page">
        <div className="glass-gold fade-in-up" style={{ width: '100%', maxWidth: 400, padding: '40px 36px', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: 16 }}>🔐</div>
          <h2 style={{ marginBottom: 6 }}>Admin Panel</h2>
          <p className="text-secondary" style={{ fontSize: '0.87rem', marginBottom: 26 }}>Enter your admin secret key.</p>
          <input className="input" type="password" placeholder="Admin secret key" value={authKey} onChange={e => setAuthKey(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAuth()} style={{ marginBottom: 12 }} autoFocus />
          <button className="btn btn-gold" style={{ width: '100%' }} onClick={handleAuth} disabled={!authKey.trim()}>Enter Admin Panel</button>
        </div>
      </div>
    )
  }

  return (
    <>
      {transcript && <TranscriptModal data={transcript} onClose={() => setTranscript(null)} />}

      <div className="page" style={{ padding: '28px 16px' }}>
        <div style={{ width: '100%', maxWidth: 700, display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Header */}
          <div className="glass-gold fade-in-up" style={{ padding: '20px 26px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <img src="/logo.png" alt="SJ" style={{ height: 36, width: 'auto', objectFit: 'contain' }} onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }} />
            <div className="sj-logo-icon" style={{ display: 'none' }}>SJ</div>
            <div>
              <div style={{ fontWeight: 700 }}>Admin Panel</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Interview Management</div>
            </div>
            <div style={{ marginLeft: 'auto', padding: '4px 12px', background: 'rgba(80,220,120,0.1)', border: '1px solid rgba(80,220,120,0.3)', borderRadius: 20, fontSize: '0.74rem', fontWeight: 600, color: '#80e8a0' }}>
              Authenticated
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 8 }}>
            {[{ id: TABS.ADD, label: 'Add Emails' }, { id: TABS.RESULTS, label: 'View Results' }].map(t => (
              <button
                key={t.id}
                className={tab === t.id ? 'btn btn-gold' : 'btn btn-ghost'}
                style={{ padding: '10px 22px', fontSize: '0.9rem' }}
                onClick={() => { setTab(t.id); if (t.id === TABS.RESULTS && results.length === 0) loadResults() }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Add Emails tab */}
          {tab === TABS.ADD && (
            <div className="glass fade-in-up" style={{ padding: '26px 28px' }}>
              <h3 style={{ marginBottom: 6 }}>Add Candidate Emails</h3>
              <p className="text-secondary" style={{ fontSize: '0.84rem', marginBottom: 18, lineHeight: 1.6 }}>
                Paste emails below, one per line or comma-separated. Each gets exactly one interview attempt.
                <br />Your email (<strong style={{ color: 'var(--gold)' }}>sarfraz.mb.ahmed2006@gmail.com</strong>) has unlimited access and does not need to be added.
              </p>
              <textarea className="input" rows={7} placeholder={'candidate1@gmail.com\ncandidate2@gmail.com\ncandidate3@outlook.com'} value={emailsText} onChange={e => setEmailsText(e.target.value)} style={{ marginBottom: 14, fontFamily: 'monospace', fontSize: '0.86rem' }} />
              {addResult && <div className={`alert ${addResult.type === 'success' ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: 14, fontSize: '0.86rem' }}>{addResult.msg}</div>}
              <button className="btn btn-gold" onClick={handleAddEmails} disabled={addLoading || !emailsText.trim()}>
                {addLoading ? <><span className="spinner" /> Adding...</> : 'Add to Whitelist'}
              </button>
            </div>
          )}

          {/* Results tab */}
          {tab === TABS.RESULTS && (
            <div className="glass fade-in-up" style={{ padding: '26px 28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <h3>Interview Results</h3>
                <button className="btn btn-ghost" style={{ padding: '8px 16px', fontSize: '0.82rem' }} onClick={loadResults} disabled={resLoading}>
                  {resLoading ? <><span className="spinner" /> Loading...</> : 'Refresh'}
                </button>
              </div>

              {resError && <div className="alert alert-error" style={{ marginBottom: 14 }}>{resError}</div>}

              {results.length === 0 && !resLoading && !resError && (
                <p className="text-muted" style={{ fontSize: '0.85rem' }}>No candidates added yet.</p>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {results.map(r => (
                  <div key={r.email} style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '12px 16px', background: 'rgba(0,0,0,0.2)',
                    borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.87rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.email}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        {r.completedAt ? new Date(r.completedAt).toLocaleString() : r.startedAt ? `Started ${new Date(r.startedAt).toLocaleString()}` : `Added ${new Date(r.addedAt).toLocaleString()}`}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                      {/* Show stars in the main list if they exist in either place */}
                      {(r.transcript?.candidateRating || r.review?.rating) && (
                        <span style={{ fontSize: '0.78rem', color: 'var(--gold)' }}>{'★'.repeat(r.transcript?.candidateRating || r.review?.rating)}</span>
                      )}
                      <StatusBadge record={r} />
                      {r.used && (
                        <button
                          className="btn btn-ghost"
                          style={{ padding: '5px 12px', fontSize: '0.76rem' }}
                          onClick={() => loadTranscript(r.email)}
                          disabled={transLoading}
                        >
                          View Transcript
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ textAlign: 'center' }}>
            <a href="/" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textDecoration: 'none' }}>Back to interview portal</a>
          </div>
        </div>
      </div>
    </>
  )
}