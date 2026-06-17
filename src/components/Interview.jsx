import { useState, useEffect, useRef, useCallback } from 'react'

const TOTAL_SECONDS  = 20 * 60  // 20 minutes
const WARNING_SECONDS = 3 * 60  // warn at 3 minutes remaining

// ---- Strip internal flags from any text before displaying or speaking ----
function cleanText(text) {
  return (text || '')
    .replace(/\[TIME_WARNING\]/gi, '')
    .replace(/\[END_INTERVIEW[^\]]*\]/gi, '')
    .replace(/TIME_WARNING/g, '')
    .replace(/END_INTERVIEW/g, '')
    .trim()
}

// ---- Pick a male English voice ----
function getMaleVoice() {
  const voices = window.speechSynthesis.getVoices()
  return (
    voices.find(v => v.name.includes('Male') || v.name.includes('Alex') || v.name.includes('Daniel') || v.name.includes('David')) ||
    voices.find(v => v.name === 'Google US English') ||
    voices.find(v => v.name === 'Google UK English Male') ||
    voices.find(v => v.name === 'Microsoft David Desktop - English (United States)') ||
    voices.find(v =>
      v.lang === 'en-US' &&
      v.localService &&
      !v.name.toLowerCase().match(/zira|female|aria|jenny|sonia|libby|natasha|hazel|susan/)
    ) ||
    voices.find(v => v.lang.startsWith('en'))
  )
}

// ---- AI Avatar Orb ----
function AiOrb({ phase }) {
  const pulse = phase === 'ai_speaking' || phase === 'listening'
  return (
    <div className="orb-wrapper">
      {pulse && <div className={`orb-ring orb-ring-1 pulse`} />}
      {pulse && <div className={`orb-ring orb-ring-2 pulse`} />}
      <div
        className={`orb ${
          phase === 'ai_speaking' ? 'speaking'
          : phase === 'listening' ? 'listening'
          : phase === 'processing' ? 'processing'
          : 'idle'
        }`}
      />
    </div>
  )
}

// ---- Timer display ----
function Timer({ seconds }) {
  const m   = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s   = (seconds % 60).toString().padStart(2, '0')
  const pct = (seconds / TOTAL_SECONDS) * 100
  const warn   = seconds <= WARNING_SECONDS
  const danger = seconds <= 60

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 110 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
          TIME LEFT
        </span>
        <span style={{
          fontFamily: 'monospace',
          fontSize: '1.15rem',
          fontWeight: 700,
          color: danger ? '#ff6060' : warn ? 'var(--gold)' : 'var(--text-white)',
          letterSpacing: '0.06em',
        }}>
          {m}:{s}
        </span>
      </div>
      <div className="timer-bar-track">
        <div className="timer-bar-fill" style={{
          width: `${pct}%`,
          background: danger ? '#ff6060' : warn ? 'var(--gold)' : 'rgba(253,179,2,0.7)',
        }} />
      </div>
    </div>
  )
}

// ---- Progress dots ----
function ProgressDots({ current, total = 5 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginRight: 2 }}>Q</span>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`progress-dot ${i < current ? 'done' : i === current ? 'current' : ''}`}
        />
      ))}
    </div>
  )
}

