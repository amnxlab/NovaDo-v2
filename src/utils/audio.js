// Audio utilities using Web Audio API
class AudioPlayer {
  constructor() {
    this.audioContext = null
    this.gainNode = null
    this.ambientSource = null
    this.ambientType = null
    this.timerAlertIntervalId = null
  }

  init() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)()
      this.gainNode = this.audioContext.createGain()
      this.gainNode.connect(this.audioContext.destination)
    }
  }

  resumeContext() {
    this.init()
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume()
    }
  }

  _playBeep({ type = 'sine', frequency = 880, startAt = 0, duration = 0.25, gain = 0.1 }) {
    const oscillator = this.audioContext.createOscillator()
    const envelope = this.audioContext.createGain()
    const startTime = this.audioContext.currentTime + startAt
    const stopTime = startTime + duration

    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, startTime)

    envelope.gain.setValueAtTime(Math.max(gain, 0.0001), startTime)
    envelope.gain.exponentialRampToValueAtTime(0.0001, stopTime)

    oscillator.connect(envelope)
    envelope.connect(this.gainNode)
    oscillator.start(startTime)
    oscillator.stop(stopTime)
  }

  playPop() {
    this.resumeContext()
    this._playBeep({ type: 'sine', frequency: 880, duration: 0.5, gain: 0.1 })
  }

  playLevelUp() {
    this.resumeContext()
    this._playBeep({ type: 'sine', frequency: 440, duration: 1.0, gain: 0.1 })
  }

  playTimerEnd({ tone = 'chime', volume = 0.12 } = {}) {
    this.resumeContext()

    const patterns = {
      chime: [
        { type: 'sine', frequency: 1046.5, startAt: 0, duration: 0.22, gain: volume },
        { type: 'sine', frequency: 1318.5, startAt: 0.12, duration: 0.35, gain: volume * 0.85 },
      ],
      bell: [
        { type: 'triangle', frequency: 880, startAt: 0, duration: 0.5, gain: volume },
        { type: 'sine', frequency: 1174.66, startAt: 0.08, duration: 0.8, gain: volume * 0.6 },
      ],
      digital: [
        { type: 'square', frequency: 988, startAt: 0, duration: 0.12, gain: volume * 0.8 },
        { type: 'square', frequency: 988, startAt: 0.18, duration: 0.12, gain: volume * 0.8 },
        { type: 'square', frequency: 1318.5, startAt: 0.36, duration: 0.18, gain: volume * 0.75 },
      ],
      soft: [
        { type: 'sine', frequency: 784, startAt: 0, duration: 0.2, gain: volume * 0.75 },
        { type: 'sine', frequency: 880, startAt: 0.14, duration: 0.26, gain: volume * 0.65 },
      ],
    }

    for (const step of patterns[tone] ?? patterns.chime) {
      this._playBeep(step)
    }
  }

  startTimerAlert({ tone = 'chime', volume = 0.12, repeat = true, intervalMs = 5000 } = {}) {
    this.stopTimerAlert()
    this.playTimerEnd({ tone, volume })

    if (!repeat) return

    this.timerAlertIntervalId = window.setInterval(() => {
      this.playTimerEnd({ tone, volume })
    }, intervalMs)
  }

  stopTimerAlert() {
    if (this.timerAlertIntervalId) {
      clearInterval(this.timerAlertIntervalId)
      this.timerAlertIntervalId = null
    }
  }

  // ── Ambient sounds ────────────────────────────────────────────────────
  _noiseBuffer() {
    const rate = this.audioContext.sampleRate
    const buf = this.audioContext.createBuffer(1, rate * 3, rate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    return buf
  }

  startAmbient(type) {
    // Skip if already playing the same type
    if (this.ambientType === type && this.ambientSource) return

    this.resumeContext()
    this.stopAmbient()

    const source = this.audioContext.createBufferSource()
    source.buffer = this._noiseBuffer()
    source.loop = true

    const ambientGain = this.audioContext.createGain()
    ambientGain.gain.value = 0.18

    const FILTERS = {
      'white-noise': () => source.connect(ambientGain),
      'rain': () => {
        const lp = this.audioContext.createBiquadFilter()
        lp.type = 'lowpass'
        lp.frequency.value = 1400
        lp.Q.value = 0.4
        source.connect(lp)
        lp.connect(ambientGain)
      },
      'cafe': () => {
        const bp = this.audioContext.createBiquadFilter()
        bp.type = 'bandpass'
        bp.frequency.value = 550
        bp.Q.value = 0.2
        source.connect(bp)
        bp.connect(ambientGain)
      },
      'forest': () => {
        const hp = this.audioContext.createBiquadFilter()
        hp.type = 'highpass'
        hp.frequency.value = 250
        hp.Q.value = 0.7
        source.connect(hp)
        hp.connect(ambientGain)
      },
    }

    ;(FILTERS[type] ?? FILTERS['white-noise'])()
    ambientGain.connect(this.gainNode)
    source.start()
    this.ambientSource = source
    this.ambientType = type
  }

  stopAmbient() {
    if (this.ambientSource) {
      try { this.ambientSource.stop() } catch (_) {}
      this.ambientSource = null
      this.ambientType = null
    }
  }
}

const audioPlayer = new AudioPlayer()

export { audioPlayer }