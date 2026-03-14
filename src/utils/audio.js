// Audio utilities using Web Audio API
class AudioPlayer {
  constructor() {
    this.audioContext = null
    this.gainNode = null
    this.ambientSource = null
    this.ambientType = null
  }

  init() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)()
      this.gainNode = this.audioContext.createGain()
      this.gainNode.connect(this.audioContext.destination)
    }
  }

  playPop() {
    this.init()
    const oscillator = this.audioContext.createOscillator()
    const gain = this.audioContext.createGain()

    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(880, this.audioContext.currentTime)
    gain.gain.setValueAtTime(0.1, this.audioContext.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, this.audioContext.currentTime + 0.5)

    oscillator.connect(gain)
    gain.connect(this.gainNode)
    oscillator.start()
    oscillator.stop(this.audioContext.currentTime + 0.5)
  }

  playLevelUp() {
    this.init()
    const oscillator = this.audioContext.createOscillator()
    const gain = this.audioContext.createGain()

    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(440, this.audioContext.currentTime)
    gain.gain.setValueAtTime(0.1, this.audioContext.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, this.audioContext.currentTime + 1.0)

    oscillator.connect(gain)
    gain.connect(this.gainNode)
    oscillator.start()
    oscillator.stop(this.audioContext.currentTime + 1.0)
  }

  playTimerEnd() {
    this.init()
    const oscillator = this.audioContext.createOscillator()
    const gain = this.audioContext.createGain()

    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(1046.5, this.audioContext.currentTime)
    gain.gain.setValueAtTime(0.1, this.audioContext.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, this.audioContext.currentTime + 0.8)

    oscillator.connect(gain)
    gain.connect(this.gainNode)
    oscillator.start()
    oscillator.stop(this.audioContext.currentTime + 0.8)
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

    this.init()
    this.stopAmbient()

    // Resume suspended context (browser autoplay policy) — fire and forget
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume()
    }

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