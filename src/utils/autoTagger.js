import { endOfDateKey, getDateKeyFromDate } from './localDate'

/**
 * autoTagger.js
 * Scans task text and returns suggested tags + priority based on keyword rules.
 *
 * Kept fully local/offline — no external APIs.
 */

/**
 * Returns true if a due-date string (YYYY-MM-DD) is past 11:59 PM today.
 * Tasks are only overdue after the end of their due day.
 */
export const isPastDue = (dueDateISO) => {
  if (!dueDateISO) return false
  const endOfDueDay = endOfDateKey(dueDateISO)
  if (!endOfDueDay) return false
  return new Date() > endOfDueDay
}

// tag definitions: { emoji, label, color, keywords[] }
export const DEFAULT_TAGS = {
  work:      { emoji: '💼', label: 'Work',      color: 'bg-blue-700',   keywords: ['work', 'meeting', 'email', 'report', 'client', 'project', 'office', 'boss', 'presentation', 'deadline', 'invoice', 'hr', 'slack', 'zoom', 'standup', 'sprint', 'jira', 'pr', 'review', 'deploy'] },
  personal:  { emoji: '🏠', label: 'Personal',  color: 'bg-teal-700',   keywords: ['personal', 'home', 'family', 'house', 'clean', 'grocery', 'cook', 'doctor', 'dentist', 'gym', 'workout', 'exercise', 'errands', 'pet', 'car'] },
  learning:  { emoji: '📚', label: 'Learning',  color: 'bg-indigo-700', keywords: ['learn', 'study', 'read', 'course', 'book', 'tutorial', 'practice', 'research', 'watch', 'lecture', 'exam', 'quiz', 'homework', 'assignment'] },
  health:    { emoji: '❤️', label: 'Health',    color: 'bg-rose-700',   keywords: ['health', 'doctor', 'medicine', 'pill', 'therapy', 'exercise', 'run', 'walk', 'mental', 'wellness', 'sleep', 'water', 'diet', 'gym', 'meditate'] },
  finance:   { emoji: '💰', label: 'Finance',   color: 'bg-green-700',  keywords: ['pay', 'bill', 'invoice', 'bank', 'money', 'budget', 'tax', 'rent', 'purchase', 'buy', 'subscription', 'expense', 'invest', 'savings'] },
  creative:  { emoji: '🎨', label: 'Creative',  color: 'bg-purple-700', keywords: ['design', 'draw', 'write', 'blog', 'post', 'video', 'edit', 'photo', 'music', 'art', 'create', 'build', 'code', 'develop', 'prototype'] },
  social:    { emoji: '👥', label: 'Social',    color: 'bg-orange-700', keywords: ['call', 'text', 'friend', 'family', 'party', 'event', 'birthday', 'invite', 'meet', 'catch up', 'reach out', 'message', 'reply'] },
  urgent:    { emoji: '🚨', label: 'Urgent',    color: 'bg-red-700',    keywords: ['urgent', 'asap', 'immediately', 'critical', 'emergency', 'now', 'today', 'due today', 'overdue'] },
}

// Backwards-compat alias
export const TAG_DEFINITIONS = DEFAULT_TAGS

// Priority keywords
const PRIORITY_SIGNALS = {
  urgent: ['urgent', 'asap', 'immediately', 'critical', 'emergency', 'overdue', 'must', 'required'],
  high:   ['important', 'key', 'major', 'priority', 'soon', 'due today', 'deadline', 'by tomorrow', 'by end of day'],
  low:    ['maybe', 'someday', 'eventually', 'nice to have', 'optional', 'when possible', 'low priority', 'backlog'],
}

// Date expressions → offsets in days
const DATE_EXPRESSIONS = [
  { pattern: /\btoday\b/i,              offset: 0 },
  { pattern: /\btomorrow\b/i,           offset: 1 },
  { pattern: /\bthis week\b/i,          offset: 6 },
  { pattern: /\bnext week\b/i,          offset: 13 },
  { pattern: /\bin (\d+) days?\b/i,     offsetGroup: 1 },
  { pattern: /\bby (monday|mon)\b/i,    dayOfWeek: 1 },
  { pattern: /\bby (tuesday|tue)\b/i,   dayOfWeek: 2 },
  { pattern: /\bby (wednesday|wed)\b/i, dayOfWeek: 3 },
  { pattern: /\bby (thursday|thu)\b/i,  dayOfWeek: 4 },
  { pattern: /\bby (friday|fri)\b/i,    dayOfWeek: 5 },
  { pattern: /\bby (saturday|sat)\b/i,  dayOfWeek: 6 },
  { pattern: /\bby (sunday|sun)\b/i,    dayOfWeek: 0 },
]

