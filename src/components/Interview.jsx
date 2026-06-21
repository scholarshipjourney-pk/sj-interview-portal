import { useState, useEffect, useRef, useCallback } from 'react'

const TOTAL_SECONDS   = 20 * 60
const WARNING_SECONDS = 3 * 60
const MAX_RECORD_MS   = 3 * 60 * 1000
const MAX_AUDIO_B64   = 10 * 1024 * 1024

// =============================================
// PLATFORM DETECTION
// =============================================
const ua = navigator.userAgent

const IS_IOS     = /iPad|iPhone|iPod/.test(ua) && !window.MSStream
const IS_MAC     = /Macintosh/.test(ua) && !IS_IOS
const IS_ANDROID = /Android/.test(ua)
const IS_WINDOWS = /Windows/.test(ua)
const IS_LINUX   = /Linux/.test(ua) && !IS_ANDROID
const IS_SAFARI  = /^((?!chrome|android).)*safari/i.test(ua)
const IS_FIREFOX = /Firefox/.test(ua)
const IS_MOBILE  = IS_IOS || IS_ANDROID

// TTS on iOS Safari and Android Chrome both pause when screen dims or
// tab loses focus. Keepalive needed on all mobile browsers.
const NEEDS_KEEPALIVE = IS_MOBILE

// Slower TTS rate on mobile for clarity, even slower on iOS Safari
const TTS_RATE = IS_IOS ? 0.85 : IS_MOBILE ? 0.88 : 0.92

// Delay between sentences to avoid the iOS restart glitch
const SENTENCE_GAP_MS = IS_IOS ? 160 : IS_ANDROID ? 100 : 60

// Delay before first utterance after synth.cancel()
const TTS_START_DELAY_MS = IS_IOS ? 220 : IS_ANDROID ? 100 : 50

// =============================================
// AUDIO MIME TYPE (Safari records MP4, not WebM)
// =============================================
function getBestAudioMimeType() {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mp4',   // Safari / iOS fallback
  ]
  if (typeof MediaRecorder === 'undefined') return ''
  for (const type of types) {
    try {
      if (MediaRecorder.isTypeSupported(type)) return type
    } catch {}
  }
  return ''
}

// =============================================
// VOICE SELECTION - ALL PLATFORMS
// =============================================
function getBestMaleVoice() {
  const voices = window.speechSynthesis.getVoices()
  if (!voices || voices.length === 0) return null

  const english = voices.filter(v => v.lang && v.lang.startsWith('en'))
  if (english.length === 0) return null

  // Known female voice name patterns across ALL platforms and browsers
  const FEMALE = /zira|female|aria|jenny|sonia|libby|natasha|hazel|susan|karen|samantha|victoria|moira|tessa|fiona|cortana|eva|linda|heera|claire|allison|ava|kathy|princess|vicki|nora|ellen|serena|veena|sangeeta|emma|alice|grace|lisa|kate|sarah|emily|anna|martha|joanna|ivy|kendra|kimberly|salli|nicole|celine|chantal|amelie|audrey|maged|tamar/i

  // Priority list covering all platforms in order of quality
  const PRIORITY = [
    // Windows 11 - Edge natural voices (best quality on Windows)
    'Microsoft Guy Online (Natural)',
    'Microsoft Roger Online (Natural)',
    'Microsoft Christopher Online (Natural)',
    'Microsoft Eric Online (Natural)',
    'Microsoft Davis Online (Natural)',
    'Microsoft Ryan Online (Natural)',
    // Windows - Chrome and Firefox
    'Google UK English Male',
    'Microsoft David - English (United States)',
    'Microsoft David Desktop - English (United States)',
    'Microsoft Mark - English (United States)',
    // macOS and iOS / iPadOS - Safari, Chrome, Firefox
    'Daniel',     // UK male - available on all Apple devices
    'Arthur',     // UK male - macOS Monterey+
    'Rishi',      // Indian English male - Apple (sounds natural for SJ use case)
    'Oliver',     // UK male - Apple
    'Fred',       // older macOS male
    'Junior',     // macOS
    'Alex',       // older macOS, still present on many machines
    // Android Chrome / Samsung Browser
    'Google UK English Male',   // repeated explicitly for Android
    'en-us-x-iol-local',        // Android offline male voice
    'en-GB-x-gbd-local',        // Android offline UK male
    'en-US-language',
    // Linux - Chrome has Google voices, Firefox uses eSpeak
    'Google UK English Male',
    'English (Great Britain)',   // eSpeak on Linux (Firefox)
    // Generic male keywords as last resort
    'Male',
    'en-US-Guy',
    'en-GB-Male',
    'Guy',
  ]

  // Try exact or substring match against priority list
  for (const name of PRIORITY) {
    const found = english.find(v => v.name.toLowerCase().includes(name.toLowerCase()))
    if (found) return found
  }

  // Final fallback: any English voice that does not match female patterns
  return (
    english.find(v => !FEMALE.test(v.name) && v.localService) ||
    english.find(v => !FEMALE.test(v.name)) ||
    english[0]
  )
}

