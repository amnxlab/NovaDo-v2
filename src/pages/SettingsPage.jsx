import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import useSettingsStore from '../store/settingsStore'
import useTasksStore from '../store/tasksStore'
import useTagsStore from '../store/tagsStore'
import EmojiPicker from '../components/EmojiPicker'
import useCustomizationStore from '../store/customizationStore'

const PRESET_COLORS = [
  'bg-blue-700', 'bg-teal-700', 'bg-indigo-700', 'bg-rose-700',
  'bg-green-700', 'bg-purple-700', 'bg-orange-700', 'bg-red-700',
  'bg-yellow-600', 'bg-pink-700', 'bg-cyan-700', 'bg-lime-700',
]

const Toggle = ({ label, checked, onChange, description }) => (
  <div className="flex items-start justify-between gap-4">
    <div>
      <span className="text-white text-sm">{label}</span>
      {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
    </div>
    <button
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? 'bg-purple-600' : 'bg-gray-600'}`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`}
      />
    </button>
  </div>
)

const ALL_STORAGE_KEYS = [
  'tasks-storage', 'xp-storage', 'ai-coach-storage', 'settings-storage',
  'analytics-storage', 'emotion-storage', 'customization-storage',
  'routines-storage', 'roadmaps-storage', 'tags-storage',
  'parking-lot-storage', 'distraction-storage',
]

const nukeAllData = () => {
  ALL_STORAGE_KEYS.forEach((key) => {
    localStorage.removeItem(key)
    fetch(`/api/store/${encodeURIComponent(key)}`, { method: 'DELETE' }).catch(() => {})
  })
  window.location.reload()
}