function toLocalDateString(d) {
  return getDateKeyFromDate(d)
}

function nextDayOfWeek(targetDow) {
  const now = new Date()
  const current = now.getDay()
  const diff = (targetDow - current + 7) % 7 || 7
  const d = new Date(now)
  d.setDate(d.getDate() + diff)
  return toLocalDateString(d)
}

function offsetFromToday(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return toLocalDateString(d)
}

/**
 * Analyse task text and return suggested tags, priority, and dueDate.
 * @param {string} text
 * @returns {{ tags: string[], priority: string|null, dueDate: string|null }}
 */
export function analyseTask(text, tags = DEFAULT_TAGS) {
  const lower = text.toLowerCase()

  // Tags
  const suggestedTags = Object.entries(tags)
    .filter(([, def]) => def.keywords?.some((kw) => lower.includes(kw)))
    .map(([key]) => key)
    .slice(0, 4) // cap at 4 tags

  // Priority
  let priority = null
  for (const [level, keywords] of Object.entries(PRIORITY_SIGNALS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      priority = level
      break
    }
  }

  // Due date from natural language
  let dueDate = null
  for (const expr of DATE_EXPRESSIONS) {
    const match = text.match(expr.pattern)
    if (match) {
      if (expr.offsetGroup !== undefined) {
        dueDate = offsetFromToday(parseInt(match[expr.offsetGroup], 10))
      } else if (expr.dayOfWeek !== undefined) {
        dueDate = nextDayOfWeek(expr.dayOfWeek)
      } else {
        dueDate = offsetFromToday(expr.offset)
      }
      break
    }
  }

  return { tags: suggestedTags, priority, dueDate }
}

/**
 * Generate AI-style subtask suggestions for a task.
 * Very lightweight rule-based expansion — no network call.
 */
