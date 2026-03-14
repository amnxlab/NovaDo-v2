import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createFileStorage } from '../utils/fileStorage'
import { nanoid } from 'nanoid'

// Priority levels with XP values
export const PRIORITIES = {
  low:    { label: 'Low',    emoji: '🟢', xp: 10, color: 'text-green-400',  border: 'border-green-600' },
  medium: { label: 'Medium', emoji: '🟡', xp: 20, color: 'text-yellow-400', border: 'border-yellow-500' },
  high:   { label: 'High',   emoji: '🔴', xp: 40, color: 'text-red-400',    border: 'border-red-500' },
  urgent: { label: 'Urgent', emoji: '⚡', xp: 60, color: 'text-purple-400', border: 'border-purple-500' },
}

// Deadline types
export const DEADLINE_TYPES = {
  soft: { label: 'Soft', description: 'Flexible target date' },
  hard: { label: 'Hard', description: 'Must be done by this date' },
}

// Build a new task object with full schema
const makeTask = (text, { priority = 'medium', dueDate = null, deadlineType = 'soft', tags = [], subtasks = [], durationMins = null } = {}) => ({
  id: nanoid(),
  text,
  priority,
  dueDate,
  deadlineType,
  tags,
  subtasks,
  durationMins,
  createdAt: new Date().toISOString(),
  completedAt: null,
  earlyBonus: false,
  startedAt: null,
  timeSpent: 0,
  _xpGranted: 0,   // XP awarded when completed — used for reversal on uncomplete
})

const useTasksStore = create(
  persist(
    (set, get) => ({
      tasks: [],
      // Daily wins: { date: 'YYYY-MM-DD', taskIds: string[] }
      dailyWins: null,
      // Runtime-only (excluded from persistence via partialize)
      _hasHydrated: false,
      setHasHydrated: (value) => set({ _hasHydrated: value }),
      lockedTaskId: null,
      sessionStart: null,

      setDailyWins: (taskIds) => {
        const today = new Date()
        const date = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`
        set({ dailyWins: { date, taskIds } })
      },

      // ── Task CRUD ──────────────────────────────────────────────────────────
      addTask: (text, options = {}) => {
        const task = makeTask(text, options)
        set((state) => ({ tasks: [...state.tasks, task] }))
        return task.id
      },

      completeTask: (id) => {
        set((state) => {
          const task = state.tasks.find((t) => t.id === id)
          if (!task || task.completedAt) return {}
          const now = new Date().toISOString()
          const earlyBonus = task.dueDate ? new Date(now) < new Date(task.dueDate) : false
          const updatedTasks = state.tasks.map((t) =>
            t.id === id ? { ...t, completedAt: now, earlyBonus } : t
          )
          return { tasks: updatedTasks }
        })
      },

      uncompleteTask: (id) => {
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id ? { ...t, completedAt: null, earlyBonus: false } : t
          ),
        }))
      },

      deleteTask: (id) => {
        set((state) => ({
          tasks: state.tasks.filter((t) => t.id !== id),
        }))
      },

      updateTask: (id, patch) => {
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        }))
      },

      freshStart: () => {
        set((state) => ({ tasks: state.tasks.filter((t) => t.completedAt === null) }))
      },

      // ── Subtasks ──────────────────────────────────────────────────────────
      addSubtask: (parentId, text) => {
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === parentId
              ? { ...t, subtasks: [...(t.subtasks || []), { id: nanoid(), text, completedAt: null }] }
              : t
          ),
        }))
      },

      completeSubtask: (parentId, subtaskId) => {
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === parentId
              ? {
                  ...t,
                  subtasks: (t.subtasks || []).map((s) =>
                    s.id === subtaskId ? { ...s, completedAt: new Date().toISOString() } : s
                  ),
                }
              : t
          ),
        }))
      },

      // ── Time tracking / Lock In ───────────────────────────────────────────
      lockIn: (id) => {
        set((state) => {
          let tasks = state.tasks
          // Accumulate elapsed seconds for the task being replaced
          if (state.lockedTaskId && state.sessionStart) {
            const elapsed = Math.floor((Date.now() - state.sessionStart) / 1000)
            tasks = tasks.map((t) =>
              t.id === state.lockedTaskId
                ? { ...t, timeSpent: (t.timeSpent || 0) + elapsed }
                : t
            )
          }
          // Record startedAt on first lock-in
          tasks = tasks.map((t) =>
            t.id === id ? { ...t, startedAt: t.startedAt ?? new Date().toISOString() } : t
          )
          return { tasks, lockedTaskId: id, sessionStart: Date.now() }
        })
      },

      lockOut: () => {
        set((state) => {
          if (!state.lockedTaskId || !state.sessionStart)
            return { lockedTaskId: null, sessionStart: null }
          const elapsed = Math.floor((Date.now() - state.sessionStart) / 1000)
          return {
            tasks: state.tasks.map((t) =>
              t.id === state.lockedTaskId
                ? { ...t, timeSpent: (t.timeSpent || 0) + elapsed }
                : t
            ),
            lockedTaskId: null,
            sessionStart: null,
          }
        })
      },
    }),
    {
      name: 'tasks-storage',
      storage: createFileStorage(),
      // Exclude runtime-only fields from persistence
      partialize: (state) => ({ tasks: state.tasks, quests: state.quests, dailyWins: state.dailyWins }),
      onRehydrateStorage: () => (state) => { state?.setHasHydrated(true) },
    }
  )
)

export default useTasksStore