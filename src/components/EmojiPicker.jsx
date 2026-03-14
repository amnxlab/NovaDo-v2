import { useState, useRef, useEffect } from 'react'

const EMOJI_CATEGORIES = {
  'Smileys': ['😊','😎','🤩','😤','🥳','😴','🤔','😇','🫡','🧐','💀','👻'],
  'People': ['👤','👥','🧑‍💻','🧑‍🎓','🧑‍🔬','🧑‍🏫','💪','🧠','👁️','✋','👍','🫶'],
  'Nature': ['🌅','🌙','☀️','🌊','🔥','⚡','❄️','🌿','🌸','🍀','🌈','⭐'],
  'Objects': ['📋','📝','📚','📖','📊','📈','🗺️','🗓️','📌','📎','🔗','💡'],
  'Activities': ['🎯','🏆','🎮','🎨','🎵','🏃','🧘','💼','🔬','🛠️','🧪','🎓'],
  'Symbols': ['✅','❌','⚠️','🔄','⏰','🔔','💎','🏷️','🚀','✨','💥','🌟'],
  'Food': ['☕','🍕','🍎','🧁','🥤','🍜','🥗','🧃','🍳','🥐','🫖','🍉'],
  'Travel': ['🏠','🏫','🏢','🚗','✈️','🗻','🏖️','🌍','🎪','🏟️','🎡','🗽'],
}

export default function EmojiPicker({ value, onChange, className = '' }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  const allEmojis = Object.values(EMOJI_CATEGORIES).flat()
  const filtered = search
    ? allEmojis.filter(() => true) // emojis don't have text names in this lightweight version, so show all during search
    : null

  return (
    <div ref={ref} className={`relative ${className}`}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-14 h-10 bg-gray-700 text-xl rounded-lg border border-gray-600 hover:border-gray-500 focus:outline-none focus:border-blue-500 transition-colors flex items-center justify-center"
      >
        {value || '😊'}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 w-64 bg-gray-800 border border-gray-600 rounded-xl shadow-2xl overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-gray-700">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type emoji or search…"
              autoFocus
              className="w-full bg-gray-700 text-white text-sm rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-purple-500 placeholder-gray-500"
              onKeyDown={(e) => {
                // Allow typing an emoji directly
                if (e.key === 'Enter' && search.trim()) {
                  onChange(search.trim().slice(0, 2))
                  setSearch('')
                  setOpen(false)
                }
              }}
            />
            <p className="text-[10px] text-gray-600 mt-1 px-1">Click to pick or type & press Enter</p>
          </div>

          {/* Emoji grid */}
          <div className="max-h-52 overflow-y-auto p-2 space-y-2">
            {filtered ? (
              <div className="grid grid-cols-8 gap-1">
                {allEmojis.map((em, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => { onChange(em); setOpen(false); setSearch('') }}
                    className={`w-7 h-7 flex items-center justify-center rounded hover:bg-gray-600 transition-colors text-lg ${value === em ? 'bg-purple-600/30 ring-1 ring-purple-500' : ''}`}
                  >
                    {em}
                  </button>
                ))}
              </div>
            ) : (
              Object.entries(EMOJI_CATEGORIES).map(([category, emojis]) => (
                <div key={category}>
                  <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider mb-1 px-0.5">{category}</p>
                  <div className="grid grid-cols-8 gap-1">
                    {emojis.map((em, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => { onChange(em); setOpen(false); setSearch('') }}
                        className={`w-7 h-7 flex items-center justify-center rounded hover:bg-gray-600 transition-colors text-lg ${value === em ? 'bg-purple-600/30 ring-1 ring-purple-500' : ''}`}
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