export function suggestSubtasks(taskText) {
  const text = taskText.trim()

  // Strip common lead-ins so we always reach the root verb
  const core = text
    .replace(/^(i need to|i have to|i must|i should|need to|have to|must|should|please|remember to|don't forget to|make sure to|try to)\s+/gi, '')
    .trim()

  const verb = core.toLowerCase().split(/\s+/)[0]

  // Everything after the first word = the "object" of the action
  const obj = core.replace(/^\S+\s*/i, '').trim()
  const label = (obj || text).trim()
  const short = label.length > 48 ? label.substring(0, 48) + '…' : label
  const full  = text.length  > 48 ? text.substring(0, 48)  + '…' : text

  // ── Verb clusters → step generators ──────────────────────────────────────
  // Each entry covers a broad set of synonyms for one type of action.
  const clusters = [
    {
      // Writing / composing any document or content
      v: /^(write|draft|compose|author|pen|document|blog|post|essay|article|report|memo|brief|note|script|caption|summarize|summarise|describe|explain|outline|transcript|translate)$/,
      s: () => [`Outline "${short}"`, 'Write the first draft', 'Edit and tighten', 'Final review and deliver'],
    },
    {
      // Design / creative / building physical or visual things
      v: /^(design|draw|sketch|illustrate|paint|render|prototype|wireframe|mockup|model|sculpt|craft|build|construct|assemble|fabricate|produce|create|make|generate|record|film|photograph|edit)$/,
      s: () => [`Define what "${short}" should look like`, 'Create a rough first version', 'Refine and improve', 'Review and finalise'],
    },
    {
      // Software development / debugging
      v: /^(code|program|implement|engineer|debug|patch|refactor|optimise|optimize|rewrite|migrate|integrate|script|automate|connect|hook|wire)$/,
      s: () => [`Understand scope of "${short}"`, 'Write the code', 'Test edge cases', 'Review, clean up and merge'],
    },
    {
      // Fix / repair / resolve anything
      v: /^(fix|repair|resolve|solve|troubleshoot|diagnose|investigate|address|handle|deal|correct|update|upgrade|improve|enhance|adjust|tweak|patch)$/,
      s: () => [`Reproduce / fully understand "${short}"`, 'Identify the root cause', 'Apply the fix', 'Verify the fix works'],
    },
    {
      // Shipping / releasing
      v: /^(deploy|release|ship|launch|publish|go-live|rollout|push|promote|go)$/,
      s: () => [`Final checks for "${short}"`, 'Deploy to staging / test environment', 'Validate in staging', 'Deploy to production and monitor'],
    },
    {
      // Sending / communicating in writing
      v: /^(send|email|message|text|dm|reply|respond|answer|follow-up|notify|ping|share|submit|deliver|forward|post|announce|broadcast|request|ask)$/,
      s: () => [`Draft "${short}"`, 'Review before sending', 'Send and archive / log'],
    },
    {
      // Making contact / scheduling
      v: /^(call|phone|ring|dial|contact|reach|schedule|book|arrange|coordinate|invite|confirm|reschedule|cancel)$/,
      s: () => [`Note what is needed for "${short}"`, 'Make the call / send the booking', 'Record outcome and any follow-ups'],
    },
    {
      // Presenting / running an event
      v: /^(present|pitch|demo|demonstrate|show|teach|train|onboard|interview|facilitate|host|run|lead|chair|speak|lecture)$/,
      s: () => [`Prepare materials for "${short}"`, 'Rehearse / confirm logistics', 'Deliver it', 'Send follow-up or action items'],
    },
    {
      // Research / learning / analysis
      v: /^(research|investigate|analyse|analyze|explore|study|learn|read|watch|review|compare|evaluate|assess|audit|survey|discover|find|look|check|verify|test|inspect|examine|measure)$/,
      s: () => [`Define what you need to find out about "${short}"`, 'Gather sources and material', 'Take notes on key points', 'Summarise findings and decide next step'],
    },
    {
      // Planning / organising
      v: /^(plan|schedule|organise|organize|prepare|prep|strategize|prioritize|prioritise|map|outline|breakdown|structure|track|manage|oversee|review|finalise|finalize)$/,
      s: () => [`List everything involved in "${short}"`, 'Prioritise and order items', 'Assign times, owners or deadlines', 'Confirm everything is in place'],
    },
    {
      // Buying / acquiring
      v: /^(buy|purchase|order|get|pick|grab|acquire|procure|source|shop|rent|borrow|hire)$/,
      s: () => [`Check if you already have what's needed for "${short}"`, 'Compare options and prices', 'Make the purchase / booking', 'Confirm receipt or delivery'],
    },
    {
      // Installing / configuring / setting up
      v: /^(install|configure|setup|set|initialise|initialize|connect|link|sync|activate|enable|disable|reset|restore|backup|back)$/,
      s: () => [`Read requirements for "${short}"`, 'Back up current state if needed', 'Run installation / configuration', 'Test and verify everything works'],
    },
    {
      // Cleaning / organising physical spaces
      v: /^(clean|tidy|sort|declutter|pack|unpack|move|rearrange|clear|wash|scrub|vacuum|sweep|mop|sanitize|sanitise|organise|organize|file|archive)$/,
      s: () => [`Gather supplies for "${short}"`, 'Do the main work', 'Final tidy and put everything away'],
    },
    {
      // Finance / admin
      v: /^(pay|invoice|bill|file|complete|sign|approve|authorise|authorize|submit|apply|register|enrol|enroll|renew|cancel|close|settle|reimburse|expense|budget|report)$/,
      s: () => [`Gather all needed info / documents for "${short}"`, 'Complete the action', 'Double-check and confirm', 'Archive the record'],
    },
    {
      // Physical exercise / health
      v: /^(workout|exercise|run|jog|walk|cycle|swim|train|stretch|meditate|practice|practise|lift|hike|row|play)$/,
      s: () => ['Warm up (5 min)', `Main session: ${short}`, 'Cool down and stretch'],
    },
    {
      // Finishing / wrapping up existing work
      v: /^(finish|complete|finalise|finalize|wrap|close|end|conclude|polish|perfect|proofread|review|revisit|continue|resume)$/,
      s: () => [`List what is still left for "${short}"`, 'Work through each remaining piece', 'Do a final quality check', 'Mark as done and deliver'],
    },
  ]

  for (const { v, s } of clusters) {
    if (v.test(verb)) return s()
  }

  // ── Universal fallback — works for truly any task ──────────────────────────
  return [
    `Clarify what "done" looks like: ${full}`,
    'Gather everything needed to start',
    'Do the work',
    'Review the result and wrap up',
  ]
}
