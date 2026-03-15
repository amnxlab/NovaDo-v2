import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import useTimerStore from '../store/timerStore'
import useSettingsStore from '../store/settingsStore'
import { audioPlayer } from '../utils/audio'

const PomodoroTimer = () => {
  const {
    mode,
    remaining,
    running,
    sessions,
    toggle,
    reset,
    tick
  } = useTimerStore()
  const {
    timerVisible,
    soundEnabled,
    timerAlertTone,
    timerAlertRepeat,
    timerAlertIntervalSec,
    timerAlertVolume,
  } = useSettingsStore()
  const [phaseAlertActive, setPhaseAlertActive] = useState(false)

  useEffect(() => {
    let interval
    if (running) {
      interval = setInterval(() => {
        tick()
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [running, tick])

  useEffect(() => {
    if (remaining <= 0 && running) {
      if (soundEnabled) {
        audioPlayer.startTimerAlert({
          tone: timerAlertTone,
          volume: timerAlertVolume,
          repeat: timerAlertRepeat,
          intervalMs: timerAlertIntervalSec * 1000,
        })
      }
      setPhaseAlertActive(true)
      reset()
    }
  }, [remaining, running, mode, reset, soundEnabled, timerAlertTone, timerAlertRepeat, timerAlertIntervalSec, timerAlertVolume])

  useEffect(() => {
    if (!soundEnabled || !timerVisible) {
      audioPlayer.stopTimerAlert()
      setPhaseAlertActive(false)
      return
    }

    if (phaseAlertActive && running) {
      audioPlayer.stopTimerAlert()
      setPhaseAlertActive(false)
    }
  }, [running, phaseAlertActive, soundEnabled, timerVisible])

  useEffect(() => () => {
    audioPlayer.stopTimerAlert()
  }, [])

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  if (!timerVisible) return null

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 200 }}
      className="fixed top-4 right-4 z-50"
    >
      <button
        onClick={toggle}
        className={`px-6 py-3 rounded-full font-bold text-white shadow-lg ${mode === 'work' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}`}
      >
        {formatTime(remaining)}
      </button>
    </motion.div>
  )
}

export default PomodoroTimer