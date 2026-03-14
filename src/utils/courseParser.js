/**
 * Parse a curriculum text blob (copied from Udemy, Coursera, YouTube, etc.)
 * into an array of { title, durationMins }.
 *
 * Supported formats (inline or time on the NEXT line):
 *   Udemy:      "01. Introduction to React  05:32"
 *               "01. Introduction to React\n05:32"
 *   YouTube:    "Title - 5:32" or "Title • 5:32"
 *   Outline:    "1. Title (10 min)" or "• Title - 10m" or "Title | 10 minutes"
 *   Separate:   "Module title\n05:32"  or  "Module title\n10 min"
 *   Plain:      "Title" (fallback → 10 min default)
 */

/**
 * Try to parse a line that is PURELY a duration (nothing else meaningful).
 * Returns minutes (number) or null if the line is not a standalone duration.
 */
function parseStandaloneDuration(line) {
  const s = line.trim()

  // Pure MM:SS  e.g. "05:32" or "5:02"
  let m = s.match(/^(\d{1,3}):(\d{2})$/)
  if (m) return Math.max(1, parseInt(m[1]) + Math.ceil(parseInt(m[2]) / 60))

  // H:MM:SS  e.g. "1:05:32"
  m = s.match(/^(\d+):(\d{2}):(\d{2})$/)
  if (m) return Math.max(1, parseInt(m[1]) * 60 + parseInt(m[2]) + Math.ceil(parseInt(m[3]) / 60))

  // Pure "X min" / "X mins" / "X minutes" / "Xm"  e.g. "10 min" "7m" "3 minutes"
  m = s.match(/^(\d+)\s*(min|mins|minutes|m)$/i)
  if (m) return Math.max(1, parseInt(m[1]))

  // "Xh Ym" or "Xh" or "Ym"  e.g. "1h 30m" "2h" "45m"
  m = s.match(/^(?:(\d+)\s*h(?:r|rs|ours?)?)?\s*(?:(\d+)\s*m(?:in|ins|inutes?)?)?$/i)
  if (m && (m[1] || m[2]) && s.length > 0) {
    const hrs = parseInt(m[1] || '0')
    const mins = parseInt(m[2] || '0')
    const total = hrs * 60 + mins
    if (total > 0) return total
  }

  return null
}

export function parseCurriculumText(text) {
  const rawLines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const modules = []

  // Section headers to skip (they're not video/module entries)
  const sectionHeader = /^(section|chapter|part|unit|week|module|lecture|lesson)\s*\d+/i

  let i = 0
  while (i < rawLines.length) {
    const raw = rawLines[i]

    // Skip section/chapter headers
    if (sectionHeader.test(raw)) { i++; continue }

    // Skip very short or clearly non-title lines
    if (raw.length < 3 || raw.length > 300) { i++; continue }

    // Skip lines that are nothing but a standalone duration (they'll be consumed by lookahead below)
    if (parseStandaloneDuration(raw) !== null) { i++; continue }

    let title = null
    let durationMins = null
    let consumedNext = false

    // ── Pattern 1: ends with MM:SS  e.g. "01. Intro to hooks  05:32" ─────────
    let m = raw.match(/^(.+?)\s+(\d{1,3}):(\d{2})\s*$/)
    if (m) {
      title = stripPrefix(m[1])
      durationMins = parseInt(m[2]) + Math.ceil(parseInt(m[3]) / 60)
    }

    // ── Pattern 2: separator + MM:SS  e.g. "Title • 5:32" or "Title - 5:32" ──
    if (!title) {
      m = raw.match(/^(.+?)\s*[•\-–—]\s*(\d{1,3}):(\d{2})/)
      if (m) {
        title = stripPrefix(m[1])
        durationMins = parseInt(m[2]) + Math.ceil(parseInt(m[3]) / 60)
      }
    }

    // ── Pattern 3: "(X min)" or "X min" or "X minutes" or "Xm" ───────────────
    if (!title) {
      m = raw.match(/^(.+?)\s*[(\[•\-–—]\s*(\d+)\s*(min|mins|minutes|m)\b/i)
      if (m) {
        title = stripPrefix(m[1].replace(/[(\[,]$/, '').trim())
        durationMins = parseInt(m[2])
      }
    }

    // ── Pattern 4: "Xh Ym" anywhere in line  e.g. "Title — 1h 30m" ──────────
    if (!title) {
      m = raw.match(/^(.+?)\s*[•\-–—]\s*(?:(\d+)h\s*)?(?:(\d+)\s*m(?:in)?)/)
      if (m && (m[2] || m[3])) {
        title = stripPrefix(m[1])
        durationMins = (parseInt(m[2] || '0') * 60) + parseInt(m[3] || '0')
      }
    }

    // ── Fallback: whole line is the title ─────────────────────────────────────
    if (!title) {
      const cleaned = stripPrefix(raw)
      if (cleaned.length >= 3) {
        title = cleaned
        durationMins = null // will attempt lookahead below
      }
    }

    // ── Lookahead: if no duration found yet, check if next non-blank line is a
    //    standalone duration (handles "title\n05:32" two-line format) ───────────
    if (title && !durationMins) {
      // Peek ahead — allow one intermediate blank/unrelated line
      for (let peek = i + 1; peek <= i + 2 && peek < rawLines.length; peek++) {
        const nextRaw = rawLines[peek]
        const d = parseStandaloneDuration(nextRaw)
        if (d !== null) {
          durationMins = d
          i = peek // consume up to the duration line
          consumedNext = true
          break
        }
        // If the next line looks like another title, don't consume it
        if (nextRaw.length >= 3 && parseStandaloneDuration(nextRaw) === null) break
      }
    }

    if (title) {
      modules.push({
        title,
        durationMins: Math.max(1, durationMins || 10),
      })
    }

    i++
  }

  return modules
}

function stripPrefix(str) {
  return str
    .replace(/^\d+[.)]\s*/, '')   // "1." or "01)"
    .replace(/^[•\-*►▶]\s*/, '') // bullet chars
    .replace(/\s+$/, '')          // trailing whitespace
    .trim()
}

