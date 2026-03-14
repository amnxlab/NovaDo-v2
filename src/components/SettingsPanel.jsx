import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useSettingsStore from '../store/settingsStore'
import useTasksStore from '../store/tasksStore'
import useTagsStore from '../store/tagsStore'
import EmojiPicker from './EmojiPicker'
import useCustomizationStore from '../store/customizationStore'
import { DEFAULT_TAGS } from '../utils/autoTagger'

const PRESET_COLORS = [
  'bg-blue-700', 'bg-teal-700', 'bg-indigo-700', 'bg-rose-700',
  'bg-green-700', 'bg-purple-700', 'bg-orange-700', 'bg-red-700',
  'bg-yellow-600', 'bg-pink-700', 'bg-cyan-700', 'bg-lime-700',
]

const Toggle = ({ label, checked, onChange, description }) => (
  <div className="flex items-start justify-between gap-4 bg-gray-800/50 rounded-xl px-3 py-2.5">
    <div className="flex-1 min-w-0">
      <span className="text-white text-sm font-medium">{label}</span>
      {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
    </div>
    <button
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-all duration-300 ${
        checked
          ? 'bg-purple-600 shadow-[0_0_12px_rgba(147,51,234,0.6)]'
          : 'bg-gray-700'
      }`}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
        className={`inline-block h-6 w-6 rounded-full shadow-md ${
          checked ? 'bg-white translate-x-5' : 'bg-gray-300 translate-x-0'
        }`}
      />
    </button>
  </div>
)

const SegmentedControl = ({ value, onChange, options }) => (
  <div className="flex bg-gray-900 rounded-xl p-1 gap-1">
    {options.map((opt) => (
      <button
        key={opt.value}
        onClick={() => onChange(opt.value)}
        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-all duration-200 ${
          value === opt.value
            ? 'bg-purple-600 text-white shadow-[0_0_10px_rgba(147,51,234,0.4)]'
            : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
        }`}
      >
        {opt.icon && <span>{opt.icon}</span>}
        {opt.label}
      </button>
    ))}
  </div>
)

const ALL_STORAGE_KEYS = [
  'tasks-storage', 'xp-storage', 'ai-coach-storage', 'settings-storage',
  'analytics-storage', 'emotion-storage',
  'customization-storage',
]

const nukeAllData = () => {
  ALL_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key))
  window.location.reload()
}

