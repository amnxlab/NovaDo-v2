const ISO_DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/

export function getAutoTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

export function getDateKeyFromDate(value = new Date()) {
  const date = value instanceof Date ? new Date(value) : new Date(value)
  if (Number.isNaN(date.getTime())) return null

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getTodayDateKey() {
  return getDateKeyFromDate(new Date())
}

export function normalizeDateKey(value) {
  if (!value) return null

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    if (ISO_DATE_ONLY_RE.test(trimmed)) return trimmed

    const parsed = new Date(trimmed)
    if (!Number.isNaN(parsed.getTime())) return getDateKeyFromDate(parsed)

    const dateOnlyPrefix = trimmed.match(/^(\d{4}-\d{2}-\d{2})/)
    if (dateOnlyPrefix) return dateOnlyPrefix[1]
    return null
  }

  return getDateKeyFromDate(value)
}

export function parseDateKey(value) {
  const dateKey = normalizeDateKey(value)
  if (!dateKey) return null

  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day, 0, 0, 0, 0)
}

export function endOfDateKey(value) {
  const date = parseDateKey(value)
  if (!date) return null

  date.setHours(23, 59, 59, 999)
  return date
}

export function compareDateKeys(left, right) {
  const normalizedLeft = normalizeDateKey(left)
  const normalizedRight = normalizeDateKey(right)

  if (!normalizedLeft && !normalizedRight) return 0
  if (!normalizedLeft) return 1
  if (!normalizedRight) return -1
  return normalizedLeft.localeCompare(normalizedRight)
}

export function diffCalendarDays(left, right) {
  const leftDate = left instanceof Date ? new Date(left) : parseDateKey(left) ?? new Date(left)
  const rightDate = right instanceof Date ? new Date(right) : parseDateKey(right) ?? new Date(right)

  if (Number.isNaN(leftDate.getTime()) || Number.isNaN(rightDate.getTime())) return NaN

  leftDate.setHours(0, 0, 0, 0)
  rightDate.setHours(0, 0, 0, 0)
  return Math.round((leftDate - rightDate) / 86400000)
}