// =============================================
// HELPERS
// =============================================
function cleanText(text) {
  return (text || '')
    .replace(/\[TIME_WARNING\]/gi, '')
    .replace(/\[END_INTERVIEW[^\]]*\]/gi, '')
    .replace(/TIME_WARNING/g, '')
    .replace(/END_INTERVIEW/g, '')
    .trim()
}

function makePronounceable(text) {
  return text
    .replace(/\bLLMs?\b/g, 'L L M')
    .replace(/\bAPIs?\b/g, 'A P I')
    .replace(/\bML\b/g, 'M L')
    .replace(/\bNLP\b/g, 'N L P')
    .replace(/\bYOLOv(\d+)\b/gi, 'YOLO version $1')
    .replace(/\bRAG\b/g, 'Rag')
    .replace(/\bCNN\b/g, 'C N N')
    .replace(/\bGPU\b/g, 'G P U')
    .replace(/\bCPU\b/g, 'C P U')
    .replace(/\bSarfraz\b/g, 'Sarr-fraz')
    .replace(/\bAhmed\b/g, 'Ah-med')
}

const blobToBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })

// =============================================
// UI COMPONENTS
// =============================================
function AiOrb({ phase }) {
  const pulse = phase === 'ai_speaking' || phase === 'listening'
  return (
    <div className="orb-wrapper">
      {pulse && <div className="orb-ring orb-ring-1 pulse" />}
      {pulse && <div className="orb-ring orb-ring-2 pulse" />}
      <div className={`orb ${
        phase === 'ai_speaking' ? 'speaking'
        : phase === 'listening'  ? 'listening'
        : phase === 'processing' ? 'processing'
        : 'idle'
      }`} />
    </div>
  )
}

function Timer({ seconds }) {
  const m      = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s      = (seconds % 60).toString().padStart(2, '0')
  const pct    = (seconds / TOTAL_SECONDS) * 100
  const warn   = seconds <= WARNING_SECONDS
  const danger = seconds <= 60
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 110 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
          TIME LEFT
        </span>
        <span style={{
          fontFamily: 'monospace', fontSize: '1.15rem', fontWeight: 700, letterSpacing: '0.06em',
          color: danger ? '#ff6060' : warn ? 'var(--gold)' : 'var(--text-white)',
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

function ProgressDots({ current, total = 5 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginRight: 2 }}>Q</span>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className={`progress-dot ${i < current ? 'done' : i === current ? 'current' : ''}`} />
      ))}
    </div>
  )
}