const SettingsPanel = () => {
  const {
    soundEnabled, confettiEnabled, gamificationEnabled, timerVisible,
    doNotDisturb, timelineDockVisible,
    toggleSound, toggleConfetti, toggleGamification, toggleTimer,
    toggleDoNotDisturb, toggleTimelineDock,
  } = useSettingsStore()
  const { freshStart } = useTasksStore()
  const { tags, addTag, removeTag, resetTags } = useTagsStore()
  const {
    colorScheme, animationIntensity, fontSize, backgroundPattern, highContrast,
    toggleColorScheme, setAnimationIntensity, setFontSize, setBackgroundPattern, toggleHighContrast,
  } = useCustomizationStore()
  const [isOpen, setIsOpen] = useState(false)
  const [confirmNuke, setConfirmNuke] = useState(false)
  const [showTagManager, setShowTagManager] = useState(false)
  const [showAppearance, setShowAppearance] = useState(false)
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
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 z-50 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
        aria-label="Open settings"
      >
        ⚙️ Settings
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ y: 200, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 200, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300 }}
            className="fixed bottom-20 right-4 z-50 bg-gray-900 p-6 rounded-lg shadow-xl max-w-sm w-full"
          >
            <h3 className="text-lg font-bold text-white mb-4">⚙️ Settings</h3>

            <div className="space-y-4">
              <Toggle label="Sound Effects" checked={soundEnabled} onChange={toggleSound} />
              <Toggle label="Confetti" checked={confettiEnabled} onChange={toggleConfetti} />
              <Toggle label="Gamification" checked={gamificationEnabled} onChange={toggleGamification} description="XP, levels, streaks" />
              <Toggle label="Show Timer" checked={timerVisible} onChange={toggleTimer} />
              <Toggle label="Timeline Dock" checked={timelineDockVisible} onChange={toggleTimelineDock} description="Due-date sidebar" />
              <Toggle label="Do Not Disturb" checked={doNotDisturb} onChange={toggleDoNotDisturb} description="Mute non-deadline alerts" />

              {/* Tag Manager */}
              <div className="border-t border-gray-700 pt-4">
                <button
                  onClick={() => setShowTagManager((v) => !v)}
                  className="flex items-center justify-between w-full text-sm text-gray-300 hover:text-white transition-colors"
                >
                  <span>🏷️ Manage Tags</span>
                  <span className="text-gray-500">{showTagManager ? '▲' : '▼'}</span>
                </button>

                <AnimatePresence>
                  {showTagManager && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 space-y-1">
                        {Object.entries(tags).map(([key, def]) => (
                          <div key={key} className="flex items-center justify-between gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full text-white ${def.color}`}>
                              {def.emoji} {def.label}
                            </span>
                            <button
                              onClick={() => removeTag(key)}
                              className="text-gray-500 hover:text-red-400 text-xs transition-colors px-1"
                              aria-label={`Remove ${def.label} tag`}
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Add new tag */}
                      <div className="mt-3 pt-3 border-t border-gray-700 space-y-2">
                        <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Add Tag</p>
                        <div className="flex gap-2">
                          <EmojiPicker value={newTagEmoji} onChange={setNewTagEmoji} />
                          <input
                            value={newTagLabel}
                            onChange={(e) => setNewTagLabel(e.target.value)}
                            placeholder="Name…"
                            className="flex-1 bg-gray-800 text-white text-sm rounded px-2 py-1 outline-none focus:ring-1 focus:ring-purple-500 placeholder-gray-600"
                          />
                        </div>
                        <input
                          value={newTagKeywords}
                          onChange={(e) => setNewTagKeywords(e.target.value)}
                          placeholder="Keywords (comma separated)…"
                          className="w-full bg-gray-800 text-white text-xs rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-purple-500 placeholder-gray-600"
                        />
                        <div className="flex flex-wrap gap-1">
                          {PRESET_COLORS.map((c) => (
                            <button
                              key={c}
                              onClick={() => setNewTagColor(c)}
                              className={`w-5 h-5 rounded-full ${c} ${newTagColor === c ? 'ring-2 ring-white ring-offset-1 ring-offset-gray-900' : ''}`}
                              aria-label={c}
                            />
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={handleAddTag}
                            disabled={!newTagLabel.trim()}
                            className="flex-1 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-semibold rounded transition-colors"
                          >
                            + Add Tag
                          </button>
                          <button
                            onClick={() => { if (window.confirm('Reset all tags to defaults?')) resetTags() }}
                            className="px-2 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-400 text-xs rounded transition-colors"
                            title="Reset to defaults"
                          >
                            ↺
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Appearance */}
              <div className="border-t border-gray-700/60 pt-4">
                <button
                  onClick={() => setShowAppearance((v) => !v)}
                  className="flex items-center justify-between w-full group"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-purple-600/20 flex items-center justify-center">
                      <span className="text-xs">🎨</span>
                    </div>
                    <span className="text-xs font-bold tracking-widest uppercase text-purple-400">Appearance</span>
                  </div>
                  <motion.span
                    animate={{ rotate: showAppearance ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-gray-600 group-hover:text-gray-400 transition-colors text-xs"
                  >
                    ▼
                  </motion.span>
                </button>

                <AnimatePresence>
                  {showAppearance && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-4 space-y-4">
                        {/* High Contrast */}
                        <Toggle
                          label="High Contrast"
                          description="Increases text & border contrast"
                          checked={highContrast}
                          onChange={toggleHighContrast}
                        />

                        {/* Color Scheme */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-1.5 px-1">
                            <span className="text-[10px] font-semibold tracking-widest uppercase text-gray-500">Color Scheme</span>
                          </div>
                          <SegmentedControl
                            value={colorScheme}
                            onChange={(v) => v !== colorScheme && toggleColorScheme()}
                            options={[
                              { value: 'dark',  icon: '🌑', label: 'Dark' },
                              { value: 'light', icon: '☀️', label: 'Light' },
                            ]}
                          />
                        </div>

                        {/* Animation Intensity */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-1.5 px-1">
                            <span className="text-[10px] font-semibold tracking-widest uppercase text-gray-500">Animation Intensity</span>
                          </div>
                          <SegmentedControl
                            value={animationIntensity}
                            onChange={setAnimationIntensity}
                            options={[
                              { value: 'low',    icon: '🧊', label: 'Low' },
                              { value: 'medium', icon: '⚡', label: 'Medium' },
                              { value: 'high',   icon: '🔥', label: 'High' },
                            ]}
                          />
                        </div>

                        {/* Font Size */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-1.5 px-1">
                            <span className="text-[10px] font-semibold tracking-widest uppercase text-gray-500">Font Size</span>
                          </div>
                          <SegmentedControl
                            value={fontSize}
                            onChange={setFontSize}
                            options={[
                              { value: 'small',  label: 'Aa', icon: null },
                              { value: 'medium', label: 'AA', icon: null },
                              { value: 'large',  label: 'A+', icon: null },
                            ]}
                          />
                        </div>

                        {/* Background Pattern */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-1.5 px-1">
                            <span className="text-[10px] font-semibold tracking-widest uppercase text-gray-500">Background Pattern</span>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            {[
                              { value: 'none',          icon: '◻️', label: 'None' },
                              { value: 'geometric',     icon: '⬡',  label: 'Geometric' },
                              { value: 'nature',        icon: '🌿', label: 'Nature' },
                              { value: 'abstract',      icon: '🌀', label: 'Abstract' },
                              { value: 'constellation', icon: '✦',  label: 'Stars + Grid' },
                              { value: 'circuit',       icon: '⬡',  label: 'Circuit' },
                            ].map((opt) => (
                              <button
                                key={opt.value}
                                onClick={() => setBackgroundPattern(opt.value)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 border ${
                                  backgroundPattern === opt.value
                                    ? 'bg-purple-600/20 border-purple-500/60 text-purple-300 shadow-[0_0_10px_rgba(147,51,234,0.2)]'
                                    : 'bg-gray-800/60 border-gray-700/50 text-gray-400 hover:border-gray-600 hover:text-gray-200'
                                }`}
                              >
                                <span>{opt.icon}</span>
                                <span>{opt.label}</span>
                                {backgroundPattern === opt.value && (
                                  <span className="ml-auto text-purple-400">✓</span>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="border-t border-gray-700 pt-4 space-y-2">
                <button
                  onClick={freshStart}
                  className="w-full px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded-lg transition-colors text-sm"
                >
                  🗑️ Fresh Start (clear all tasks)
                </button>

                {!confirmNuke ? (
                  <button
                    onClick={() => setConfirmNuke(true)}
                    className="w-full px-4 py-2 bg-gray-700 hover:bg-red-900 text-red-400 hover:text-red-200 rounded-lg transition-colors text-sm border border-red-900/50"
                  >
                    ☢️ Reset All Data (tasks + XP + everything)
                  </button>
                ) : (
                  <div className="rounded-lg bg-red-950 border border-red-700 p-3 space-y-2">
                    <p className="text-xs text-red-300 text-center font-semibold">This will wipe ALL data — tasks, XP, quests, analytics, everything. This cannot be undone.</p>
                    <div className="flex gap-2">
                      <button
                        onClick={nukeAllData}
                        className="flex-1 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-bold transition-colors"
                      >
                        Yes, wipe everything
                      </button>
                      <button
                        onClick={() => setConfirmNuke(false)}
                        className="flex-1 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export default SettingsPanel