// =============================================
// MAIN INTERVIEW COMPONENT
// =============================================
export default function Interview({ email, onComplete }) {
  const [phase, setPhase]             = useState('initializing')
  const [messages, setMessages]       = useState([])
  const [currentAiText, setCurrentAiText] = useState('')
  const [liveTranscript, setLiveTranscript] = useState('')
  const [questionIndex, setQuestionIndex] = useState(0)
  const [timeLeft, setTimeLeft]       = useState(TOTAL_SECONDS)
  const [showTextInput, setShowTextInput] = useState(false)
  const [textDraft, setTextDraft]     = useState('')
  const [statusLabel, setStatusLabel] = useState('Connecting...')

  // Refs that persist across renders
  const messagesRef     = useRef([])
  const phaseRef        = useRef('initializing')
  const timeLeftRef     = useRef(TOTAL_SECONDS)
  const warningFiredRef = useRef(false)
  const endingFiredRef  = useRef(false)
  const disqualifiedRef = useRef(false)
  const closedEarlyRef  = useRef(false)
  const recognitionRef  = useRef(null)
  const videoRef        = useRef(null)
  const timerRef        = useRef(null)
  const finalTextRef    = useRef('')

  useEffect(() => { messagesRef.current = messages },    [messages])
  useEffect(() => { phaseRef.current    = phase },       [phase])
  useEffect(() => { timeLeftRef.current = timeLeft },    [timeLeft])

  // ---- Camera ----
  useEffect(() => {
    const init = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: 320, height: 240 },
          audio: false,
        })
        if (videoRef.current) videoRef.current.srcObject = stream
      } catch {}
    }
    init()
    return () => {
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(t => t.stop())
      }
    }
  }, [])

  // ---- Pre-load voices ----
  useEffect(() => {
    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.addEventListener('voiceschanged', () => {})
    }
  }, [])

  // ---- SAVE AND REDIRECT (HARDWARE KILL) ----
  const completeInterviewNow = useCallback(async () => {
    setPhase('ended')
    setStatusLabel('Interview complete')

    // KILL HARDWARE: Explicitly stop camera and mic
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((track) => track.stop())
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
    window.speechSynthesis?.cancel()

    try {
      await fetch('/api/complete-interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          disqualified: disqualifiedRef.current,
          closedEarly:  closedEarlyRef.current,
          messages:     messagesRef.current,
        }),
      })
    } catch {}

    setTimeout(() => onComplete(), 1500)
  }, [email, onComplete])

  // ---- END INTERVIEW — get goodbye from AI, then close ----
  const triggerGoodbye = useCallback(async () => {
    if (recognitionRef.current) recognitionRef.current.stop()
    window.speechSynthesis?.cancel()
    setPhase('ending')
    setStatusLabel('Wrapping up...')

    const endMsg = {
      role: 'user',
      content: '[END_INTERVIEW] The interview is ending. Please give your warm, genuine closing remarks.',
    }
    const endMessages = [...messagesRef.current, endMsg]

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: endMessages }),
      })
      const { reply } = await res.json()
      const safeReply = cleanText(reply)

      setCurrentAiText(safeReply)

      const synth     = window.speechSynthesis
      const utterance = new SpeechSynthesisUtterance(safeReply)
      utterance.rate  = 0.88
      utterance.pitch = 0.95

      const maleVoice = getMaleVoice()
      if (maleVoice) utterance.voice = maleVoice

      let done = false
      const finish = () => {
        if (done) return
        done = true
        completeInterviewNow()
      }

      utterance.onend  = finish
      utterance.onerror = finish
      const estimatedMs = Math.max(6000, safeReply.length * 75)
      setTimeout(finish, estimatedMs + 3000)

      synth.speak(utterance)
    } catch {
      completeInterviewNow()
    }
  }, [completeInterviewNow])


  // ---- Tab change = END interview immediately ----
  useEffect(() => {
    const onHide = () => {
      if (!document.hidden) return
      if (phaseRef.current === 'ended' || phaseRef.current === 'ending') return
      closedEarlyRef.current  = true
      disqualifiedRef.current = true
      if (!endingFiredRef.current) {
        endingFiredRef.current = true
        clearInterval(timerRef.current)
        completeInterviewNow() // Includes the hardware kill logic
      }
    }

    const onUnload = () => {
      navigator.sendBeacon(
        '/api/complete-interview',
        JSON.stringify({
          email,
          disqualified: true,
          closedEarly: true,
          messages: messagesRef.current,
        })
      )
    }

    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('beforeunload', onUnload)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('beforeunload', onUnload)
    }
  }, [email, completeInterviewNow])

  // ---- Countdown timer ----
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        const next = prev - 1
        timeLeftRef.current = next

        if (next <= WARNING_SECONDS && !warningFiredRef.current) {
          warningFiredRef.current = true
        }

        if (next <= 0 && !endingFiredRef.current) {
          endingFiredRef.current = true
          clearInterval(timerRef.current)
          triggerGoodbye()
          return 0
        }

        return next > 0 ? next : 0
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [triggerGoodbye])


  // =============================================
  // TEXT TO SPEECH (Robust Voice Loading)
  // =============================================
  const speakText = useCallback((text, onEndCallback = null) => {
    const synth = window.speechSynthesis
    synth.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate   = 0.92
    utterance.pitch  = 0.95
    utterance.volume = 1.0

    const setVoiceAndSpeak = () => {
      const maleVoice = getMaleVoice()
      // If our preferred male voice exists, use it. Otherwise, let the browser use its default.
      if (maleVoice) utterance.voice = maleVoice
      
      setPhase('ai_speaking')
      setStatusLabel('Sarfraz is speaking...')
      synth.speak(utterance)
    }

    // Handle asynchronous voice loading to prevent the female fallback bug
    if (synth.getVoices().length > 0) {
      setVoiceAndSpeak()
    } else {
      synth.onvoiceschanged = setVoiceAndSpeak
      // Safety net: if voices never load, force speak after 500ms
      setTimeout(() => { if (phaseRef.current !== 'ai_speaking') setVoiceAndSpeak() }, 500)
    }

    const handleEnd = () => {
      if (onEndCallback) {
        onEndCallback()
        return
      }
      if (phaseRef.current === 'ending' || phaseRef.current === 'ended') return
      setPhase('waiting')
      setStatusLabel('Your turn — press the mic or Spacebar to answer')
    }

    utterance.onend = handleEnd
    utterance.onerror = handleEnd
    
    // Safety fallback: If TTS completely breaks in a weird browser, unlock the mic after an estimated time
    const estimatedMs = Math.max(3000, text.length * 60)
    setTimeout(() => {
      if (phaseRef.current === 'ai_speaking') handleEnd()
    }, estimatedMs + 2000)

  }, [])


  // =============================================
  // CALL GROQ AI
  // =============================================
  const callAI = useCallback(async (userContent, currentMessages) => {
    setPhase('processing')
    setStatusLabel('Sarfraz is thinking...')

    let content = userContent
    if (
      warningFiredRef.current &&
      userContent !== 'START_INTERVIEW' &&
      !userContent.includes('[TIME_WARNING]')
    ) {
      content = `${userContent} [TIME_WARNING]`
    }

    const newMsg  = { role: 'user', content }
    const updated = userContent === 'START_INTERVIEW'
      ? [newMsg]
      : [...currentMessages, newMsg]

    setMessages(updated)
    messagesRef.current = updated

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updated }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const { reply } = await res.json()
      const isEnding = reply.includes('[END_INTERVIEW]') // Catch AI finishing early
      const safeReply = cleanText(reply)

      const withReply = [...updated, { role: 'assistant', content: safeReply }]
      setMessages(withReply)
      messagesRef.current = withReply
      setCurrentAiText(safeReply)
      setQuestionIndex(q => Math.min(q + 1, 5))

      // If AI decided to end the interview, trigger shutdown after speaking
      if (isEnding) {
        speakText(safeReply, () => completeInterviewNow())
      } else {
        speakText(safeReply)
      }

    } catch (err) {
      console.error('callAI error:', err)
      setStatusLabel('Connection issue. Press the mic to try again.')
      setPhase('waiting')
    }
  }, [speakText, completeInterviewNow])


  // ---- Kick off the interview ----
  useEffect(() => {
    const t = setTimeout(() => callAI('START_INTERVIEW', []), 900)
    return () => clearTimeout(t)
  }, [callAI])


  // =============================================
  // SPEECH RECOGNITION (Popup removed)
  // =============================================
  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      setShowTextInput(true)
      setStatusLabel('Type your answer below')
      return
    }

    const recognition        = new SR()
    recognition.continuous   = true
    recognition.interimResults = true
    recognition.lang         = 'en-US'
    finalTextRef.current     = ''

    recognition.onresult = (event) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTextRef.current += event.results[i][0].transcript + ' '
        } else {
          interim += event.results[i][0].transcript
        }
      }
      setLiveTranscript(finalTextRef.current + interim)
    }

    recognition.onend = () => {
      const text = finalTextRef.current.trim()
      setLiveTranscript('')
      if (text) {
        callAI(text, messagesRef.current) // Calls AI directly, no popup
      } else {
        setPhase('waiting')
        setStatusLabel('No speech detected. Press the mic and try again.')
      }
    }

    recognition.onerror = (e) => {
      setLiveTranscript('')
      if (e.error === 'not-allowed') {
        setShowTextInput(true)
        setStatusLabel('Mic blocked. Type your answer below.')
      } else {
        setPhase('waiting')
        setStatusLabel('Mic error. Press to try again or use the type option.')
      }
    }

    recognitionRef.current = recognition
    setPhase('listening')
    setStatusLabel('Listening... speak your answer clearly')
    recognition.start()
  }, [callAI])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) recognitionRef.current.stop()
  }, [])

  const handleTextSubmit = useCallback(() => {
    const text = textDraft.trim()
    if (!text) return
    setTextDraft('')
    setShowTextInput(false)
    callAI(text, messagesRef.current) // Calls AI directly, no popup
  }, [textDraft, callAI])

  // Spacebar shortcut
  useEffect(() => {
    const handler = (e) => {
      if (e.code !== 'Space') return
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (phase === 'ended' || phase === 'ending') return
      e.preventDefault()
      if (phase === 'listening') stopListening()
      else if (phase === 'waiting') startListening()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [phase, startListening, stopListening])

  const canInteract  = phase === 'waiting'
  const isListening  = phase === 'listening'
  const isEnding     = phase === 'ending' || phase === 'ended'
  const timeWarn     = timeLeft <= WARNING_SECONDS
  const timeDanger   = timeLeft <= 60

  // Clean conversation for display
  const displayMessages = messages
    .filter(m =>
      m.content !== 'START_INTERVIEW' &&
      !m.content.includes('[END_INTERVIEW]')
    )
    .map(m => ({
      ...m,
      content: cleanText(m.content),
    }))
    .filter(m => m.content.length > 0)

  return (
    <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'flex', flexDirection: 'column', padding: 16 }}>

      {/* TOP BAR */}
      <div className="glass" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', marginBottom: 16, gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img
            src="/logo.png"
            alt="Scholarship Journey"
            style={{ height: 36, width: 'auto', objectFit: 'contain' }}
            onError={e => {
              e.target.style.display = 'none'
              e.target.nextSibling.style.display = 'flex'
            }}
          />
          <div
            className="sj-logo-icon"
            style={{ width: 34, height: 34, fontSize: '0.9rem', borderRadius: 8, display: 'none' }}
          >
            SJ
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Sarfraz Ahmed</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Scholarship Journey</div>
          </div>
        </div>

        <div className="status-badge live">
          <div className="status-dot" />
          LIVE
        </div>

        <Timer seconds={timeLeft} />
      </div>

      {/* MAIN CONTENT */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>

        {/* LEFT: AI panel */}
        <div className="glass-gold" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 24px', gap: 20 }}>

          {/* Progress + status */}
          <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <ProgressDots current={questionIndex} total={5} />
            <div style={{
              fontSize: '0.78rem',
              color: timeDanger ? '#ff8080' : timeWarn ? 'var(--gold)' : 'var(--text-muted)',
              fontWeight: timeWarn ? 600 : 400,
            }}>
              {timeDanger ? 'Wrapping up soon' : timeWarn ? 'Final question' : 'Interview in progress'}
            </div>
          </div>

          {/* Orb + AI text */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28, minHeight: 260, width: '100%' }}>
            <AiOrb phase={phase} />

            <div style={{ textAlign: 'center', maxWidth: 520, width: '100%' }}>
              {(phase === 'initializing' || phase === 'processing') ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--text-muted)' }}>
                  <span className="spinner" />
                  <span style={{ fontSize: '0.9rem' }}>{statusLabel}</span>
                </div>
              ) : (
                <p style={{
                  fontSize: '1.05rem',
                  lineHeight: 1.75,
                  color: phase === 'ai_speaking' ? 'var(--text-white)' : 'var(--text-secondary)',
                  transition: 'color 0.3s',
                }}>
                  {currentAiText}
                </p>
              )}
            </div>
          </div>

          {/* Status bar */}
          <div style={{ width: '100%', padding: '10px 16px', background: 'rgba(0,0,0,0.2)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%', flexShrink: 0, transition: 'all 0.3s',
              background: isListening ? '#60d0ff' : phase === 'ai_speaking' ? 'var(--gold)' : (phase === 'processing' || phase === 'initializing') ? 'rgba(255,255,255,0.2)' : '#80e8a0',
              boxShadow: isListening ? '0 0 8px #60d0ff' : phase === 'ai_speaking' ? '0 0 8px var(--gold)' : 'none',
            }} />
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{statusLabel}</span>
          </div>

          {/* Controls */}
          {!isEnding && (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Live transcript */}
              {(isListening || liveTranscript) && (
                <div className="transcript-box">{liveTranscript || 'Listening...'}</div>
              )}

              {/* Text fallback */}
              {showTextInput && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="input"
                    placeholder="Type your answer and press Enter..."
                    value={textDraft}
                    onChange={e => setTextDraft(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleTextSubmit()}
                    autoFocus
                  />
                  <button className="btn btn-gold" style={{ padding: '14px 18px', flexShrink: 0 }} onClick={handleTextSubmit} disabled={!textDraft.trim()}>
                    Send
                  </button>
                </div>
              )}

              {/* Mic row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                <button
                  className={`mic-btn ${isListening ? 'recording' : ''}`}
                  onClick={isListening ? stopListening : startListening}
                  disabled={!canInteract && !isListening}
                  title={isListening ? 'Click to stop' : 'Click to answer'}
                >
                  {isListening ? '⏹' : '🎙️'}
                </button>

                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                    {isListening ? 'Recording... click to stop' : canInteract ? 'Press mic to answer' : 'Please wait'}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    {isListening ? 'Speak clearly into your microphone' : 'or press Spacebar'}
                  </div>
                </div>

                {!showTextInput && (
                  <button
                    className="btn btn-ghost"
                    style={{ padding: '8px 14px', fontSize: '0.78rem', marginLeft: 'auto' }}
                    onClick={() => { setShowTextInput(true); setStatusLabel('Type your answer below') }}
                    disabled={!canInteract}
                  >
                    Type instead
                  </button>
                )}
              </div>
            </div>
          )}

          {isEnding && (
            <div className="alert alert-success" style={{ width: '100%', textAlign: 'center' }}>
              Interview complete. Redirecting...
            </div>
          )}
        </div>

        {/* RIGHT: Camera + conversation log */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Camera */}
          <div className="glass" style={{ padding: 10, aspectRatio: '4/3', position: 'relative', overflow: 'hidden' }}>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="candidate-video"
              style={{ borderRadius: 8 }}
            />
            <div style={{
              position: 'absolute', top: 14, left: 14,
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
              padding: '3px 10px', borderRadius: 20,
              fontSize: '0.7rem', fontWeight: 700, color: '#ff8080',
            }}>
              <div className="status-dot" style={{ width: 5, height: 5 }} />
              YOU
            </div>
          </div>

          {/* Conversation log */}
          <div className="glass" style={{ flex: 1, padding: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 10 }}>
              Conversation Log
            </div>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {displayMessages.map((m, i) => (
                <div key={i} style={{
                  padding: '8px 10px', borderRadius: 8, fontSize: '0.76rem', lineHeight: 1.55,
                  background: m.role === 'assistant' ? 'rgba(253,179,2,0.08)' : 'rgba(255,255,255,0.04)',
                  borderLeft: `2px solid ${m.role === 'assistant' ? 'var(--gold)' : 'rgba(255,255,255,0.15)'}`,
                  color: m.role === 'assistant' ? 'var(--text-white)' : 'var(--text-secondary)',
                }}>
                  <div style={{ fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: m.role === 'assistant' ? 'var(--gold)' : 'var(--text-muted)', marginBottom: 3 }}>
                    {m.role === 'assistant' ? 'Sarfraz' : 'You'}
                  </div>
                  {m.content}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}