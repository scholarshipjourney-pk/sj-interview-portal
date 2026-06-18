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

// ---- Helper: Convert Blob to Base64 ----
const blobToBase64 = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64data = reader.result.split(',')[1]
      resolve(base64data)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
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
  const videoRef        = useRef(null)
  const timerRef        = useRef(null)
  const questionIdxRef  = useRef(0)
  
  // MediaRecorder Refs for Audio Tracking
  const mediaRecorderRef = useRef(null)
  const audioChunksRef   = useRef([])

  useEffect(() => { messagesRef.current = messages },    [messages])
  useEffect(() => { phaseRef.current    = phase },       [phase])
  useEffect(() => { timeLeftRef.current = timeLeft },    [timeLeft])
  useEffect(() => { questionIdxRef.current = questionIndex }, [questionIndex])

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

    // SAVE THE RECEIPT: Stop them from taking it again on this device
    localStorage.setItem('sj_interview_completed_email', email)

    // KILL HARDWARE
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((track) => track.stop())
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
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


  // =============================================
  // TEXT TO SPEECH (Sentence Chunker to Fix 15s Bug)
  // =============================================
  const speakText = useCallback((text, onEndCallback = null) => {
    const synth = window.speechSynthesis
    synth.cancel() // Stop anything currently playing

    // Split text into sentences so Chrome doesn't timeout after 15 seconds
    const sentences = text.match(/[^.!?]+[.!?]+|\s*[^.!?]+$/g) || [text]
    let currentIndex = 0

    const playNext = () => {
      if (currentIndex >= sentences.length) {
        if (onEndCallback) {
          onEndCallback()
        } else {
          if (phaseRef.current === 'ending' || phaseRef.current === 'ended') return
          setPhase('waiting')
          setStatusLabel('Your turn — press the mic or Spacebar to answer')
        }
        return
      }

      const chunk = sentences[currentIndex].trim()
      if (!chunk) {
        currentIndex++
        playNext()
        return
      }

      const utterance = new SpeechSynthesisUtterance(chunk)
      utterance.rate   = 0.92
      utterance.pitch  = 0.95
      utterance.volume = 1.0

      const maleVoice = getMaleVoice()
      if (maleVoice) utterance.voice = maleVoice

      if (currentIndex === 0) {
        setPhase('ai_speaking')
        setStatusLabel('Sarfraz is speaking...')
      }

      utterance.onend = () => {
        currentIndex++
        playNext()
      }

      utterance.onerror = () => {
        currentIndex++
        playNext() // Keep going even if one chunk errors
      }

      synth.speak(utterance)
    }

    if (synth.getVoices().length > 0) {
      playNext()
    } else {
      synth.onvoiceschanged = playNext
      setTimeout(() => { if (phaseRef.current !== 'ai_speaking') playNext() }, 500)
    }
  }, [])


  // ---- END INTERVIEW — get goodbye from AI, then close ----
  const triggerGoodbye = useCallback(async () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    window.speechSynthesis?.cancel()
    setPhase('ending')
    setStatusLabel('Wrapping up...')

    const endMsg = {
      role: 'user',
      content: '[END_INTERVIEW] The interview is ending. Please give your warm, genuine closing remarks.',
    }
    const endMessages = [...messagesRef.current, endMsg]

    // Fallback text just in case the API drops out at the last second
    let safeReply = "Thank you for taking the time to speak with me today. We appreciate your interest in Scholarship Journey. Our team will review your responses and be in touch soon. Take care, and goodbye!"

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: endMessages }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.reply) safeReply = cleanText(data.reply)
      }
    } catch {
      console.warn("Goodbye API failed, using fallback text.")
    }

    setCurrentAiText(safeReply)
    speakText(safeReply, () => completeInterviewNow())
    
  }, [completeInterviewNow, speakText])


  // ---- Tab change = END interview immediately (With 2-Min Grace Period) ----
  useEffect(() => {
    const checkGracePeriod = () => {
       const timeSpent = TOTAL_SECONDS - timeLeftRef.current
       // If less than 2 mins have passed AND they haven't answered anything, let them refresh without penalty
       return timeSpent < 120 && questionIdxRef.current === 0
    }

    const onHide = () => {
      if (!document.hidden) return
      if (phaseRef.current === 'ended' || phaseRef.current === 'ending') return
      
      // Grace period check
      if (checkGracePeriod()) return

      closedEarlyRef.current  = true
      disqualifiedRef.current = true
      if (!endingFiredRef.current) {
        endingFiredRef.current = true
        clearInterval(timerRef.current)
        completeInterviewNow() 
      }
    }

    const onUnload = () => {
      if (phaseRef.current === 'ended' || phaseRef.current === 'ending') return
      
      // Grace period check
      if (checkGracePeriod()) return

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
      const isEnding = reply.includes('[END_INTERVIEW]') 
      const safeReply = cleanText(reply)

      const withReply = [...updated, { role: 'assistant', content: safeReply }]
      setMessages(withReply)
      messagesRef.current = withReply
      setCurrentAiText(safeReply)
      setQuestionIndex(q => Math.min(q + 1, 5))

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
  // AUDIO RECORDING (Whisper API Upgrade)
  // =============================================
  const startListening = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstart = () => {
        setPhase('listening')
        setStatusLabel('Recording... Speak your answer, then click Stop.')
      }

      mediaRecorder.onstop = async () => {
        setPhase('processing')
        setStatusLabel('Transcribing audio... Please wait.')
        
        // Stop the mic tracks to free up the hardware
        stream.getTracks().forEach(track => track.stop())
        
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        
        try {
          const base64Audio = await blobToBase64(audioBlob)
          
          const res = await fetch('/api/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audio: base64Audio })
          })

          if (!res.ok) throw new Error('Transcription failed')
          
          const data = await res.json()
          const text = data.text?.trim()

          if (text) {
            callAI(text, messagesRef.current)
          } else {
            setPhase('waiting')
            setStatusLabel('No speech detected. Press the mic and try again.')
          }
        } catch (error) {
          console.error('Transcription API error:', error)
          setPhase('waiting')
          setStatusLabel('Transcription error. Press mic to try again or use type option.')
        }
      }

      mediaRecorder.start()
    } catch (err) {
      console.error('Mic error:', err)
      setShowTextInput(true)
      setStatusLabel('Mic blocked or unavailable. Type your answer below.')
    }
  }, [callAI])

  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
  }, [])

  const handleTextSubmit = useCallback(() => {
    const text = textDraft.trim()
    if (!text) return
    setTextDraft('')
    setShowTextInput(false)
    callAI(text, messagesRef.current)
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
              background: isListening ? '#ff6060' : phase === 'ai_speaking' ? 'var(--gold)' : (phase === 'processing' || phase === 'initializing') ? 'rgba(255,255,255,0.2)' : '#80e8a0',
              boxShadow: isListening ? '0 0 8px #ff6060' : phase === 'ai_speaking' ? '0 0 8px var(--gold)' : 'none',
            }} />
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{statusLabel}</span>
          </div>

          {/* Controls */}
          {!isEnding && (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
              
              {/* Recording Status Box */}
              {isListening && (
                <div className="transcript-box" style={{ color: '#ff8080', fontWeight: 'bold' }}>
                  🔴 Recording in progress... Speak your answer, then click Stop.
                </div>
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