export default function SettingsPage() {
  const {
    soundEnabled, confettiEnabled, gamificationEnabled, timerVisible,
    doNotDisturb, analyticsVisible, timelineDockVisible,
    toggleSound, toggleConfetti, toggleGamification, toggleTimer,
    toggleDoNotDisturb, toggleAnalytics, toggleTimelineDock,
  } = useSettingsStore()
  const { freshStart } = useTasksStore()
  const { tags, addTag, removeTag, resetTags } = useTagsStore()
  const {
    colorScheme, animationIntensity, fontSize, backgroundPattern, highContrast,
    toggleColorScheme, setAnimationIntensity, setFontSize, setBackgroundPattern, toggleHighContrast,
  } = useCustomizationStore()

  const [confirmNuke, setConfirmNuke] = useState(false)
  const [newTagEmoji, setNewTagEmoji] = useState('🏷️')
  const [newTagLabel, setNewTagLabel] = useState('')
  const [newTagColor, setNewTagColor] = useState('bg-blue-700')
  const [newTagKeywords, setNewTagKeywords] = useState('')

  const handleAddTag = () => {
    const label = newTagLabel.trim()
    if (!label) return
    const key = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    if (!key) return
    const keywords = newTagKeywords.split(',').map((k) => k.trim().toLowerCase()).filter(Boolean)
    addTag(key, { emoji: newTagEmoji, label, color: newTagColor, keywords })
    setNewTagLabel('')
    setNewTagEmoji('🏷️')
    setNewTagKeywords('')
  }

  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-1">Settings</h2>
        <p className="text-sm text-gray-500">Configure your NovaDo experience.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* General Settings */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">General</h3>
          <div className="space-y-4">
            <Toggle label="Sound Effects" checked={soundEnabled} onChange={toggleSound} />
            <Toggle label="Confetti" checked={confettiEnabled} onChange={toggleConfetti} />
            <Toggle label="Gamification" checked={gamificationEnabled} onChange={toggleGamification} description="XP, levels, streaks" />
            <Toggle label="Show Timer" checked={timerVisible} onChange={toggleTimer} />
            <Toggle label="Analytics Panel" checked={analyticsVisible} onChange={toggleAnalytics} description="Show stats dashboard" />
            <Toggle label="Timeline Dock" checked={timelineDockVisible} onChange={toggleTimelineDock} description="Due-date sidebar" />
            <Toggle label="Do Not Disturb" checked={doNotDisturb} onChange={toggleDoNotDisturb} description="Mute non-deadline alerts" />
          </div>
        </div>

        {/* Appearance */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">🎨 Appearance</h3>
          <div className="space-y-4">
            <Toggle label="High Contrast" checked={highContrast} onChange={toggleHighContrast} />

            <div className="space-y-1">
              <label className="text-xs text-gray-400">Color Scheme</label>
              <select
                value={colorScheme}
                onChange={(e) => e.target.value !== colorScheme && toggleColorScheme()}
                className="w-full bg-gray-700 text-white text-sm rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-purple-500"
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-gray-400">Animation Intensity</label>
              <select
                value={animationIntensity}
                onChange={(e) => setAnimationIntensity(e.target.value)}
                className="w-full bg-gray-700 text-white text-sm rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-purple-500"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-gray-400">Font Size</label>
              <select
                value={fontSize}
                onChange={(e) => setFontSize(e.target.value)}
                className="w-full bg-gray-700 text-white text-sm rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-purple-500"
              >
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-gray-400">Background Pattern</label>
              <select
                value={backgroundPattern}
                onChange={(e) => setBackgroundPattern(e.target.value)}
                className="w-full bg-gray-700 text-white text-sm rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-purple-500"
              >
                <option value="none">None</option>
                <option value="geometric">Geometric</option>
                <option value="nature">Nature</option>
                <option value="abstract">Abstract</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tag Manager */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 md:col-span-2">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">🏷️ Tags</h3>

          <div className="flex flex-wrap gap-2 mb-4">
            {Object.entries(tags).map(([key, def]) => (
              <div key={key} className="flex items-center gap-1.5 bg-gray-700/50 rounded-lg pl-2.5 pr-1 py-1">
                <span className={`text-xs px-2 py-0.5 rounded-full text-white ${def.color}`}>
                  {def.emoji} {def.label}
                </span>
                <button
                  onClick={() => removeTag(key)}
                  className="text-gray-500 hover:text-red-400 text-xs transition-colors px-1 py-0.5"
                  aria-label={`Remove ${def.label} tag`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {/* Add new tag */}
          <div className="bg-gray-700/30 rounded-xl p-4 space-y-3">
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Add Tag</p>
            <div className="flex gap-2">
              <EmojiPicker value={newTagEmoji} onChange={setNewTagEmoji} />
              <input
                value={newTagLabel}
                onChange={(e) => setNewTagLabel(e.target.value)}
                placeholder="Tag name…"
                className="flex-1 bg-gray-700 text-white text-sm rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-purple-500 placeholder-gray-600"
              />
            </div>
            <input
              value={newTagKeywords}
              onChange={(e) => setNewTagKeywords(e.target.value)}
              placeholder="Keywords (comma separated)…"
              className="w-full bg-gray-700 text-white text-sm rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-purple-500 placeholder-gray-600"
            />
            <div className="flex flex-wrap gap-1.5">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setNewTagColor(c)}
                  className={`w-6 h-6 rounded-full ${c} transition-transform ${newTagColor === c ? 'ring-2 ring-white ring-offset-1 ring-offset-gray-800 scale-110' : ''}`}
                  aria-label={c}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAddTag}
                disabled={!newTagLabel.trim()}
                className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                + Add Tag
              </button>
              <button
                onClick={() => { if (window.confirm('Reset all tags to defaults?')) resetTags() }}
                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-400 text-sm rounded-lg transition-colors"
                title="Reset to defaults"
              >
                ↺ Reset
              </button>
            </div>
          </div>
        </div>

        {/* Danger zone */}
        <div className="bg-gray-800 rounded-xl p-5 border border-red-900/30 md:col-span-2">
          <h3 className="text-sm font-semibold text-red-400 uppercase tracking-wider mb-4">⚠️ Danger Zone</h3>
          <div className="space-y-3">
            <button
              onClick={freshStart}
              className="w-full px-4 py-2.5 bg-red-700 hover:bg-red-600 text-white rounded-lg transition-colors text-sm font-medium"
            >
              🗑️ Fresh Start (clear all tasks)
            </button>

            {!confirmNuke ? (
              <button
                onClick={() => setConfirmNuke(true)}
                className="w-full px-4 py-2.5 bg-gray-700 hover:bg-red-900 text-red-400 hover:text-red-200 rounded-lg transition-colors text-sm border border-red-900/50"
              >
                ☢️ Reset All Data (tasks + XP + everything)
              </button>
            ) : (
              <div className="rounded-lg bg-red-950 border border-red-700 p-4 space-y-3">
                <p className="text-sm text-red-300 text-center font-semibold">
                  This will wipe ALL data — tasks, XP, quests, analytics, everything. This cannot be undone.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={nukeAllData}
                    className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-bold transition-colors"
                  >
                    Yes, wipe everything
                  </button>
                  <button
                    onClick={() => setConfirmNuke(false)}
                    className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