// =============================================
// MAIN COMPONENT
// =============================================
export default function Interview({ email, onComplete }) {
  const [phase,         setPhase]         = useState('initializing')
  const [messages,      setMessages]      = useState([])
  const [currentAiText, setCurrentAiText] = useState('')
  const [questionIndex, setQuestionIndex] = useState(0)
  const [timeLeft,      setTimeLeft]      = useState(TOTAL_SECONDS)
  const [statusLabel,   setStatusLabel]   = useState('Connecting...')

  const messagesRef        = useRef([])
  const phaseRef           = useRef('initializing')
  const timeLeftRef        = useRef(TOTAL_SECONDS)
  const warningFiredRef    = useRef(false)
  const endingFiredRef     = useRef(false)
  const disqualifiedRef    = useRef(false)
  const closedEarlyRef     = useRef(false)
  const videoRef           = useRef(null)
  const timerRef           = useRef(null)
  const questionIdxRef     = useRef(0)
  const mediaRecorderRef   = useRef(null)
  const audioChunksRef     = useRef([])
  const micStreamRef       = useRef(null)
  const recordedMimeRef    = useRef('audio/webm')  // updated per-recording for Safari
  const recordTimerRef     = useRef(null)
  const keepAliveRef       = useRef(null)
  const ttsActiveRef       = useRef(false)
  const micBusyRef         = useRef(false)
  const utteranceRef       = useRef(null) // Prevents Chrome TTS Garbage Collection bug

  useEffect(() => { messagesRef.current    = messages },       [messages])
  useEffect(() => { phaseRef.current       = phase },          [phase])
  useEffect(() => { timeLeftRef.current    = timeLeft },       [timeLeft])
  useEffect(() => { questionIdxRef.current = questionIndex },  [questionIndex])

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
      if (videoRef.current?.srcObject)
        videoRef.current.srcObject.getTracks().forEach(t => t.stop())
    }
  }, [])

  // ---- Pre-initialize mic for instant start ----
  useEffect(() => {
    const initMic = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        micStreamRef.current = stream
      } catch {}
    }
    initMic()
    return () => {
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(t => t.stop())
        micStreamRef.current = null
      }
    }
  }, [])

  // ---- Pre-load voices & Unlock Browser Audio ----
  useEffect(() => {
    const synth = window.speechSynthesis
    
    // THE FIX: Play a completely silent utterance instantly to unlock the browser's autoplay policy
    try {
      const unlock = new SpeechSynthesisUtterance('')
      unlock.volume = 0
      synth.speak(unlock)
    } catch {}

    if (synth.getVoices().length === 0) {
      const handler = () => {}
      synth.addEventListener('voiceschanged', handler)
      return () => synth.removeEventListener('voiceschanged', handler)
    }
  }, [])

  // ---- TTS keepalive (mobile browsers pause TTS when screen dims) ----
  const stopKeepAlive = useCallback(() => {
    if (keepAliveRef.current) {
      clearInterval(keepAliveRef.current)
      keepAliveRef.current = null
    }
  }, [])

  const startKeepAlive = useCallback(() => {
    if (!NEEDS_KEEPALIVE) return
    stopKeepAlive()
    keepAliveRef.current = setInterval(() => {
      const synth = window.speechSynthesis
      if (synth && synth.speaking) {
        synth.pause()
        synth.resume()
      }
    }, 8000)
  }, [stopKeepAlive])

  // =============================================
  // KILL ALL HARDWARE AND REDIRECT
  // =============================================
  const completeInterviewNow = useCallback(async () => {
    setPhase('ended')
    setStatusLabel('Interview complete')
    ttsActiveRef.current = false
    stopKeepAlive()
    localStorage.setItem('sj_interview_completed_email', email)

    // Kill video
    if (videoRef.current?.srcObject)
      videoRef.current.srcObject.getTracks().forEach(t => t.stop())
    // Kill mic
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop())
      micStreamRef.current = null
    }
    // Kill active recording
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive')
        mediaRecorderRef.current.stop()
    } catch {}
    // Clear timers
    if (recordTimerRef.current) clearTimeout(recordTimerRef.current)
    // Kill TTS
    try { window.speechSynthesis?.cancel() } catch {}

    try {
      await fetch('/api/complete-interview', {
        method:  'POST',
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
  }, [email, onComplete, stopKeepAlive])

  // =============================================
  // TTS - Desktop Optimized (Smooth, no sentence gaps)
  // =============================================
  const speakText = useCallback((text, onEndCallback = null) => {
    const synth = window.speechSynthesis
    try { synth.cancel() } catch {}
    ttsActiveRef.current = true

    setPhase('ai_speaking')
    setStatusLabel('Sarfraz is speaking...')

    // Pass the entire text block at once to prevent buffering delays
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate  = 0.95 
    utterance.pitch = 0.95
    utterance.volume = 1.0

    const voice = getBestMaleVoice()
    if (voice) utterance.voice = voice

    // Crucial: Store in a ref so Chrome's garbage collector doesn't delete it mid-sentence
    utteranceRef.current = utterance

    utterance.onend = () => {
      ttsActiveRef.current = false
      utteranceRef.current = null
      if (onEndCallback) { onEndCallback(); return }
      
      if (phaseRef.current !== 'ending' && phaseRef.current !== 'ended') {
        setPhase('waiting')
        setStatusLabel('Your turn, press the mic or Spacebar to answer')
      }
    }

    utterance.onerror = (e) => {
      if (e.error !== 'interrupted' && e.error !== 'canceled') {
        console.warn('TTS Error:', e.error)
      }
      ttsActiveRef.current = false
      utteranceRef.current = null
      if (!onEndCallback && phaseRef.current !== 'ending' && phaseRef.current !== 'ended') {
        setPhase('waiting')
        setStatusLabel('Your turn, press the mic or Spacebar to answer')
      }
    }

    // Small delay ensures previous synth cancels fully before starting
    setTimeout(() => {
      try {
        synth.speak(utterance)
      } catch (err) {
        console.warn('synth.speak threw:', err)
        utterance.onend() // Force progression if it fails
      }
    }, 50)

  }, [])

  // =============================================
  // GOODBYE + CLOSE
  // =============================================
  const triggerGoodbye = useCallback(async () => {
    if (endingFiredRef.current) return
    try {
      if (mediaRecorderRef.current?.state !== 'inactive')
        mediaRecorderRef.current?.stop()
    } catch {}
    try { window.speechSynthesis?.cancel() } catch {}
    ttsActiveRef.current = false
    setPhase('ending')
    setStatusLabel('Wrapping up...')

    const endMsg = {
      role:    'user',
      content: '[END_INTERVIEW] The interview is ending. Please give your warm, genuine closing remarks.',
    }

    let safeReply = "Thank you so much for taking the time to speak with me today. We really appreciate your interest in Scholarship Journey. Our team will review your responses carefully and will be in touch soon. Best of luck to you!"

    try {
      const res = await fetch('/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ messages: [...messagesRef.current, endMsg] }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.reply) safeReply = cleanText(data.reply)
      }
    } catch {}

    setCurrentAiText(safeReply)
    speakText(safeReply, () => completeInterviewNow())
  }, [speakText, completeInterviewNow])

  // ---- Tab hide = end interview ----
  useEffect(() => {
    const checkGrace = () => {
      const spent = TOTAL_SECONDS - timeLeftRef.current
      return spent < 120 && questionIdxRef.current === 0
    }
    const onHide = () => {
      if (!document.hidden) return
      if (phaseRef.current === 'ended' || phaseRef.current === 'ending') return
      if (checkGrace()) return
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
      if (checkGrace()) return
      navigator.sendBeacon(
        '/api/complete-interview',
        JSON.stringify({ email, disqualified: true, closedEarly: true, messages: messagesRef.current })
      )
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('beforeunload', onUnload)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('beforeunload', onUnload)
    }
  }, [email, completeInterviewNow])

  // ---- Countdown ----
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        const next = prev - 1
        timeLeftRef.current = next
        if (next <= WARNING_SECONDS && !warningFiredRef.current) warningFiredRef.current = true
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
  // CALL AI
  // =============================================
  const callAI = useCallback(async (userContent, currentMessages, retryCount = 0) => {
    if (endingFiredRef.current) return
    if (phaseRef.current === 'ending' || phaseRef.current === 'ended') return

    setPhase('processing')
    setStatusLabel('Sarfraz is thinking...')

    let content = userContent
    if (warningFiredRef.current && userContent !== 'START_INTERVIEW' && !userContent.includes('[TIME_WARNING]')) {
      content = `${userContent} [TIME_WARNING]`
    }

    const newMsg  = { role: 'user', content }
    const updated = userContent === 'START_INTERVIEW' ? [newMsg] : [...currentMessages, newMsg]
    setMessages(updated)
    messagesRef.current = updated

    try {
      const res = await fetch('/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ messages: updated }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const { reply }  = await res.json()
      const replyText  = reply || ''
      const isEnding   = replyText.includes('[END_INTERVIEW]')
      const safeReply  = cleanText(replyText)

      if (!safeReply) throw new Error('Empty reply')

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
    } catch {
      if (retryCount === 0 && !endingFiredRef.current) {
        setStatusLabel('Connection slow, retrying...')
        setTimeout(() => callAI(userContent, currentMessages, 1), 2000)
      } else {
        setStatusLabel('Connection issue. Press mic to try again.')
        setPhase('waiting')
      }
    }
  }, [speakText, completeInterviewNow])

  useEffect(() => {
    const t = setTimeout(() => callAI('START_INTERVIEW', []), 900)
    return () => clearTimeout(t)
  }, [callAI])

  // =============================================
  // MIC - instant start, all platform audio formats
  // =============================================
  const startListening = useCallback(async () => {
    if (micBusyRef.current) return
    if (phaseRef.current !== 'waiting') return
    if (endingFiredRef.current) return

    micBusyRef.current = true

    let stream = micStreamRef.current
    if (!stream || stream.getTracks().some(t => t.readyState === 'ended')) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        micStreamRef.current = stream
      } catch {
        setShowTextInput(true)
        setStatusLabel('Mic blocked or unavailable. Please check your microphone settings.')
        micBusyRef.current = false
        return
      }
    }

    // Detect the best audio format the current browser supports
    const mimeType = getBestAudioMimeType()
    recordedMimeRef.current = mimeType || 'audio/webm'

    let mediaRecorder
    try {
      mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)
    } catch {
// Some browsers reject the mimeType option - fall back to no options
try {
  mediaRecorder = new MediaRecorder(stream)
  recordedMimeRef.current = 'audio/webm'
} catch {
  setStatusLabel('Recording is not supported on this browser. Please use Chrome or Edge.')
  micBusyRef.current = false
  return
}
    }

    mediaRecorderRef.current = mediaRecorder
    audioChunksRef.current   = []

    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data)
    }

    mediaRecorder.onstart = () => {
      micBusyRef.current = false
      setPhase('listening')
      setStatusLabel('Recording... Speak your answer clearly, then click Stop.')
    }

    mediaRecorder.onstop = async () => {
      if (recordTimerRef.current) { clearTimeout(recordTimerRef.current); recordTimerRef.current = null }
      if (endingFiredRef.current) return

      setPhase('processing')
      setStatusLabel('Processing your response...')

      const audioMime = recordedMimeRef.current
      const audioBlob = new Blob(audioChunksRef.current, { type: audioMime })

      if (audioBlob.size < 1000) {
        setPhase('waiting')
        setStatusLabel('Recording too short. Press mic and speak your answer.')
        return
      }

      const transcribeAndSend = async (attempt = 0) => {
        try {
          const base64Audio = await blobToBase64(audioBlob)

          if (base64Audio.length > MAX_AUDIO_B64) {
            setPhase('waiting')
            setStatusLabel('Recording too long. Keep answers under 3 minutes.')
            return
          }

          const res  = await fetch('/api/transcribe', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ audio: base64Audio, mimeType: audioMime }),
          })
          if (!res.ok) throw new Error('Transcription failed')

          const data = await res.json()
          const text = (data.text || '').trim()

          if (text) {
            callAI(text, messagesRef.current)
          } else {
            setPhase('waiting')
            setStatusLabel('No speech detected. Press mic and try again.')
          }
        } catch {
          if (attempt === 0) {
            setStatusLabel('Still processing, please wait...')
            setTimeout(() => transcribeAndSend(1), 2000)
          } else {
            setPhase('waiting')
            setStatusLabel('Could not process response. Press mic to try again.')
          }
        }
      }

      transcribeAndSend()
    }

    mediaRecorder.onerror = () => {
      micBusyRef.current = false
      setPhase('waiting')
      setStatusLabel('Mic error. Press mic to try again.')
    }

    try {
  mediaRecorder.start()
} catch {
  micBusyRef.current = false
  setStatusLabel('Could not start recording. Please check your microphone and try again.')
  return
}

    // Auto-stop after 3 minutes as a safety net
    recordTimerRef.current = setTimeout(() => {
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
    }, MAX_RECORD_MS)

  }, [callAI])

  const stopListening = useCallback(() => {
    if (recordTimerRef.current) { clearTimeout(recordTimerRef.current); recordTimerRef.current = null }
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive')
        mediaRecorderRef.current.stop()
    } catch {}
  }, [])

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

  const canInteract = phase === 'waiting'
  const isListening = phase === 'listening'
  const isEnding    = phase === 'ending' || phase === 'ended'
  const timeWarn    = timeLeft <= WARNING_SECONDS
  const timeDanger  = timeLeft <= 60

  return (
    <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'flex', flexDirection: 'column', padding: 16 }}>

      {/* TOP BAR */}
      <div className="glass" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', marginBottom: 16, gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img 
  src="/logo.png" 
  alt="Scholarship Journey" 
  style={{ 
    height: 36, 
    width: 'auto', 
    objectFit: 'contain', 
    imageRendering: '-webkit-optimize-contrast', 
    transform: 'translateZ(0)' 
  }}
  onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }} 
