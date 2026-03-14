import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import NotificationCenter from './NotificationCenter'
import PomodoroTimer from './PomodoroTimer'
import XPBar from './XPBar'
import AICoach from './AICoach'
import EmotionTracker from './EmotionTracker'
import ParkingLot from './ParkingLot'
import DistractionLog from './DistractionLog'
import RoutineRunner from './RoutineRunner'
import ModuleRunner from './ModuleRunner'
import TaskRunner from './TaskRunner'
import useRoadmapTaskInjector from '../hooks/useRoadmapTaskInjector'
import useXPStore from '../store/xpStore'
import useTimerStore from '../store/timerStore'
import useCustomizationStore from '../store/customizationStore'
import { useEffect } from 'react'

const NAV_ITEMS = [
  { to: '/',          icon: '📋', label: 'Tasks' },
  { to: '/routines',  icon: '🔄', label: 'Routines' },
  { to: '/roadmaps',  icon: '🗺️', label: 'Roadmaps' },
  { to: '/analytics', icon: '📊', label: 'Analytics' },
  { to: '/settings',  icon: '⚙️', label: 'Settings' },
]

export default function Layout() {
  useRoadmapTaskInjector()

  const { todayCount } = useXPStore()
  const { colorScheme, fontSize, animationIntensity, backgroundPattern, highContrast } = useCustomizationStore()

  // Sidebar collapsed state
  const [collapsed, setCollapsed] = useState(false)

  // Runners
  const [runningRoutine, setRunningRoutine] = useState(null)
  const [runningModule, setRunningModule] = useState(null)
  const [runningTask, setRunningTask] = useState(null)

  // Emotion tracker
  const [emotionCheckpoint, setEmotionCheckpoint] = useState(() => todayCount)
  const [showEmotionTracker, setShowEmotionTracker] = useState(false)

  // Clear stale persisted notifications
  useEffect(() => { localStorage.removeItem('notification-storage') }, [])

  // Apply appearance settings
  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-color-scheme', colorScheme)
    root.setAttribute('data-font-size', fontSize)
    root.setAttribute('data-anim', animationIntensity)
    root.setAttribute('data-pattern', backgroundPattern)
    root.setAttribute('data-high-contrast', String(highContrast))
  }, [colorScheme, fontSize, animationIntensity, backgroundPattern, highContrast])

  // Emotion check every 3 completions
  useEffect(() => {
    if (todayCount > 0 && todayCount % 3 === 0 && todayCount !== emotionCheckpoint) {
      setEmotionCheckpoint(todayCount)
      setShowEmotionTracker(true)
    }
  }, [todayCount, emotionCheckpoint])

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.key === 't') {
        e.preventDefault()
        document.getElementById('task-input')?.focus()
      }
      if (e.key === 'p') {
        e.preventDefault()
        useTimerStore.getState().toggle()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])



  return (
    <>
      {/* Fullscreen modals */}
      <AnimatePresence>
        {showEmotionTracker && (
          <EmotionTracker key="emotion-check" taskId={null} onComplete={() => setShowEmotionTracker(false)} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {runningRoutine && (
          <RoutineRunner key={runningRoutine.id} routine={runningRoutine} onClose={() => setRunningRoutine(null)} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {runningTask && (
          <TaskRunner key={runningTask.id} task={runningTask} onClose={() => setRunningTask(null)} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {runningModule && (
          <ModuleRunner key={runningModule.module.id} item={runningModule} onClose={() => setRunningModule(null)} />
        )}
      </AnimatePresence>

      <div id="app-root" className="flex min-h-screen bg-gray-900 text-white">
        {/* Sidebar */}
        <aside
          className={`fixed top-0 left-0 h-full z-40 bg-gray-950 border-r border-gray-800 flex flex-col transition-all duration-200 ${
            collapsed ? 'w-16' : 'w-56'
          }`}
        >
          {/* Logo area */}
          <div className="p-4 flex items-center gap-3 border-b border-gray-800">
            <span className="text-xl">⚡</span>
            {!collapsed && (
              <div className="min-w-0">
                <h1 className="text-lg font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent leading-tight">
                  NovaDo
                </h1>
                <p className="text-[10px] text-gray-600 tracking-widest uppercase">NeuroOS</p>
              </div>
            )}
          </div>

          {/* Nav links */}
          <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
            {NAV_ITEMS.map(({ to, icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800 border border-transparent'
                  }`
                }
              >
                <span className="text-lg shrink-0 w-6 text-center">{icon}</span>
                {!collapsed && <span className="truncate">{label}</span>}
              </NavLink>
            ))}
          </nav>

          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="p-3 border-t border-gray-800 text-gray-600 hover:text-white transition-colors text-sm"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? '→' : '← Collapse'}
          </button>
        </aside>

        {/* Main content area */}
        <main
          className={`flex-1 min-h-screen transition-all duration-200 ${
            collapsed ? 'ml-16' : 'ml-56'
          }`}
        >
          <div className="max-w-4xl mx-auto px-6 py-8 pb-28">
            <Outlet context={{ setRunningRoutine, setRunningModule, setRunningTask }} />
          </div>
        </main>
      </div>

      {/* Persistent overlays */}
      <XPBar />
      <PomodoroTimer />
      <AICoach />
      <ParkingLot />
      <DistractionLog />
      <NotificationCenter />
    </>
  )
}
