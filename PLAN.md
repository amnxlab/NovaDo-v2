# NovaDo-v2 — ADHD Task Manager · MVP Plan

> **TL;DR:** A single-page React + Vite app with a "Cosmic Aurora" dark aesthetic. One input, instant rewards (confetti + sound + XP/streaks — all individually toggleable), a floating Pomodoro badge, and `localStorage` persistence. Zero navigation, zero cognitive load.

---

## Phase 1 — Project Scaffold

1. Init Vite + React in the existing repo (`npm create vite@latest . -- --template react`)
2. Install dependencies:
   - `tailwindcss`, `postcss`, `autoprefixer` → utility CSS
   - `framer-motion` → enter/exit/spring animations
   - `canvas-confetti` → confetti bursts
   - `zustand` → lightweight state (with `persist` middleware for localStorage)
   - `nanoid` → unique task IDs
3. Configure Tailwind (`tailwind.config.js`, `postcss.config.js`, import in `index.css`)
4. Set up `vite.config.js` with `@vitejs/plugin-react`

---

## Phase 2 — State Layer (Zustand stores)

5. `src/store/tasksStore.js` — tasks CRUD + daily reset
   - State: `tasks: [{ id, text, createdAt, completedAt }]`
   - Actions: `addTask(text)`, `completeTask(id)`, `deleteTask(id)`, `freshStart()` (archives completed, keeps active)
   - Persisted to localStorage via `zustand/middleware/persist`

6. `src/store/xpStore.js` — gamification
   - State: `{ points, level, streakDays, todayCount, lastActiveDate }`
   - Actions: `awardXP(amount)` — auto levels up every 100 XP, detects daily streak

7. `src/store/settingsStore.js` — feature toggles
   - State: `{ soundEnabled, confettiEnabled, gamificationEnabled, timerVisible }`
   - Persisted to localStorage

8. `src/store/timerStore.js` — Pomodoro state machine
   - State: `{ mode: 'work' | 'break', remaining: number, running: bool, sessions: number }`
   - Actions: `toggle()`, `reset()`, `tick()` (called by interval in hook)

---

## Phase 3 — Utility Layer

9. `src/utils/audio.js` — synthesized sounds via **Web Audio API** (no audio files, works offline)
   - `playPop()` — satisfying completion pop (oscillator + gain envelope)
   - `playLevelUp()` — ascending chord sweep
   - `playTimerEnd()` — gentle bell tone
   - All sounds only play if `settingsStore.soundEnabled === true`

---

## Phase 4 — Core Components

10. `src/components/TaskInput.jsx`
    - Always-autofocused single `<input>` field
    - Enter key → `addTask()` → clear + refocus
    - Spring scale animation on focus
    - Placeholder rotates through ADHD-friendly prompts: "What's the one thing right now?", "Drop it here…"

11. `src/components/TaskCard.jsx`
    - Framer Motion `layout` + `AnimatePresence` for smooth list reorder
    - Click/tap → `completeTask()` → fires reward burst from card position
    - Completed cards animate out: scale down + fade + slide right
    - Swipe left (touch) to delete; hold-to-reveal delete on desktop (200ms hover)

12. `src/components/TaskList.jsx`
    - Wraps `TaskCard` list with `AnimatePresence`
    - Empty state: large animated sparkle emoji with encouraging message

13. `src/components/RewardOverlay.jsx`
    - Listens to task completion events via Zustand
    - Triggers `canvas-confetti` burst at click coordinates
    - Renders floating `+10 XP` text that floats up and fades

14. `src/components/XPBar.jsx`
    - Slim progress bar fixed at bottom of viewport
    - Shows `Level N · X XP · 🔥 Y today`
    - Level-up: bar flashes + full-screen confetti + `playLevelUp()`
    - Hidden when `gamificationEnabled = false`

15. `src/components/PomodoroTimer.jsx`
    - Floating badge fixed top-right
    - Displays `MM:SS` countdown
    - One click → toggle start/pause
    - Color shifts: blue (work) → green (break)
    - End-of-session: plays bell, badge pulses
    - Hidden/collapsed when `timerVisible = false`

16. `src/components/SettingsPanel.jsx`
    - Slide-in panel from bottom-right, triggered by a gear icon
    - Four toggle switches: Sound, Confetti, Gamification, Show Timer
    - **"Fresh Start"** button → `freshStart()` + micro-animation confirmation (no modal)

---

## Phase 5 — Layout & Visual Design

17. `src/App.jsx` — single full-screen composition, no router, no pages
    - Keyboard shortcuts: `t` → focus input, `p` → toggle timer, `,` → open settings

18. `src/index.css` — **"Cosmic Aurora"** theme
    - Background: deep `#060612` with slowly animating aurora (CSS `@keyframes` hue-rotate + radial gradients)
    - Task cards: glassmorphism (`backdrop-filter: blur(12px)`, translucent neon borders)
    - Accent palette: electric violet `#8B5CF6` + cyan `#06B6D4`
    - CSS-only floating particle background (pseudo-elements)
    - Custom slim scrollbar matching accent colors

---

## Phase 6 — Wiring & Polish

19. Connect `useEffect` timer tick in `PomodoroTimer.jsx` to `timerStore.tick()`
20. Wire `RewardOverlay` to `tasksStore` completion events
21. `useEffect` in app mount to detect new day and update XP streak
22. Responsive layout: works on mobile (375px) and desktop (1440px)
23. `index.html` — page title, favicon, meta theme-color

---

## Verification Checklist

- [ ] `npm run dev` → loads on `localhost:5173`, no console errors
- [ ] Add 3 tasks → instant animated appearance
- [ ] Complete a task → confetti fires at card position, pop sound, `+10 XP` floats up, card slides out
- [ ] Reach 100 XP → level-up celebration fires
- [ ] Toggle all 4 settings off → no confetti, no sound, XP bar hidden, timer badge hidden
- [ ] Refresh page → tasks, XP, and settings persist from localStorage
- [ ] "Fresh Start" → completed tasks disappear, active tasks remain
- [ ] Pomodoro counts to 0 → bell plays, switches to break mode, badge pulses
- [ ] Mobile viewport (375px) → input and cards remain fully usable

---

## Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Backend | None (localStorage only) | Zero friction, offline-first; swap `persist` middleware for Supabase later without touching components |
| Router | None | Literally one view |
| Tags / projects / subtasks | Excluded | Explicitly out of MVP scope |
| Sounds | Web Audio API (synthesized) | Zero extra dependency, no hosted audio files, works offline |
| State | Zustand + `persist` | Replaces a custom `storage.js` abstraction entirely |
| Confetti origin | Click coordinates of completed task | Burst originates from the task visually for visceral feedback |

---

## File Map

```
src/
├── store/
│   ├── tasksStore.js
│   ├── xpStore.js
│   ├── settingsStore.js
│   └── timerStore.js
├── utils/
│   └── audio.js
├── components/
│   ├── TaskInput.jsx
│   ├── TaskCard.jsx
│   ├── TaskList.jsx
│   ├── RewardOverlay.jsx
│   ├── XPBar.jsx
│   ├── PomodoroTimer.jsx
│   └── SettingsPanel.jsx
├── App.jsx
└── index.css
vite.config.js
tailwind.config.js
package.json
index.html
```

---

## Further Considerations

1. **Task editing** — currently excluded (click = complete). Recommend double-click-to-edit inline in v2; skip for MVP.
2. **Notification API** — show a browser notification when Pomodoro ends and the tab is in the background. Low effort, high value; worth enabling from day one.
3. **PWA / install prompt** — add a `manifest.json` and service worker later to make it installable as a desktop app with a single command.
