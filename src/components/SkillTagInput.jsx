/**
 * SkillTagInput — pill-style multi-value skill tag input.
 * Props:
 *   value: string[]     — current skill tags
 *   onChange: (string[]) => void
 *   suggestions: string[]  — existing skill names for autocomplete
 *   placeholder: string
 */
import { useState, useRef, useEffect } from 'react'

export default function SkillTagInput({ value = [], onChange, suggestions = [], placeholder = 'Add skill…' }) {
  const [input, setInput] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const inputRef = useRef(null)

  const filtered = suggestions.filter(
    (s) => s.toLowerCase().includes(input.toLowerCase()) && !value.map((v) => v.toLowerCase()).includes(s.toLowerCase())
  )

  const addSkill = (skill) => {
    const trimmed = skill.trim()
    if (!trimmed || value.map((v) => v.toLowerCase()).includes(trimmed.toLowerCase())) return
    onChange([...value, trimmed])
    setInput('')
    setShowSuggestions(false)
    inputRef.current?.focus()
  }

  const removeSkill = (idx) => {
    onChange(value.filter((_, i) => i !== idx))
  }

  const handleKeyDown = (e) => {
    if ((e.key === 'Enter' || e.key === ',') && input.trim()) {
      e.preventDefault()
      addSkill(input)
    }
    if (e.key === 'Backspace' && !input && value.length > 0) {
      onChange(value.slice(0, -1))
    }
    if (e.key === 'Escape') setShowSuggestions(false)
  }

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e) => {
      if (!inputRef.current?.closest('.skill-tag-wrap')?.contains(e.target)) setShowSuggestions(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="skill-tag-wrap relative">
      <div
        className="flex flex-wrap gap-1.5 items-center bg-gray-700 border border-gray-600 rounded-lg px-2 py-1.5 min-h-[36px] focus-within:border-emerald-500 cursor-text transition-colors"
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((skill, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-800/40 border border-emerald-700/50 text-emerald-300"
          >
            {skill}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeSkill(i) }}
              className="text-emerald-500 hover:text-red-400 transition-colors leading-none"
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => { setInput(e.target.value); setShowSuggestions(true) }}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          placeholder={value.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[80px] bg-transparent text-white text-xs placeholder-gray-600 focus:outline-none py-0.5"
        />
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && input.trim() && filtered.length > 0 && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-gray-800 border border-gray-600 rounded-lg py-1 shadow-xl min-w-full">
          {filtered.slice(0, 6).map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); addSkill(s) }}
              className="w-full text-left px-3 py-1.5 text-xs text-gray-200 hover:bg-emerald-800/30 hover:text-emerald-300 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Hint */}
      <p className="text-[10px] text-gray-600 mt-1">Press Enter or comma to add • Backspace to remove</p>
    </div>
  )
}
