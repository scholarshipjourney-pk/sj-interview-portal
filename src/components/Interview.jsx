import { useState, useEffect, useRef, useCallback } from 'react'

const TOTAL_SECONDS = 20 * 60
const WARNING_SECONDS = 3 * 60

/* =============================================
   AI AVATAR ORB
   ============================================= */
function AiOrb({ phase }) {
  const isPulsing = phase === 'ai_speaking' || phase === 'listening'
  return (
    <div className="orb-wrapper">
      {isPulsing && <div className={`orb-ring orb-ring-1 ${isPulsing ? 'pulse' : ''}`} />}
      {isPulsing && <div className={`orb-ring orb-ring-2 ${isPulsing ? 'pulse' : ''}`} />}
      <div
        className={`orb ${
          phase === 'ai_speaking'
            ? 'speaking'
            : phase === 'listening'
            ? 'listening'
            : phase === 'processing'
            ? 'processing'
            : 'idle'
        }`}
      />
    </div>
  )
}

/* =============================================
   TIMER DISPLAY
   ============================================= */
function Timer({ seconds }) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  const pct = (seconds / TOTAL_SECONDS) * 100
  const isWarning = seconds <= WARNING_SECONDS
  const isDanger = seconds <= 60

  const barColor = isDanger
    ? '#ff6060'
    : isWarning
    ? '#FDB302'
    : 'rgba(253,179,2,0.7)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 100 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
          TIME LEFT
        </span>
        <span
          style={{
            fontFamily: 'monospace',
            fontSize: '1.15rem',
            fontWeight: 700,
            color: isDanger ? '#ff6060' : isWarning ? 'var(--gold)' : 'var(--text-white)',
            letterSpacing: '0.06em',
          }}
        >
          {m}:{s}
        </span>
      </div>
      <div className="timer-bar-track">
        <div
          className="timer-bar-fill"
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>
    </div>
  )
}

/* =============================================
   PROGRESS INDICATOR
   ============================================= */
function ProgressDots({ current, total = 5 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginRight: 2 }}>
        Q
      </span>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`progress-dot ${i < current ? 'done' : i === current ? 'current' : ''}`}
        />
      ))}
    </div>
  )
}

/* =============================================
   MAIN INTERVIEW COMPONENT
   ============================================= */
