import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createFileStorage } from '../utils/fileStorage'
import { nanoid } from 'nanoid'
import { getTodayDateKey, normalizeDateKey } from '../utils/localDate'

// ── Learning Mode multipliers ─────────────────────────────────────────────────
export const LEARNING_MODES = {
  fast:   { label: 'Fast',   emoji: '⚡', multiplier: 3.0, buffer: 0.10, xpMultiplier: 1.5, desc: '3× realtime — quick absorption' },
  normal: { label: 'Normal', emoji: '📖', multiplier: 5.0, buffer: 0.15, xpMultiplier: 1.0, desc: '5× realtime — notes & review' },
  slow:   { label: 'Slow',   emoji: '🐢', multiplier: 7.0, buffer: 0.20, xpMultiplier: 0.8, desc: '7× realtime — extra pauses & repetition' },
}

/** Resolve effective mode for a module, inheriting from course then roadmap */
export const resolveMode = (module, course, roadmap) => {
  if (module.mode && module.mode !== 'inherit') return module.mode
  if (course.defaultMode && course.defaultMode !== 'inherit') return course.defaultMode
  return roadmap.defaultMode || 'normal'
}

/** Compute allocated study minutes for a module */
export const allocatedMins = (module, course, roadmap) => {
  const modeName = resolveMode(module, course, roadmap)
  const mode = LEARNING_MODES[modeName] || LEARNING_MODES.normal
  return Math.ceil(module.durationMins * mode.multiplier * (1 + mode.buffer))
}

// ── Factory helpers ───────────────────────────────────────────────────────────
export const makeModule = (title, durationMins = 10, mode = 'inherit') => ({
  id: nanoid(),
  title,
  durationMins,
  mode, // 'fast' | 'normal' | 'slow' | 'inherit'
  completedAt: null,
  prerequisiteModuleIds: [],
  notes: '',
  taskId: null,
  scheduledDate: null, // 'YYYY-MM-DD'
})

export const makeCourse = (name, source = '', url = '', emoji = '📚', defaultMode = 'inherit') => ({
  id: nanoid(),
  name,
  source,
  url,
  emoji,
  defaultMode,
  modules: [],
  deadline: null, // 'YYYY-MM-DD'
  prerequisiteCourseIds: [],
  completed: false,
  skills: [],    // string[] — skill tags gained from this course
})

const makeRoadmap = ({ name, emoji = '🗺️', description = '', deadline = null, dailyCapMins = 120, defaultMode = 'normal', colorTag = 'blue', priority = 'medium' }) => ({
  id: nanoid(),
  name,
  emoji,
  description,
  courses: [],
  deadline: normalizeDateKey(deadline), // 'YYYY-MM-DD'
  dailyCapMins,
  defaultMode,      // 'fast' | 'normal' | 'slow'
  priority,         // 'low' | 'medium' | 'high' | 'urgent'
  colorTag,         // used for visual accent
  autoInjectTasks: false,
  streak: 0,
  longestStreak: 0,
  lastActiveDate: null,  // 'YYYY-MM-DD'
  fastModeStreak: 0,     // consecutive days with ≥1 fast module completed
  fastModulesTotal: 0,   // cumulative count of fast-mode module completions
  fastMasteryActive: false, // true after 10 cumulative fast modules
  momentumMultiplier: 1.0,  // 1.5 at 3-day fast streak
  xpEarned: 0,           // total XP earned from this roadmap
  studyMinutesTotal: 0,  // total raw video minutes completed
  createdAt: new Date().toISOString(),
})

const todayStr = () => getTodayDateKey()