/>
          <div className="sj-logo-icon" style={{ width: 34, height: 34, fontSize: '0.9rem', borderRadius: 8, display: 'none' }}>SJ</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Sarfraz Ahmed</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Scholarship Journey</div>
          </div>
        </div>
        <div className="status-badge live"><div className="status-dot" />LIVE</div>
        <Timer seconds={timeLeft} />
      </div>

      {/* MAIN GRID */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>

        {/* LEFT */}
        <div className="glass-gold" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 24px', gap: 20 }}>
          <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <ProgressDots current={questionIndex} total={5} />
            <div style={{ fontSize: '0.78rem', fontWeight: timeWarn ? 600 : 400, color: timeDanger ? '#ff8080' : timeWarn ? 'var(--gold)' : 'var(--text-muted)' }}>
              {timeDanger ? 'Wrapping up soon' : timeWarn ? 'Final question' : 'Interview in progress'}
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28, minHeight: 260, width: '100%' }}>
            <AiOrb phase={phase} />
            <div style={{ textAlign: 'center', maxWidth: 520, width: '100%' }}>
              {(phase === 'initializing' || phase === 'processing') ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--text-muted)' }}>
                  <span className="spinner" />
                  <span style={{ fontSize: '0.9rem' }}>{statusLabel}</span>
                </div>
              ) : (
                <p style={{ fontSize: '1.05rem', lineHeight: 1.75, transition: 'color 0.3s', color: phase === 'ai_speaking' ? 'var(--text-white)' : 'var(--text-secondary)' }}>
                  {currentAiText}
                </p>
              )}
            </div>
          </div>

          <div style={{ width: '100%', padding: '10px 16px', background: 'rgba(0,0,0,0.2)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%', flexShrink: 0, transition: 'all 0.3s',
              background: isListening ? '#ff6060' : phase === 'ai_speaking' ? 'var(--gold)' : (phase === 'processing' || phase === 'initializing') ? 'rgba(255,255,255,0.2)' : '#80e8a0',
              boxShadow: isListening ? '0 0 8px #ff6060' : phase === 'ai_speaking' ? '0 0 8px var(--gold)' : 'none',
            }} />
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{statusLabel}</span>
          </div>

          {!isEnding && (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                <button
                  className={`mic-btn ${isListening ? 'recording' : ''}`}
                  onClick={isListening ? stopListening : startListening}
                  disabled={!canInteract && !isListening}
                >
                  {isListening ? '⏹' : '🎙️'}
                </button>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                    {isListening ? 'Recording... click to stop' : canInteract ? 'Press mic to answer' : 'Please wait'}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    {isListening ? 'Speak clearly, then click stop' : 'or press Spacebar'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {isEnding && (
            <div className="alert alert-success" style={{ width: '100%', textAlign: 'center' }}>
              Interview complete. Redirecting...
            </div>
          )}
        </div>

        {/* RIGHT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="glass" style={{ padding: 10, aspectRatio: '4/3', position: 'relative', overflow: 'hidden' }}>
            <video ref={videoRef} autoPlay muted playsInline className="candidate-video" style={{ borderRadius: 8 }} />
            <div style={{ position: 'absolute', top: 14, left: 14, display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', padding: '3px 10px', borderRadius: 20, fontSize: '0.7rem', fontWeight: 700, color: '#ff8080' }}>
              <div className="status-dot" style={{ width: 5, height: 5 }} />YOU
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}