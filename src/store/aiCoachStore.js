import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createFileStorage } from '../utils/fileStorage'
import { isPastDue } from '../utils/autoTagger'

// ── Autopilot: pick the single best next task ─────────────────────────────────
export const selectNextTask = (tasks, { currentMood, currentEnergy, focusStreak, roadmaps = [] }) => {
  const active = tasks.filter((t) => !t.completedAt)
  if (!active.length) return null

  const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 }
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)

  // Build a set of taskIds that are roadmap modules scheduled today
  const todayRoadmapTaskIds = new Set(
    roadmaps.flatMap((r) =>
      r.courses.flatMap((c) =>
        c.modules
          .filter((m) => m.scheduledDate === todayStr && !m.completedAt && m.taskId)
          .map((m) => m.taskId)
      )
    )
  )

  return active
    .map((t) => {
      let score = priorityOrder[t.priority] ?? 2

      // Roadmap module due today → strong boost
      if (todayRoadmapTaskIds.has(t.id)) score += 4

      // Overdue / due today / due soon (overdue only after 11:59 PM on due date)
      if (t.dueDate) {
        const [y, mo, d] = t.dueDate.slice(0, 10).split('-').map(Number)
        const endOfDueDay = new Date(y, mo - 1, d, 23, 59, 59, 999)
        const hoursLeft = (endOfDueDay - now) / 36e5
        if (hoursLeft < 0)       score += 5  // overdue (past 11:59 PM)
        else if (hoursLeft < 24) score += 3  // due today
        else if (hoursLeft < 72) score += 1  // due soon
      }

      // Low energy: prefer lower-effort tasks; avoid urgent
      if (currentEnergy !== null && currentEnergy <= 4) {
        if (t.priority === 'low' || t.priority === 'medium') score += 1
        if (t.priority === 'urgent') score -= 1
      }

      // Anxious/overwhelmed: prefer short, simple tasks
      if (currentMood === '😕 Anxious' || currentMood === '😖 Overwhelmed') {
        if ((t.subtasks?.length ?? 0) > 0) score -= 1
        if (t.text.length < 40) score += 1
      }

      // Focus streak: reward continuing with high-priority work
      if (focusStreak >= 3 && t.priority === 'high') score += 1

      return { task: t, score }
    })
    .sort((a, b) => b.score - a.score)[0]?.task ?? null
}

