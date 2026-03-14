# NovaDo — NeuroOS

> An ADHD-first task engine built as a "Tasks OS" for your brain. Every interaction is designed to reduce cognitive load, reward momentum, and keep you in flow.

---

## Quick Start

```bash
npm install
npm run dev      # http://localhost:3000
```

---

## Core Concept: NeuroOS

NovaDo treats your task list as an operating system:

| OS Concept | NovaDo Equivalent |
|---|---|
| Programs | Tasks |
| Processing power | XP |
| CPU priority | Task priority (🟢🟡🔴⚡) |
| Mission packs | Quests |
| System monitor | Analytics Dashboard |
| Focus mode | Hyperfocus Mode |

---

## Features

### Task Management
- **Full task schema**: priority, due date (soft/hard deadline), tags, subtasks, quest assignment
- **Priority levels**: 🟢 Low (10 XP) · 🟡 Medium (20 XP) · 🔴 High (40 XP) · ⚡ Urgent (60 XP)
- **Smart TaskInput**: live auto-tagging, priority picker, date shortcuts (Today / Tomorrow / This Week / Next Week), expandable options panel
- **TaskCard**: overdue pulsing border, subtask panel, "Split" button (AI subtask suggestions), priority quick-change
- **TaskList**: sort by priority / due date / created; filter by priority and tag; collapsible completed section

### Auto-Tagging (`src/utils/autoTagger.js`)
Keyword analysis fires on every keystroke in TaskInput:
- **8 tags**: 💼 Work · 🏠 Personal · 📚 Learning · ❤️ Health · 💰 Finance · 🎨 Creative · 👥 Social · 🚨 Urgent
- Detects priority signals ("asap", "critical", "maybe") from text
- Parses natural-language dates: "today", "tomorrow", "next week", "in 3 days", "by friday"
- `suggestSubtasks(text)` — pattern-matched subtask arrays for common task types (emails, reports, meetings…)

### Gamification (XP & Achievements)
- **calcTaskXP()**: base priority XP × 1.2 for early completion × 2.0 during hyperfocus + 5 per completed subtask
- **8 achievements**: 🌱 First Step · 🔥 Habit Starting · 🏆 Week Warrior · ⏱️ Deadline Dodger · ⚡ In The Zone · ⚔️ Quest Master · 🧠 Hyperfocus Hero · 🏷️ Tag Organizer
- XP gain popup floats up from the XP bar on each completion
- Achievement icons shown in XP bar; full breakdown in Analytics

### Quests (`QuestBuilder`)
- Bundle active tasks into a named Quest with a custom XP reward
- Live progress bar (completed / total tasks)
- Quest auto-completes in `tasksStore` when all member tasks are done, triggering `awardQuestXP`
- Toggle with ⚔️ Quests button (bottom-left)

### Timeline Dock (`TimelineDock`)
- Fixed right-side panel showing up to 6 upcoming tasks with due dates
- Sorted by proximity — overdue items float to top in red with pulsing "X days overdue" badge
- Respects the "Timeline Dock" toggle in Settings
- Hidden automatically when no tasks have due dates

### ADHD Autopilot (`AICoach`)
- **🧭 Autopilot button**: runs `selectNextTask()` scoring algorithm
  - Base score from priority; +5 overdue, +3 due today, +1 due soon
  - Low energy → boosts low/medium tasks; deprioritises urgent
  - Anxious/Overwhelmed mood → prefers short tasks, avoids complex ones
  - Focus streak ≥ 3 → boosts high-priority tasks
- **🤖 Coach button**: `generateSuggestion()` with contextual advice (celebrate / warning / calm / energy / momentum / nudge)
- Suggestion history panel

### Emotion & Mood Tracking
- `EmotionTracker` modal appears automatically after every 3rd completed task
- Records mood (😊 Happy / 😐 Neutral / 😕 Anxious / 😖 Overwhelmed) and energy level (1–10)
- `currentMood` and `currentEnergy` feed into the AI coach and autopilot scoring

### Focus & Pomodoro
- **Hyperfocus Mode**: fullscreen distraction-free overlay; tasks completed in this mode earn ×2 XP
- **Pomodoro Timer**: configurable work/break intervals, per-session focus stats
- `Escape` key exits Hyperfocus Mode

### Analytics Dashboard
- Toggle with "Analytics Panel" in Settings
- Live 7-day bar chart of completed tasks
- Metrics: total tasks done, today's count, minutes focused, streak days
- XP progress bar to next level
- All unlocked achievement badges

### Settings Panel
All toggles use styled pill switches:

| Setting | Description |
|---|---|
| Sound Effects | Completion sounds |
| Confetti | Celebration animation |
| Gamification | XP / levels / streaks |
| Show Timer | Pomodoro widget visibility |
| Analytics Panel | Show/hide stats dashboard |
| Timeline Dock | Show/hide due-date sidebar |
| Do Not Disturb | Mutes non-deadline notifications |
| Fresh Start | Clears all tasks |

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `t` | Focus task input |
| `p` | Play/pause Pomodoro timer |
| `h` | Toggle Hyperfocus Mode |
| `Escape` | Exit Hyperfocus Mode |

---

## Architecture

```
src/
├── components/
│   ├── TaskInput.jsx          — Smart input with auto-tagging & date shortcuts
│   ├── TaskCard.jsx           — Full task card: priority, tags, subtasks, XP
│   ├── TaskList.jsx           — Sort/filter list + coach button
│   ├── TimelineDock.jsx       — Right-side due-date dock
│   ├── QuestBuilder.jsx       — Quest creation & progress UI
│   ├── AICoach.jsx            — Coach suggestions + ADHD Autopilot
│   ├── EmotionTracker.jsx     — Mood/energy check-in modal
│   ├── AnalyticsDashboard.jsx — Full stats + achievements
│   ├── XPBar.jsx              — XP bar with achievement icons & gain popup
│   ├── SettingsPanel.jsx      — All settings toggles
│   ├── HyperfocusMode.jsx     — Fullscreen focus overlay
│   ├── PomodoroTimer.jsx      — Pomodoro widget
│   ├── NotificationCenter.jsx — Toast notification stack
│   └── CustomizationPanel.jsx — Theme/sound customisation
├── store/
│   ├── tasksStore.js          — Tasks + Quests (PRIORITIES, DEADLINE_TYPES exported)
│   ├── xpStore.js             — XP, levels, streaks, achievements (ACHIEVEMENTS, calcTaskXP exported)
│   ├── aiCoachStore.js        — Suggestions, autopilot (selectNextTask, generateSuggestion exported)
│   ├── settingsStore.js       — All feature toggles + active view
│   ├── analyticsStore.js      — Focus sessions + daily stats
│   ├── emotionStore.js        — Mood/energy history + current state
│   ├── hyperfocusStore.js     — Hyperfocus active state
│   ├── notificationStore.js   — Notification queue
│   ├── timerStore.js          — Pomodoro timer state
│   └── customizationStore.js  — Theme preferences
└── utils/
    └── autoTagger.js          — TAG_DEFINITIONS, analyseTask(), suggestSubtasks()
```

---

## Tech Stack

- **React 19** + **Vite 8**
- **Zustand 5** with `persist` middleware (localStorage)
- **Framer Motion** — animations & transitions
- **Tailwind CSS 3** — dark-first utility styling
- **canvas-confetti** — task completion celebrations
- **nanoid** — task & quest IDs