export default function Interview({ email, onComplete }) {
  const [phase, setPhase] = useState('initializing')
  // phases: initializing | ai_speaking | waiting | listening | processing | ending | ended

  const [messages, setMessages] = useState([])
  const [currentAiText, setCurrentAiText] = useState('')
  const [liveTranscript, setLiveTranscript] = useState('')
  const [questionIndex, setQuestionIndex] = useState(0)
  const [timeLeft, setTimeLeft] = useState(TOTAL_SECONDS)
  const [showTextInput, setShowTextInput] = useState(false)
  const [textDraft, setTextDraft] = useState('')
  const [statusLabel, setStatusLabel] = useState('Connecting...')

  // Persistent refs (don't trigger re-renders)
  const messagesRef      = useRef([])
  const phaseRef         = useRef('initializing')
  const timeLeftRef      = useRef(TOTAL_SECONDS)
  const warningFiredRef  = useRef(false)
  const endingFiredRef   = useRef(false)
  const violationsRef    = useRef(0)
  const disqualifiedRef  = useRef(false)
  const recognitionRef   = useRef(null)
  const videoRef         = useRef(null)
  const timerRef         = useRef(null)
  const voicesLoadedRef  = useRef(false)
  const finalTextRef     = useRef('')

  // Keep refs in sync with state
  useEffect(() => { messagesRef.current = messages }, [messages])
  useEffect(() => { phaseRef.current = phase }, [phase])
  useEffect(() => { timeLeftRef.current = timeLeft }, [timeLeft])

  /* --- Camera setup --- */
  useEffect(() => {
    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: 320, height: 240 },
          audio: false,
        })
        if (videoRef.current) videoRef.current.srcObject = stream
      } catch (err) {
        // Camera unavailable: interview still proceeds
      }
    }
    initCamera()
    return () => {
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((t) => t.stop())
      }
    }
  }, [])

  /* --- Pre-load voices --- */
  useEffect(() => {
    const loadVoices = () => { voicesLoadedRef.current = true }
    if (window.speechSynthesis.getVoices().length > 0) {
      voicesLoadedRef.current = true
    } else {
      window.speechSynthesis.addEventListener('voiceschanged', loadVoices)
    }
    return () => window.speechSynthesis.removeEventListener('voiceschanged', loadVoices)
  }, [])

  /* --- Anti-cheat monitoring --- */
  useEffect(() => {
    const onHide = () => {
      if (phaseRef.current === 'ended' || phaseRef.current === 'ending') return
      violationsRef.current += 1
      if (violationsRef.current >= 3) disqualifiedRef.current = true
    }
    const onBlur = () => {
      if (phaseRef.current === 'ended' || phaseRef.current === 'ending') return
      violationsRef.current += 0.5
      if (violationsRef.current >= 3) disqualifiedRef.current = true
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('blur', onBlur)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  /* --- Countdown timer --- */
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        const next = prev - 1
        timeLeftRef.current = next

        if (next <= WARNING_SECONDS && !warningFiredRef.current) {
          warningFiredRef.current = true
        }

        if (next <= 0 && !endingFiredRef.current) {
          endingFiredRef.current = true
          clearInterval(timerRef.current)
          triggerEnd()
          return 0
        }

        return next > 0 ? next : 0
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [])

  /* --- Kick off the interview --- */
  useEffect(() => {
    const t = setTimeout(() => {
      callAI('START_INTERVIEW', [])
    }, 800)
    return () => clearTimeout(t)
  }, [])

  /* ============================================
     CORE AI CALL
     ============================================ */
  const callAI = useCallback(async (userContent, currentMessages) => {
    setPhase('processing')
    setStatusLabel('Alex is thinking...')

    let content = userContent
    if (warningFiredRef.current && !content.includes('[TIME_WARNING]') && content !== 'START_INTERVIEW') {
      content = `${content} [TIME_WARNING]`
    }

    const newMsg = { role: 'user', content }
    const updated = userContent === 'START_INTERVIEW' ? [newMsg] : [...currentMessages, newMsg]

    setMessages(updated)
    messagesRef.current = updated

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updated }),
      })

      if (!res.ok) throw new Error('API error')

      const { reply } = await res.json()
      const withReply = [...updated, { role: 'assistant', content: reply }]

      setMessages(withReply)
      messagesRef.current = withReply
      setCurrentAiText(reply)
      setQuestionIndex((q) => Math.min(q + 1, 5))
      speakText(reply, withReply)
    } catch (err) {
      setStatusLabel('Connection issue. Please try again.')
      setPhase('waiting')
    }
  }, [])

  /* ============================================
     TEXT-TO-SPEECH
     ============================================ */
  const speakText = useCallback((text, afterMessages) => {
    const synth = window.speechSynthesis
    synth.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.92
    utterance.pitch = 1.0
    utterance.volume = 1.0

    const voices = synth.getVoices()
    const preferred =
      voices.find((v) => v.name === 'Google US English') ||
      voices.find((v) => v.name === 'Samantha') ||
      voices.find((v) => v.name === 'Alex') ||
      voices.find((v) => v.name.includes('Daniel')) ||
      voices.find((v) => v.lang === 'en-US' && v.localService) ||
      voices.find((v) => v.lang.startsWith('en'))
    if (preferred) utterance.voice = preferred

    setPhase('ai_speaking')
    setStatusLabel('Alex is speaking...')

    utterance.onend = () => {
      if (phaseRef.current === 'ending' || phaseRef.current === 'ended') return
      setPhase('waiting')
      setStatusLabel('Your turn — press the mic to answer')
    }

    utterance.onerror = () => {
      if (phaseRef.current === 'ending' || phaseRef.current === 'ended') return
      setPhase('waiting')
      setStatusLabel('Your turn — press the mic to answer')
    }

    synth.speak(utterance)
  }, [])

  /* ============================================
     END INTERVIEW FLOW
     ============================================ */
  const triggerEnd = useCallback(async () => {
    if (recognitionRef.current) recognitionRef.current.stop()
    window.speechSynthesis?.cancel()
    setPhase('ending')
    setStatusLabel('Wrapping up...')

    const endMsg = {
      role: 'user',
      content: '[END_INTERVIEW] The 20 minutes are up. Please give your warm closing remarks.',
    }
    const endMessages = [...messagesRef.current, endMsg]

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: endMessages }),
      })
      const { reply } = await res.json()
      setCurrentAiText(reply)

      const synth = window.speechSynthesis
      const utterance = new SpeechSynthesisUtterance(reply)
      utterance.rate = 0.88
      utterance.onend = () => {
        completeInterview()
      }
      utterance.onerror = () => {
        completeInterview()
      }
      synth.speak(utterance)
    } catch {
      completeInterview()
    }
  }, [])

  const completeInterview = useCallback(async () => {
    setPhase('ended')
    setStatusLabel('Interview complete')

    try {
      await fetch('/api/complete-interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, disqualified: disqualifiedRef.current }),
      })
    } catch {
      // Best effort
    }

    setTimeout(() => onComplete(), 1800)
  }, [email, onComplete])

  /* ============================================
     SPEECH RECOGNITION
     ============================================ */
  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      setShowTextInput(true)
      setStatusLabel('Type your answer below')
      return
    }

    const recognition = new SR()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'
    finalTextRef.current = ''

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
      if (text) {
        setLiveTranscript('')
        callAI(text, messagesRef.current)
      } else {
        setPhase('waiting')
        setStatusLabel('No speech detected. Press the mic to try again.')
        setLiveTranscript('')
      }
    }

    recognition.onerror = (e) => {
      if (e.error === 'no-speech') {
        setPhase('waiting')
        setStatusLabel('No speech detected. Press the mic to try again.')
      } else if (e.error === 'not-allowed') {
        setShowTextInput(true)
        setStatusLabel('Mic blocked. Type your answer below.')
      } else {
        setPhase('waiting')
        setStatusLabel('Mic error. Press to try again or type below.')
      }
      setLiveTranscript('')
    }

    recognitionRef.current = recognition
    setPhase('listening')
    setStatusLabel('Listening... speak your answer')
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
    callAI(text, messagesRef.current)
  }, [textDraft, callAI])

  /* ============================================
     DERIVED FLAGS
     ============================================ */
  const canInteract = phase === 'waiting' || showTextInput
  const isListening = phase === 'listening'
  const isEnding = phase === 'ending' || phase === 'ended'
  const timeIsWarning = timeLeft <= WARNING_SECONDS
  const timeIsDanger = timeLeft <= 60

  /* ============================================
     RENDER
     ============================================ */
  return (
    <div
      style={{
        position: 'relative',
        zIndex: 1,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        padding: '16px',
      }}
    >
      {/* ---- TOP BAR ---- */}
      <div
        className="glass"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 20px',
          marginBottom: 16,
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div className="sj-logo-icon" style={{ width: 34, height: 34, fontSize: '1rem', borderRadius: 8 }}>
            SJ
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Alex Chen</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Senior Recruiter, Scholarship Journey
            </div>
          </div>
        </div>

        <div className="status-badge live">
          <div className="status-dot" />
          LIVE
        </div>

        <Timer seconds={timeLeft} />
      </div>

      {/* ---- MAIN CONTENT ---- */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>

        {/* Left: AI Interviewer panel */}
        <div
          className="glass-gold"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '32px 28px',
            gap: 24,
          }}
        >
          {/* Progress */}
          <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <ProgressDots current={questionIndex} total={5} />
            <div
              style={{
                fontSize: '0.78rem',
                color: timeIsDanger ? '#ff8080' : timeIsWarning ? 'var(--gold)' : 'var(--text-muted)',
                fontWeight: timeIsWarning ? 600 : 400,
              }}
            >
              {timeIsDanger
                ? 'Almost done!'
                : timeIsWarning
                ? 'Wrapping up soon'
                : 'AI Interview in Progress'}
            </div>
          </div>

          {/* AI Orb */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28, minHeight: 280 }}>
            <AiOrb phase={phase} />

            {/* AI speech text */}
            <div
              style={{
                textAlign: 'center',
                maxWidth: 500,
                width: '100%',
              }}
            >
              {phase === 'initializing' || phase === 'processing' ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--text-muted)' }}>
                  <span className="spinner" />
                  <span style={{ fontSize: '0.9rem' }}>{statusLabel}</span>
                </div>
              ) : (
                <p
                  style={{
                    fontSize: '1.05rem',
                    lineHeight: 1.7,
                    color: phase === 'ai_speaking' ? 'var(--text-white)' : 'var(--text-secondary)',
                    transition: 'color 0.3s',
                  }}
                >
                  {currentAiText || ''}
                </p>
              )}
            </div>
          </div>

          {/* Status indicator */}
          <div
            style={{
              width: '100%',
              padding: '10px 16px',
              background: 'rgba(0,0,0,0.2)',
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: isListening
                  ? '#60d0ff'
                  : phase === 'ai_speaking'
                  ? 'var(--gold)'
                  : phase === 'processing' || phase === 'initializing'
                  ? 'rgba(255,255,255,0.3)'
                  : '#80e8a0',
                boxShadow: isListening ? '0 0 8px #60d0ff' : phase === 'ai_speaking' ? '0 0 8px var(--gold)' : 'none',
                flexShrink: 0,
                transition: 'all 0.3s',
              }}
            />
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              {statusLabel}
            </span>
          </div>

          {/* Controls */}
          {!isEnding && (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Live transcript */}
              {(isListening || liveTranscript) && (
                <div className="transcript-box">
                  {liveTranscript || 'Listening...'}
                </div>
              )}

              {/* Text fallback input */}
              {showTextInput && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="input"
                    placeholder="Type your answer and press Enter..."
                    value={textDraft}
                    onChange={(e) => setTextDraft(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleTextSubmit()}
                    autoFocus
                  />
                  <button
                    className="btn btn-gold"
                    style={{ padding: '14px 20px', flexShrink: 0 }}
                    onClick={handleTextSubmit}
                    disabled={!textDraft.trim()}
                  >
                    Send
                  </button>
                </div>
              )}

              {/* Mic button row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                <button
                  className={`mic-btn ${isListening ? 'recording' : ''}`}
                  onClick={isListening ? stopListening : startListening}
                  disabled={!canInteract && !isListening}
                  title={isListening ? 'Click to stop recording' : 'Click to answer'}
                >
                  {isListening ? '⏹' : '🎙️'}
                </button>

                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                    {isListening ? 'Recording... click to stop' : canInteract ? 'Press to answer' : 'Please wait'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {isListening
                      ? 'Speak clearly into your microphone'
                      : 'or use keyboard shortcut Space'}
                  </div>
                </div>

                {!showTextInput && (
                  <button
                    className="btn btn-ghost"
                    style={{ padding: '8px 14px', fontSize: '0.78rem', marginLeft: 'auto' }}
                    onClick={() => { setShowTextInput(true); setStatusLabel('Type your answer below') }}
                    disabled={!canInteract}
                  >
                    ⌨️ Type instead
                  </button>
                )}
              </div>
            </div>
          )}

          {isEnding && (
            <div className="alert alert-success" style={{ width: '100%', textAlign: 'center' }}>
              Interview complete. Redirecting to results...
            </div>
          )}
        </div>

        {/* Right: Candidate video + transcript log */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Camera feed */}
          <div
            className="glass"
            style={{ padding: 12, aspectRatio: '4/3', position: 'relative', overflow: 'hidden' }}
          >
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="candidate-video"
              style={{ borderRadius: 10 }}
            />
            <div
              style={{
                position: 'absolute',
                top: 18,
                left: 18,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: 'rgba(0,0,0,0.5)',
                backdropFilter: 'blur(8px)',
                padding: '3px 10px',
                borderRadius: 20,
                fontSize: '0.72rem',
                fontWeight: 600,
                color: '#ff8080',
              }}
            >
              <div className="status-dot" style={{ width: 5, height: 5 }} />
              YOU
            </div>
          </div>

          {/* Conversation log */}
          <div
            className="glass"
            style={{
              flex: 1,
              padding: '16px',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--text-muted)',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                marginBottom: 12,
              }}
            >
              Conversation Log
            </div>
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              {messages
                .filter((m) => !m.content.includes('START_INTERVIEW') && !m.content.includes('[END_INTERVIEW]'))
                .map((m, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 10,
                      fontSize: '0.78rem',
                      lineHeight: 1.55,
                      background:
                        m.role === 'assistant'
                          ? 'rgba(253,179,2,0.08)'
                          : 'rgba(255,255,255,0.05)',
                      borderLeft: `2px solid ${m.role === 'assistant' ? 'var(--gold)' : 'rgba(255,255,255,0.2)'}`,
                      color: m.role === 'assistant' ? 'var(--text-white)' : 'var(--text-secondary)',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '0.66rem',
                        fontWeight: 700,
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                        color: m.role === 'assistant' ? 'var(--gold)' : 'var(--text-muted)',
                        marginBottom: 4,
                      }}
                    >
                      {m.role === 'assistant' ? 'Alex' : 'You'}
                    </div>
                    {m.content
                      .replace('[TIME_WARNING]', '')
                      .replace('[END_INTERVIEW] The 20 minutes are up. Please give your warm closing remarks.', '')}
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* Keyboard shortcut: Space to start/stop listening */}
      <SpaceKeyListener
        onSpace={() => {
          if (isListening) stopListening()
          else if (canInteract) startListening()
        }}
        active={!isEnding}
      />
    </div>
  )
}

/* Spacebar shortcut helper */
function SpaceKeyListener({ onSpace, active }) {
  useEffect(() => {
    if (!active) return
    const handler = (e) => {
      if (
        e.code === 'Space' &&
        e.target.tagName !== 'INPUT' &&
        e.target.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault()
        onSpace()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [active, onSpace])
  return null
}