// ── Store ─────────────────────────────────────────────────────────────────────
const useRoadmapsStore = create(
  persist(
    (set, get) => ({
      roadmaps: [],
      _hasHydrated: false,
      setHasHydrated: (value) => set({ _hasHydrated: value }),

      // ── Roadmap CRUD ──────────────────────────────────────────────────────
      addRoadmap: (opts) => {
        const r = makeRoadmap(opts)
        set((s) => ({ roadmaps: [...s.roadmaps, r] }))
        return r.id
      },

      deleteRoadmap: (id) =>
        set((s) => ({ roadmaps: s.roadmaps.filter((r) => r.id !== id) })),

      updateRoadmap: (id, patch) =>
        set((s) => {
          const nextPatch = { ...patch }
          if (Object.prototype.hasOwnProperty.call(nextPatch, 'deadline')) {
            nextPatch.deadline = normalizeDateKey(nextPatch.deadline)
          }
          return {
            roadmaps: s.roadmaps.map((r) => (r.id === id ? { ...r, ...nextPatch } : r)),
          }
        }),

      setAutoInject: (roadmapId, value) =>
        set((s) => ({
          roadmaps: s.roadmaps.map((r) =>
            r.id === roadmapId ? { ...r, autoInjectTasks: value } : r
          ),
        })),

      // ── Course CRUD ───────────────────────────────────────────────────────
      addCourse: (roadmapId, courseOpts) => {
        const c = makeCourse(
          courseOpts.name,
          courseOpts.source,
          courseOpts.url,
          courseOpts.emoji,
          courseOpts.defaultMode
        )
        if (courseOpts.deadline) c.deadline = normalizeDateKey(courseOpts.deadline)
        if (courseOpts.prerequisiteCourseIds) c.prerequisiteCourseIds = courseOpts.prerequisiteCourseIds
        if (courseOpts.skills) c.skills = courseOpts.skills
        set((s) => ({
          roadmaps: s.roadmaps.map((r) =>
            r.id === roadmapId ? { ...r, courses: [...r.courses, c] } : r
          ),
        }))
        return c.id
      },

      deleteCourse: (roadmapId, courseId) =>
        set((s) => ({
          roadmaps: s.roadmaps.map((r) =>
            r.id === roadmapId
              ? { ...r, courses: r.courses.filter((c) => c.id !== courseId) }
              : r
          ),
        })),

      updateCourseSkills: (roadmapId, courseId, skills) =>
        set((s) => ({
          roadmaps: s.roadmaps.map((r) =>
            r.id === roadmapId
              ? {
                  ...r,
                  courses: r.courses.map((c) =>
                    c.id === courseId ? { ...c, skills: skills.map((sk) => sk.trim()).filter(Boolean) } : c
                  ),
                }
              : r
          ),
        })),

      updateCourse: (roadmapId, courseId, patch) =>
        set((s) => {
          const nextPatch = { ...patch }
          if (Object.prototype.hasOwnProperty.call(nextPatch, 'deadline')) {
            nextPatch.deadline = normalizeDateKey(nextPatch.deadline)
          }
          return {
            roadmaps: s.roadmaps.map((r) =>
              r.id === roadmapId
                ? {
                    ...r,
                    courses: r.courses.map((c) =>
                      c.id === courseId ? { ...c, ...nextPatch } : c
                    ),
                  }
                : r
            ),
          }
        }),

      // ── Module CRUD ───────────────────────────────────────────────────────
      addModule: (roadmapId, courseId, moduleOpts) => {
        const m = makeModule(
          moduleOpts.title,
          moduleOpts.durationMins ?? 10,
          moduleOpts.mode ?? 'inherit'
        )
        if (moduleOpts.prerequisiteModuleIds) m.prerequisiteModuleIds = moduleOpts.prerequisiteModuleIds
        set((s) => ({
          roadmaps: s.roadmaps.map((r) =>
            r.id === roadmapId
              ? {
                  ...r,
                  courses: r.courses.map((c) =>
                    c.id === courseId ? { ...c, modules: [...c.modules, m] } : c
                  ),
                }
              : r
          ),
        }))
        return m.id
      },

      /** Add many modules to a course in a single state update */
      bulkAddModules: (roadmapId, courseId, modulesArray) => {
        const newModules = modulesArray.map((opts) => {
          const m = makeModule(opts.title, opts.durationMins ?? 10, 'inherit')
          return m
        })
        set((s) => ({
          roadmaps: s.roadmaps.map((r) =>
            r.id === roadmapId
              ? {
                  ...r,
                  courses: r.courses.map((c) =>
                    c.id === courseId ? { ...c, modules: [...c.modules, ...newModules] } : c
                  ),
                }
              : r
          ),
        }))
      },

      deleteModule: (roadmapId, courseId, moduleId) =>
        set((s) => ({
          roadmaps: s.roadmaps.map((r) =>
            r.id === roadmapId
              ? {
                  ...r,
                  courses: r.courses.map((c) =>
                    c.id === courseId
                      ? { ...c, modules: c.modules.filter((m) => m.id !== moduleId) }
                      : c
                  ),
                }
              : r
          ),
        })),

      updateModule: (roadmapId, courseId, moduleId, patch) =>
        set((s) => ({
          roadmaps: s.roadmaps.map((r) =>
            r.id === roadmapId
              ? {
                  ...r,
                  courses: r.courses.map((c) =>
                    c.id === courseId
                      ? {
                          ...c,
                          modules: c.modules.map((m) =>
                            m.id === moduleId ? { ...m, ...patch } : m
                          ),
                        }
                      : c
                  ),
                }
              : r
          ),
        })),

      // ── Complete Module (XP logic handled outside store) ──────────────────
      completeModule: (roadmapId, courseId, moduleId, taskId = null, awardedXP = 0) => {
        set((s) => {
          const roadmap = s.roadmaps.find((r) => r.id === roadmapId)
          if (!roadmap) return {}
          const course = roadmap.courses.find((c) => c.id === courseId)
          if (!course) return {}
          const module = course.modules.find((m) => m.id === moduleId)
          if (!module || module.completedAt) return {}

          const now = new Date().toISOString()
          const td = todayStr()
          const effectiveMode = resolveMode(module, course, roadmap)

          // Update streak
          const prevDate = roadmap.lastActiveDate
          const dayDiff = prevDate
            ? (new Date(td) - new Date(prevDate)) / 86400000
            : 2
          const newStreak = dayDiff <= 1 ? roadmap.streak + 1 : 1

          // Fast mode streak + totals
          let fastModeStreak = roadmap.fastModeStreak
          let fastModulesTotal = roadmap.fastModulesTotal
          let fastMasteryActive = roadmap.fastMasteryActive
          let momentumMultiplier = roadmap.momentumMultiplier

          if (effectiveMode === 'fast') {
            fastModulesTotal += 1
            const fastDayDiff = prevDate
              ? (new Date(td) - new Date(prevDate)) / 86400000
              : 2
            fastModeStreak = fastDayDiff <= 1 ? fastModeStreak + 1 : 1
            if (fastModeStreak >= 3) momentumMultiplier = 1.5
            if (fastModulesTotal >= 10) {
              fastMasteryActive = true
              momentumMultiplier = 1.5 // kept; fast itself now uses 2.5x time internally
            }
          } else {
            // Non-fast module — reset fast streak but keep total
            fastModeStreak = 0
            momentumMultiplier = 1.0
          }

          // Check if course is now complete
          const updatedModules = course.modules.map((m) =>
            m.id === moduleId ? { ...m, completedAt: now, taskId: taskId ?? m.taskId } : m
          )
          const courseComplete = updatedModules.every((m) => m.completedAt)

          // Check if whole roadmap is complete
          const updatedCourses = roadmap.courses.map((c) =>
            c.id === courseId
              ? { ...c, modules: updatedModules, completed: courseComplete }
              : c
          )
          const roadmapComplete = updatedCourses.every((c) => c.completed)

          return {
            roadmaps: s.roadmaps.map((r) =>
              r.id === roadmapId
                ? {
                    ...r,
                    courses: updatedCourses,
                    streak: newStreak,
                    longestStreak: Math.max(r.longestStreak, newStreak),
                    lastActiveDate: td,
                    fastModeStreak,
                    fastModulesTotal,
                    fastMasteryActive,
                    momentumMultiplier,
                    xpEarned: (r.xpEarned || 0) + awardedXP,
                    studyMinutesTotal: (r.studyMinutesTotal || 0) + (module.durationMins || 0),
                    _justCompletedCourse: courseComplete ? courseId : null,
                    _justCompletedRoadmap: roadmapComplete,
                  }
                : r
            ),
          }
        })
      },

      // ── Assign schedule from scheduler util ───────────────────────────────
      assignSchedule: (assignments) => {
        // assignments: [{ roadmapId, courseId, moduleId, scheduledDate }]
        set((s) => {
          let roadmaps = s.roadmaps
          for (const a of assignments) {
            roadmaps = roadmaps.map((r) =>
              r.id === a.roadmapId
                ? {
                    ...r,
                    courses: r.courses.map((c) =>
                      c.id === a.courseId
                        ? {
                            ...c,
                            modules: c.modules.map((m) =>
                              m.id === a.moduleId ? { ...m, scheduledDate: a.scheduledDate } : m
                            ),
                          }
                        : c
                    ),
                  }
                : r
            )
          }
          return { roadmaps }
        })
      },

      // ── Computed helpers ──────────────────────────────────────────────────
      getRoadmapProgress: (id) => {
        const r = get().roadmaps.find((r) => r.id === id)
        if (!r) return { total: 0, done: 0, pct: 0 }
        const allModules = r.courses.flatMap((c) => c.modules)
        const total = allModules.length
        const done = allModules.filter((m) => m.completedAt).length
        return { total, done, pct: total ? Math.round((done / total) * 100) : 0 }
      },

      getTodayModules: () => {
        const td = todayStr()
        const result = []
        for (const r of get().roadmaps) {
          for (const c of r.courses) {
            for (const m of c.modules) {
              if (m.scheduledDate === td && !m.completedAt) {
                result.push({ module: m, course: c, roadmap: r })
              }
            }
          }
        }
        return result
      },
    }),
    {
      name: 'roadmaps-storage',
      storage: createFileStorage(),
      partialize: (state) => ({ roadmaps: state.roadmaps }),
      onRehydrateStorage: () => (state) => { state?.setHasHydrated(true) },
    }
  )
)

export default useRoadmapsStore
