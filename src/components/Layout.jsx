import { useState, useEffect, useRef } from 'react'
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
import FocusMode from './FocusMode'
import OverwhelmModal from './OverwhelmModal'
import DailyWinsGate from './DailyWinsGate'
import useRoadmapTaskInjector from '../hooks/useRoadmapTaskInjector'
import useXPStore from '../store/xpStore'
import useTimerStore from '../store/timerStore'
import useCustomizationStore from '../store/customizationStore'
import useAuthStore from '../store/authStore'
import useTasksStore from '../store/tasksStore'
import useEmotionStore from '../store/emotionStore'

const NAV_ITEMS = [
  { to: '/',             icon: '📋', label: 'Tasks'        },
  { to: '/routines',    icon: '🔄', label: 'Routines'     },
  { to: '/roadmaps',   icon: '🗺️', label: 'Roadmaps'     },
  { to: '/analytics',  icon: '📊', label: 'Analytics'    },
  { to: '/achievements', icon: '🏆', label: 'Achievements' },
  { to: '/settings',   icon: '⚙️', label: 'Settings'     },
]

export default function Layout() {
  useRoadmapTaskInjector()

  const { todayCount } = useXPStore()
  const { user, clearAuth } = useAuthStore()
  const { colorScheme, fontSize, animationIntensity, backgroundPattern, highContrast } = useCustomizationStore()
  const { dailyWins, setDailyWins, _hasHydrated: tasksHydrated } = useTasksStore()

  // Sidebar collapsed state
  const [collapsed, setCollapsed] = useState(false)

  // Runners
  const [runningRoutine, setRunningRoutine] = useState(null)
  const [runningModule, setRunningModule] = useState(null)
  const [runningTask, setRunningTask] = useState(null)

  // ADHD Features
  const [focusTask, setFocusTask] = useState(null)
  const [showOverwhelm, setShowOverwhelm] = useState(false)

  // Parking Lot state
  const [parkingLotOpen, setParkingLotOpen] = useState(false)

  // Distraction Log state (controlled by unified FAB dock)
  const [distractionOpen, setDistractionOpen] = useState(false)

  // AICoach action registry — populated by AICoach component on mount/update
  const aiCoachActionsRef = useRef({ suggest: null, autopilot: null })

  // Emotion tracker
  const [showEmotionTracker, setShowEmotionTracker] = useState(false)
  const { checkpointCount, checkpointDate, setCheckpoint } = useEmotionStore()

  // Daily Wins gate — show if not set today
  const todayStr = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  })()
  // Gate on hydration so the modal never shows while persisted state is still loading
  const showDailyWins = tasksHydrated && (!dailyWins || dailyWins.date !== todayStr)

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

  // Emotion check every 3 completions — checkpoint persisted to prevent replay on reload
  useEffect(() => {
    if (todayCount > 0 && todayCount % 3 === 0) {
      const alreadyShown = checkpointDate === todayStr && checkpointCount >= todayCount
      if (!alreadyShown) {
        setCheckpoint(todayCount, todayStr)
        setShowEmotionTracker(true)
      }
    }
  }, [todayCount, checkpointCount, checkpointDate, todayStr, setCheckpoint])

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
      // Keyboard shortcut for Overwhelm button
      if (e.key === 'o' && !focusTask) {
        e.preventDefault()
        setShowOverwhelm(true)
      }
      // Keyboard shortcut for Parking Lot
      if (e.key === 'i') {
        e.preventDefault()
        setParkingLotOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [focusTask])



  return (
    <>
      {/* Fullscreen modals — priority order matters (highest z-index last) */}
      <AnimatePresence>
        {showDailyWins && (
          <DailyWinsGate
            key="daily-wins"
            onComplete={(ids) => setDailyWins(ids)}
          />
        )}
      </AnimatePresence>
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
      <AnimatePresence>
        {focusTask && (
          <FocusMode key={focusTask.id} task={focusTask} onClose={() => setFocusTask(null)} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showOverwhelm && (
          <OverwhelmModal key="overwhelm" onClose={() => setShowOverwhelm(false)} />
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
            <img
              src="/favicon.svg"
              alt="NovaDo"
              className="w-7 h-7 shrink-0 drop-shadow-[0_0_8px_rgba(134,59,255,0.6)]"
            />
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

            {/* Overwhelm button */}
            <button
              onClick={() => setShowOverwhelm(true)}
              title="I'm overwhelmed (O)"
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all mt-4 border ${
                collapsed
                  ? 'justify-center border-red-900/50 bg-red-950/30 hover:bg-red-900/40 text-red-400'
                  : 'border-red-900/40 bg-red-950/20 hover:bg-red-900/30 text-red-400 hover:text-red-300'
              }`}
            >
              <span className="text-lg shrink-0 w-6 text-center">😵</span>
              {!collapsed && <span className="truncate">I'm Overwhelmed</span>}
            </button>



          </nav>

          {/* User info + Logout */}
          <div className={`border-t border-gray-800 ${collapsed ? 'p-2' : 'p-3'}`}>
            {collapsed ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-purple-700 flex items-center justify-center text-sm font-bold text-white">
                  {user?.username?.[0]?.toUpperCase() ?? '?'}
                </div>
                <button
                  onClick={clearAuth}
                  title="Sign out"
                  className="text-gray-600 hover:text-red-400 transition-colors text-xs"
                >
                  ⏏
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-purple-700 shrink-0 flex items-center justify-center text-sm font-bold text-white">
                  {user?.username?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white truncate">{user?.username}</p>
                  <p className="text-[10px] text-gray-600">Signed in</p>
                </div>
                <button
                  onClick={clearAuth}
                  title="Sign out"
                  className="shrink-0 text-gray-600 hover:text-red-400 transition-colors text-xs px-1.5 py-1 rounded hover:bg-red-900/20"
                >
                  ⏏
                </button>
              </div>
            )}
          </div>

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
            <Outlet context={{ setRunningRoutine, setRunningModule, setRunningTask, setFocusTask, dailyWins }} />
          </div>
        </main>
      </div>

      {/* Persistent overlays */}
      <XPBar />
      <PomodoroTimer />
      <AICoach onRegisterActions={(actions) => { aiCoachActionsRef.current = actions }} />
      <NotificationCenter />
      <ParkingLot open={parkingLotOpen} onClose={() => setParkingLotOpen(false)} />
      <DistractionLog isOpen={distractionOpen} onToggle={setDistractionOpen} />

      {/* ── Unified FAB Dock (right side) ─────────────────────────────────── */}
      <div className="fixed right-4 bottom-20 z-50 flex flex-col-reverse gap-3 items-center">
        {/* 🚨 Distraction Log */}
        <motion.button
          onClick={() => setDistractionOpen((v) => !v)}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          title="Distraction Log (d)"
          className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-xl transition-colors ${
            distractionOpen
              ? 'bg-rose-500 ring-2 ring-rose-300/40'
              : 'bg-rose-600 hover:bg-rose-500'
          } text-white`}
        >
          🚨
        </motion.button>

        {/* 💡 Parking Lot */}
        <motion.button
          onClick={() => setParkingLotOpen((v) => !v)}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          title="Quick Capture (i)"
          className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-xl transition-colors ${
            parkingLotOpen
              ? 'bg-amber-500 ring-2 ring-amber-300/40'
              : 'bg-amber-600 hover:bg-amber-500'
          } text-white`}
        >
          💡
        </motion.button>

        {/* 🤖 AI Coach */}
        <motion.button
          onClick={() => aiCoachActionsRef.current.suggest?.()}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          title="AI Coach — get a suggestion"
          className="w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-lg flex items-center justify-center text-xl transition-colors"
        >
          🤖
        </motion.button>

        {/* 🧭 Autopilot */}
        <motion.button
          onClick={() => aiCoachActionsRef.current.autopilot?.()}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          title="ADHD Autopilot — pick best next task"
          className="w-12 h-12 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg flex items-center justify-center text-xl transition-colors"
        >
          🧭
        </motion.button>
      </div>
    </>
  )
}