// ── Coach: context-aware suggestion ──────────────────────────────────────────
export const generateSuggestion = (
  tasks,
  { focusStreak, taskChains, currentMood, currentEnergy, roadmaps = [], routines = [] }
) => {
  const active = tasks.filter((t) => !t.completedAt)
  const overdue = active.filter((t) => isPastDue(t.dueDate))
  const todayStr = new Date().toISOString().slice(0, 10)

  // ── 1. Roadmap modules scheduled today ────────────────────────────────────
  const todayModules = roadmaps.flatMap((r) =>
    r.courses.flatMap((c) =>
      c.modules
        .filter((m) => m.scheduledDate === todayStr && !m.completedAt)
        .map((m) => ({ module: m, course: c, roadmap: r }))
    )
  )

  if (todayModules.length > 0) {
    const first = todayModules[0]
    const energyNote =
      currentEnergy !== null && currentEnergy <= 3
        ? " Your energy is low — try 🐢 Slow mode for today's sessions."
        : ''
    return {
      text: `📚 ${todayModules.length} roadmap module${todayModules.length > 1 ? 's' : ''} scheduled today. Up first: "${first.module.title}" (${first.course.name}).${energyNote}`,
      type: 'roadmap',
    }
  }

  // ── 2. Pending routines (not completed today) ──────────────────────────────
  const pendingRoutines = routines.filter((r) => r.lastCompletedDate !== todayStr)
  if (pendingRoutines.length > 0 && active.length === 0) {
    const r = pendingRoutines[0]
    return {
      text: `${r.emoji} Your "${r.name}" routine is waiting. Routines build the foundation — run it to start strong!`,
      type: 'nudge',
    }
  }

  // ── 3. Roadmap pace analysis ───────────────────────────────────────────────
  for (const r of roadmaps) {
    if (!r.deadline || !r.createdAt) continue
    const allMods = r.courses.flatMap((c) => c.modules)
    if (!allMods.length) continue
    const pct = Math.round((allMods.filter((m) => m.completedAt).length / allMods.length) * 100)
    const totalDays = (new Date(r.deadline) - new Date(r.createdAt)) / 86400000
    const elapsedDays = (new Date() - new Date(r.createdAt)) / 86400000
    const timePct = totalDays > 0 ? Math.round((elapsedDays / totalDays) * 100) : 0
    if (timePct > 5 && Math.abs(pct - timePct) > 15) {
      const ahead = pct > timePct
      return {
        text: `📊 ${r.emoji} ${r.name}: ${pct}% done, ${timePct}% of deadline elapsed — ${ahead ? 'ahead of pace! 🌟 Keep it up.' : 'behind pace. Consider bumping your daily cap or switching to ⚡ Fast mode.'}`,
        type: ahead ? 'celebrate' : 'warning',
      }
    }
  }

  // ── 4. All clear ──────────────────────────────────────────────────────────
  if (active.length === 0)
    return { text: 'All clear! 🎉 Roadmaps and tasks are done. Add what\'s next or take a real break — you earned it.', type: 'celebrate' }

  // ── 5. Overdue tasks ──────────────────────────────────────────────────────
  if (overdue.length > 0)
    return {
      text: `⚠️ ${overdue.length} overdue task${overdue.length > 1 ? 's' : ''}. Tackle "${overdue[0].text}" first — start a quick 5-min session to break the block.`,
      type: 'warning',
    }

  // ── 6. Mood / energy guidance ─────────────────────────────────────────────
  if (currentMood === '😖 Overwhelmed')
    return {
      text: `You're overwhelmed — ignore the list for a sec. One thing: "${active[0]?.text}". Set a 10-min timer and just start.`,
      type: 'calm',
    }

  if (currentMood === '😕 Anxious')
    return {
      text: `Feeling anxious? Pick the shortest task here and knock it out for a quick win. "${active.sort((a, b) => a.text.length - b.text.length)[0]?.text}"`,
      type: 'calm',
    }

  if (currentEnergy !== null && currentEnergy <= 3) {
    const lowTasks = active.filter((t) => t.priority === 'low')
    return {
      text: `Energy is low (${currentEnergy}/10). ${lowTasks.length > 0 ? `${lowTasks.length} low-effort task${lowTasks.length > 1 ? 's' : ''} available. Small wins still count!` : 'Maybe a roadmap module on 🐢 Slow mode is perfect for now.'}`,
      type: 'energy',
    }
  }

  // ── 7. Focus streak / chains momentum ────────────────────────────────────
  if (focusStreak > 5)
    return {
      text: `🔥 ${focusStreak} tasks in a row! You're locked in. Keep the chain going or take a 5-min break — both are wins.`,
      type: 'momentum',
    }

  if (taskChains > 3)
    return {
      text: `🔗 ${taskChains} task chain! Momentum is real. ${active.length} left — what's next?`,
      type: 'momentum',
    }

  // ── 8. Default: nudge toward highest priority task ────────────────────────
  const next = [...active].sort((a, b) => {
    const o = { urgent: 4, high: 3, medium: 2, low: 1 }
    return (o[b.priority] ?? 2) - (o[a.priority] ?? 2)
  })[0]
  return {
    text: `${active.length} task${active.length > 1 ? 's' : ''} active. Highest priority: "${next?.text}" — ready to start?`,
    type: 'nudge',
  }
}

const useAICoachStore = create(
  persist(
    (set) => ({
      suggestions: [],
      recommendations: [],
      autopilotEnabled: false,
      autopilotTaskId: null,
      _hasHydrated: false,
      setHasHydrated: (value) => set({ _hasHydrated: value }),

      addSuggestion: (text, type = 'nudge') => {
        set((state) => ({
          suggestions: [
            ...state.suggestions.slice(-19), // keep last 20
            { id: Date.now(), suggestion: text, type, timestamp: new Date().toISOString() },
          ],
        }))
      },

      addRecommendation: (recommendation) => {
        set((state) => ({
          recommendations: [...state.recommendations, { id: Date.now(), recommendation, timestamp: new Date().toISOString() }],
        }))
      },

      setAutopilot: (enabled, taskId = null) => {
        set({ autopilotEnabled: enabled, autopilotTaskId: taskId })
      },

      dismissLatest: () => set((state) => ({ suggestions: state.suggestions.slice(0, -1) })),
      clearSuggestions: () => set({ suggestions: [] }),
      clearRecommendations: () => set({ recommendations: [] }),
    }),
    {
      name: 'ai-coach-storage',
      storage: createFileStorage(),
      onRehydrateStorage: () => (state) => { state?.setHasHydrated(true) },
      partialize: (state) => {
        const { _hasHydrated, setHasHydrated, ...rest } = state
        return rest
      },
    }
  )
)

export default useAICoachStore