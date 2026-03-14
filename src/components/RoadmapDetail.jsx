import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useRoadmapsStore, { LEARNING_MODES, allocatedMins, resolveMode } from '../store/roadmapsStore'
import useAICoachStore from '../store/aiCoachStore'
import { computeSchedule } from '../utils/scheduler'
import EmojiPicker from './EmojiPicker'
import DependencyTree from './DependencyTree'
import { isYouTubePlaylist, fetchYouTubePlaylist } from '../utils/youtubeImport'
import { parseCurriculumText } from '../utils/courseParser'

const todayStr = () => {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// ── Reusable mode selector pill group ─────────────────────────────────────────
function ModeSelector({ value, onChange, includeInherit = false, size = 'sm' }) {
  const modes = includeInherit
    ? [['inherit', { emoji: '↑', label: 'Inherit' }], ...Object.entries(LEARNING_MODES)]
    : Object.entries(LEARNING_MODES)

  return (
    <div className="flex gap-1">
      {modes.map(([key, mode]) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          title={mode.desc || `Inherit from parent`}
          className={`px-2 py-1 rounded text-xs font-semibold transition-colors border ${
            value === key
              ? 'bg-blue-600 border-blue-500 text-white'
              : 'bg-gray-700 border-gray-600 text-gray-400 hover:text-white'
          } ${size === 'xs' ? 'text-xs' : 'text-xs'}`}
        >
          {mode.emoji} {mode.label}
        </button>
      ))}
    </div>
  )
}

// ── Import Preview ─────────────────────────────────────────────────────────────
function ImportPreview({ modules, onConfirm, onClear }) {
  const [items, setItems] = useState(modules)

  const remove = (i) => setItems((prev) => prev.filter((_, idx) => idx !== i))
  const updateTitle = (i, val) =>
    setItems((prev) => prev.map((m, idx) => (idx === i ? { ...m, title: val } : m)))
  const updateDuration = (i, val) =>
    setItems((prev) => prev.map((m, idx) => (idx === i ? { ...m, durationMins: Math.max(1, parseInt(val) || 1) } : m)))

  return (
    <div className="border border-blue-800/50 bg-blue-950/20 rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-blue-300 text-xs font-semibold">
          📋 {items.length} modules detected — review &amp; edit before importing
        </span>
        <button onClick={onClear} className="text-gray-600 hover:text-red-400 text-xs transition-colors">✕ Clear</button>
      </div>
      <div className="max-h-52 overflow-y-auto space-y-1 pr-1">
        {items.map((m, i) => (
          <div key={i} className="flex gap-1.5 items-center">
            <input
              value={m.title}
              onChange={(e) => updateTitle(i, e.target.value)}
              className="flex-1 bg-gray-800 text-white text-xs rounded px-2 py-1 border border-gray-700 focus:outline-none focus:border-blue-500 min-w-0"
            />
            <div className="flex items-center gap-1 shrink-0">
              <input
                type="number" min="1" max="600" value={m.durationMins}
                onChange={(e) => updateDuration(i, e.target.value)}
                className="w-12 bg-gray-800 text-white text-xs rounded px-1.5 py-1 border border-gray-700 text-center focus:outline-none focus:border-blue-500"
              />
              <span className="text-gray-600 text-xs">m</span>
            </div>
            <button onClick={() => remove(i)} className="text-gray-700 hover:text-red-400 text-sm transition-colors shrink-0">×</button>
          </div>
        ))}
      </div>
      <button
        onClick={() => onConfirm(items)}
        disabled={items.length === 0}
        className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs rounded-lg font-semibold transition-colors"
      >
        ✓ Import {items.length} Module{items.length !== 1 ? 's' : ''}
      </button>
    </div>
  )
}

// ── Add Course Form ────────────────────────────────────────────────────────────
function AddCourseForm({ roadmapId, existingCourses, onDone }) {
  const addCourse = useRoadmapsStore((s) => s.addCourse)
  const bulkAddModules = useRoadmapsStore((s) => s.bulkAddModules)
  const [name, setName] = useState('')
  const [source, setSource] = useState('')
  const [url, setUrl] = useState('')
  const [emoji, setEmoji] = useState('📚')
  const [deadline, setDeadline] = useState('')
  const [defaultMode, setDefaultMode] = useState('inherit')
  const [prereqs, setPrereqs] = useState([])

  // Import state
  const [importTab, setImportTab] = useState(null) // null | 'youtube' | 'paste'
  const [pasteText, setPasteText] = useState('')
  const [fetchLoading, setFetchLoading] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const [previewModules, setPreviewModules] = useState(null) // null = not yet, [] = empty

  const urlIsPlaylist = isYouTubePlaylist(url)

  const handleUrlChange = (val) => {
    setUrl(val)
    setFetchError('')
    setPreviewModules(null)
    if (isYouTubePlaylist(val)) {
      setImportTab('youtube')
      if (!source) setSource('YouTube')
    }
  }

  const handleFetchYouTube = async () => {
    setFetchLoading(true)
    setFetchError('')
    setPreviewModules(null)
    try {
      const modules = await fetchYouTubePlaylist(url)
      setPreviewModules(modules)
      if (!name.trim()) {
        // Auto-fill course name prompt
      }
    } catch (err) {
      setFetchError(err.message || 'Failed to fetch playlist')
    } finally {
      setFetchLoading(false)
    }
  }

  const handleParsePaste = () => {
    setFetchError('')
    const modules = parseCurriculumText(pasteText)
    if (modules.length === 0) {
      setFetchError('No modules detected. Try a different format or check the text.')
      return
    }
    setPreviewModules(modules)
  }

  const save = (confirmedModules = null) => {
    if (!name.trim()) return
    const courseId = addCourse(roadmapId, {
      name: name.trim(), source: source.trim(), url: url.trim(),
      emoji, deadline: deadline || null, defaultMode,
      prerequisiteCourseIds: prereqs,
    })
    if (confirmedModules && confirmedModules.length > 0) {
      bulkAddModules(roadmapId, courseId, confirmedModules)
    }
    onDone()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
      className="bg-gray-750 border border-gray-600 rounded-xl p-4 space-y-3"
    >
      <h4 className="text-white text-sm font-semibold">Add Course</h4>

      {/* Name + Emoji */}
      <div className="flex gap-2">
        <EmojiPicker value={emoji} onChange={setEmoji} />
        <input value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Course name"
          className="flex-1 bg-gray-700 text-white text-sm rounded-lg px-3 py-1.5 border border-gray-600 focus:outline-none focus:border-blue-500 placeholder-gray-600" />
      </div>

      {/* Platform + URL */}
      <div className="space-y-1.5">
        <div className="flex gap-2">
          <input value={source} onChange={(e) => setSource(e.target.value)}
            placeholder="Platform (e.g. Udemy, YouTube)"
            className="w-36 bg-gray-700 text-white text-sm rounded-lg px-3 py-1.5 border border-gray-600 focus:outline-none focus:border-blue-500 placeholder-gray-600" />
          <input value={url} onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="Course URL — paste YouTube playlist to auto-import"
            className={`flex-1 bg-gray-700 text-white text-sm rounded-lg px-3 py-1.5 border focus:outline-none placeholder-gray-600 ${urlIsPlaylist ? 'border-red-500' : 'border-gray-600 focus:border-blue-500'}`} />
          {urlIsPlaylist && (
            <button
              onClick={handleFetchYouTube}
              disabled={fetchLoading}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs rounded-lg font-semibold transition-colors whitespace-nowrap flex items-center gap-1.5"
            >
              {fetchLoading ? (
                <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : '▶'}
              {fetchLoading ? 'Fetching…' : 'Fetch Modules'}
            </button>
          )}
        </div>

        {/* Manual paste option */}
        {!urlIsPlaylist && (
          <button
            onClick={() => setImportTab((t) => (t === 'paste' ? null : 'paste'))}
            className="text-xs text-gray-500 hover:text-blue-400 transition-colors"
          >
            📋 {importTab === 'paste' ? 'Hide' : 'Paste course curriculum to auto-detect modules'}
          </button>
        )}
      </div>

      {/* Paste curriculum input */}
      <AnimatePresence>
        {importTab === 'paste' && !urlIsPlaylist && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="space-y-2 overflow-hidden"
          >
            <p className="text-gray-500 text-xs">
              Go to the course page, copy all the curriculum/outline text, and paste it below.
              Works with Udemy, Coursera, YouTube descriptions, and plain outlines.
            </p>
            <textarea
              value={pasteText} onChange={(e) => setPasteText(e.target.value)}
              placeholder={"01. Introduction  05:32\n02. Setting Up  03:47\n…"}
              rows={5}
              className="w-full bg-gray-700 text-white text-xs rounded-lg px-3 py-2 border border-gray-600 focus:outline-none focus:border-blue-500 placeholder-gray-600 resize-none font-mono"
            />
            <button
              onClick={handleParsePaste}
              disabled={!pasteText.trim()}
              className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-40 text-white text-xs rounded-lg font-semibold transition-colors"
            >
              🔍 Detect Modules
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      {fetchError && (
        <p className="text-red-400 text-xs bg-red-950/30 border border-red-800/40 rounded-lg px-3 py-2">
          ⚠️ {fetchError}
        </p>
      )}

      {/* Import preview */}
      {previewModules && (
        <ImportPreview
          modules={previewModules}
          onConfirm={(confirmed) => save(confirmed)}
          onClear={() => setPreviewModules(null)}
        />
      )}

      {/* Deadline + Mode */}
      <div className="flex gap-3 items-start flex-wrap">
        <div>
          <label className="text-gray-500 text-xs mb-1 block">Deadline</label>
          <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)}
            className="bg-gray-700 text-white text-sm rounded-lg px-3 py-1.5 border border-gray-600 focus:outline-none focus:border-blue-500" />
        </div>
        <div>
          <label className="text-gray-500 text-xs mb-1 block">Default Mode</label>
          <ModeSelector value={defaultMode} onChange={setDefaultMode} includeInherit />
        </div>
      </div>

      {/* Prerequisites */}
      {existingCourses.length > 0 && (
        <div>
          <label className="text-gray-500 text-xs mb-1 block">Prerequisites (must complete first)</label>
          <div className="flex flex-wrap gap-2">
            {existingCourses.map((c) => (
              <button key={c.id}
                onClick={() => setPrereqs((p) => p.includes(c.id) ? p.filter((x) => x !== c.id) : [...p, c.id])}
                className={`px-2 py-1 rounded text-xs border transition-colors ${prereqs.includes(c.id) ? 'bg-blue-700 border-blue-500 text-white' : 'bg-gray-700 border-gray-600 text-gray-400 hover:text-white'}`}
              >
                {c.emoji} {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      {!previewModules && (
        <div className="flex gap-2 justify-end">
          <button onClick={onDone} className="px-3 py-1.5 text-gray-500 hover:text-white text-sm">Cancel</button>
          <button onClick={() => save()} disabled={!name.trim()}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm rounded-lg font-semibold transition-colors">
            Add Course
          </button>
        </div>
      )}
      {previewModules && (
        <div className="flex justify-end">
          <button onClick={onDone} className="px-3 py-1.5 text-gray-500 hover:text-white text-sm">Cancel</button>
        </div>
      )}
    </motion.div>
  )
}

// ── Add Module Form ────────────────────────────────────────────────────────────
function AddModuleForm({ roadmapId, courseId, existingModules, onDone }) {
  const addModule = useRoadmapsStore((s) => s.addModule)
  const [title, setTitle] = useState('')
  const [durationMins, setDurationMins] = useState(10)
  const [mode, setMode] = useState('inherit')
  const [prereqs, setPrereqs] = useState([])

  const save = () => {
    if (!title.trim()) return
    addModule(roadmapId, courseId, {
      title: title.trim(),
      durationMins: Number(durationMins) || 10,
      mode,
      prerequisiteModuleIds: prereqs,
    })
    onDone()
  }

  return (
    <tr>
      <td colSpan="5" className="px-3 py-2">
        <div className="bg-gray-750 border border-gray-600 rounded-lg p-3 space-y-2">
          <div className="flex gap-2 items-center flex-wrap">
            <input value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="Module title"
              className="flex-1 min-w-[160px] bg-gray-700 text-white text-sm rounded px-3 py-1.5 border border-gray-600 focus:outline-none focus:border-blue-500 placeholder-gray-600" />
            <div className="flex items-center gap-1">
              <input type="number" min="1" max="300" value={durationMins}
                onChange={(e) => setDurationMins(e.target.value)}
                className="w-16 bg-gray-700 text-white text-sm rounded px-2 py-1.5 border border-gray-600 text-center focus:outline-none focus:border-blue-500" />
              <span className="text-gray-500 text-xs">min raw</span>
            </div>
            <ModeSelector value={mode} onChange={setMode} includeInherit />
          </div>
          {existingModules.length > 0 && (
            <div className="flex flex-wrap gap-1 items-center">
              <span className="text-gray-500 text-xs">After:</span>
              {existingModules.map((m) => (
                <button key={m.id}
                  onClick={() => setPrereqs((p) => p.includes(m.id) ? p.filter((x) => x !== m.id) : [...p, m.id])}
                  className={`px-2 py-0.5 rounded text-xs border transition-colors ${prereqs.includes(m.id) ? 'bg-blue-700 border-blue-500 text-white' : 'bg-gray-700 border-gray-600 text-gray-400 hover:text-white'}`}
                >
                  {m.title}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <button onClick={onDone} className="px-3 py-1 text-gray-500 hover:text-white text-xs">Cancel</button>
            <button onClick={save} disabled={!title.trim()}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs rounded font-semibold">
              Add Module
            </button>
          </div>
        </div>
      </td>
    </tr>
  )
}

// ── Module Row ─────────────────────────────────────────────────────────────────
function ModuleRow({ module, course, roadmap, onStart }) {
  const updateModule = useRoadmapsStore((s) => s.updateModule)
  const deleteModule = useRoadmapsStore((s) => s.deleteModule)
  const effectiveMode = resolveMode(module, course, roadmap)
  const mins = allocatedMins(module, course, roadmap)
  const modeInfo = LEARNING_MODES[effectiveMode]
  const isInherited = !module.mode || module.mode === 'inherit'
  const isLocked = module.prerequisiteModuleIds?.some(
    (pid) => !course.modules.find((m) => m.id === pid)?.completedAt
  )

  return (
    <tr className={`border-t border-gray-700/50 group transition-colors ${module.completedAt ? 'opacity-50' : ''} ${isLocked ? 'opacity-40' : ''}`}>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          {module.completedAt ? (
            <span className="text-green-400 text-sm">✓</span>
          ) : isLocked ? (
            <span className="text-gray-600 text-sm" title="Locked — complete prerequisites first">🔒</span>
          ) : (
            <button
              onClick={() => !isLocked && onStart({ module, course, roadmap })}
              className="text-blue-400 hover:text-blue-300 text-xs px-2 py-0.5 bg-blue-900/20 rounded border border-blue-800/40 transition-colors whitespace-nowrap"
            >
              ▶ Run
            </button>
          )}
          <span className={`text-sm ${module.completedAt ? 'line-through text-gray-500' : 'text-white'}`}>
            {module.title}
          </span>
          {module.scheduledDate && !module.completedAt && (
            <span className={`text-xs px-1.5 py-0.5 rounded ${module.scheduledDate === todayStr() ? 'bg-blue-900/40 text-blue-400' : 'text-gray-600'}`}>
              {module.scheduledDate === todayStr() ? '📅 Today' : `📅 ${module.scheduledDate}`}
            </span>
          )}
        </div>
      </td>
      <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{module.durationMins}m raw</td>
      <td className="px-3 py-2">
        <ModeSelector
          value={module.mode || 'inherit'}
          onChange={(val) => updateModule(roadmap.id, course.id, module.id, { mode: val })}
          includeInherit
          size="xs"
        />
        {isInherited && (
          <span className="text-gray-600 text-xs ml-1">({effectiveMode})</span>
        )}
      </td>
      <td className="px-3 py-2 text-xs font-semibold text-blue-300 whitespace-nowrap">
        {mins}m allocated
      </td>
      <td className="px-3 py-2">
        <button
          onClick={() => deleteModule(roadmap.id, course.id, module.id)}
          className="text-gray-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all text-sm"
        >×</button>
      </td>
    </tr>
  )
}

// ── Course Section ─────────────────────────────────────────────────────────────
function CourseSection({ course, roadmap, onStart }) {
  const deleteCourse = useRoadmapsStore((s) => s.deleteCourse)
  const updateCourse = useRoadmapsStore((s) => s.updateCourse)
  const bulkAddModules = useRoadmapsStore((s) => s.bulkAddModules)
  const [addingModule, setAddingModule] = useState(false)
  const [collapsed, setCollapsed] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editEmoji, setEditEmoji] = useState(course.emoji)
  const [editName, setEditName] = useState(course.name)
  const [editSource, setEditSource] = useState(course.source || '')
  const [editUrl, setEditUrl] = useState(course.url || '')
  const [editDeadline, setEditDeadline] = useState(course.deadline || '')
  const [editPrereqs, setEditPrereqs] = useState(course.prerequisiteCourseIds || [])
  const [importMode, setImportMode] = useState(null) // null | 'youtube' | 'paste'
  const [importUrl, setImportUrl] = useState(course.url || '')
  const [pasteText, setPasteText] = useState('')
  const [fetchLoading, setFetchLoading] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const [previewModules, setPreviewModules] = useState(null)

  const saveEdit = () => {
    if (!editName.trim()) return
    updateCourse(roadmap.id, course.id, {
      name: editName.trim(),
      emoji: editEmoji,
      source: editSource.trim(),
      url: editUrl.trim(),
      deadline: editDeadline || null,
      prerequisiteCourseIds: editPrereqs,
    })
    setEditing(false)
  }

  const otherCourses = roadmap.courses.filter((c) => c.id !== course.id)

  const completedCount = course.modules.filter((m) => m.completedAt).length
  const total = course.modules.length
  const pct = total ? Math.round((completedCount / total) * 100) : 0
  const isLocked = (course.prerequisiteCourseIds || []).some(
    (pid) => !roadmap.courses.find((c) => c.id === pid)?.completed
  )

  return (
    <div className={`border border-gray-700 rounded-xl overflow-hidden mb-3 ${isLocked ? 'opacity-50' : ''}`}>
      {/* Course header */}
      {editing ? (
        <div className="px-4 py-3 bg-gray-800/80 space-y-2">
          <div className="flex gap-2">
            <input value={editEmoji} onChange={(e) => setEditEmoji(e.target.value)}
              className="w-12 bg-gray-700 text-white rounded px-2 py-1.5 text-center text-xl border border-gray-600 focus:outline-none focus:border-blue-500" />
            <input value={editName} onChange={(e) => setEditName(e.target.value)}
              placeholder="Course name"
              className="flex-1 bg-gray-700 text-white text-sm rounded px-3 py-1.5 border border-gray-600 focus:outline-none focus:border-blue-500 placeholder-gray-600" />
          </div>
          <div className="flex gap-2">
            <input value={editSource} onChange={(e) => setEditSource(e.target.value)}
              placeholder="Platform"
              className="w-32 bg-gray-700 text-white text-sm rounded px-3 py-1.5 border border-gray-600 focus:outline-none focus:border-blue-500 placeholder-gray-600" />
            <input value={editUrl} onChange={(e) => setEditUrl(e.target.value)}
              placeholder="URL"
              className="flex-1 bg-gray-700 text-white text-sm rounded px-3 py-1.5 border border-gray-600 focus:outline-none focus:border-blue-500 placeholder-gray-600" />
            <input type="date" value={editDeadline} onChange={(e) => setEditDeadline(e.target.value)}
              className="bg-gray-700 text-white text-sm rounded px-3 py-1.5 border border-gray-600 focus:outline-none focus:border-blue-500" />
          </div>
          {otherCourses.length > 0 && (
            <div>
              <label className="text-gray-500 text-xs mb-1 block">Prerequisites</label>
              <div className="flex flex-wrap gap-1.5">
                {otherCourses.map((c) => (
                  <button key={c.id}
                    onClick={() => setEditPrereqs((p) => p.includes(c.id) ? p.filter((x) => x !== c.id) : [...p, c.id])}
                    className={`px-2 py-0.5 rounded text-xs border transition-colors ${editPrereqs.includes(c.id) ? 'bg-blue-700 border-blue-500 text-white' : 'bg-gray-700 border-gray-600 text-gray-400 hover:text-white'}`}
                  >
                    {c.emoji} {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <button onClick={() => setEditing(false)} className="px-3 py-1 text-gray-500 hover:text-white text-xs">Cancel</button>
            <button onClick={saveEdit} disabled={!editName.trim()}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs rounded font-semibold transition-colors">
              Save
            </button>
          </div>
        </div>
      ) : (
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-800/80">
        <button onClick={() => setCollapsed((v) => !v)} className="text-gray-500 hover:text-gray-300 text-xs">
          {collapsed ? '▶' : '▼'}
        </button>
        <span className="text-xl">{course.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`font-semibold text-sm ${course.completed ? 'text-green-400' : 'text-white'}`}>
              {course.name}
            </span>
            {course.source && <span className="text-xs text-gray-500 bg-gray-700 px-1.5 rounded">{course.source}</span>}
            {isLocked && <span className="text-xs text-gray-600">🔒 Locked</span>}
            {course.completed && <span className="text-green-400 text-xs">✓ Complete</span>}
            {course.deadline && (
              <span className={`text-xs ${course.deadline < todayStr() ? 'text-red-400' : 'text-gray-500'}`}>
                📅 {course.deadline}
              </span>
            )}
          </div>
          {total > 0 && (
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 h-1 bg-gray-700 rounded-full overflow-hidden max-w-[120px]">
                <div className="h-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs text-gray-500">{completedCount}/{total}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div title="Course default mode">
            <ModeSelector
              value={course.defaultMode || 'inherit'}
              onChange={(val) => updateCourse(roadmap.id, course.id, { defaultMode: val })}
              includeInherit
              size="xs"
            />
          </div>
          <button
            onClick={() => {
              setEditEmoji(course.emoji)
              setEditName(course.name)
              setEditSource(course.source || '')
              setEditUrl(course.url || '')
              setEditDeadline(course.deadline || '')
              setEditPrereqs(course.prerequisiteCourseIds || [])
              setEditing(true)
            }}
            className="text-gray-600 hover:text-blue-400 text-sm transition-colors px-1"
            title="Edit course"
          >✎</button>
          <button
            onClick={() => deleteCourse(roadmap.id, course.id)}
            className="text-gray-600 hover:text-red-400 text-sm transition-colors"
          >×</button>
        </div>
      </div>
      )}

      {/* Modules table */}
      {!collapsed && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-t border-gray-700 bg-gray-800/40">
                <th className="px-3 py-1.5 text-left text-xs text-gray-500 font-medium">Module</th>
                <th className="px-3 py-1.5 text-left text-xs text-gray-500 font-medium">Raw</th>
                <th className="px-3 py-1.5 text-left text-xs text-gray-500 font-medium">Mode</th>
                <th className="px-3 py-1.5 text-left text-xs text-gray-500 font-medium">Allocated</th>
                <th className="px-3 py-1.5 w-6"></th>
              </tr>
            </thead>
            <tbody>
              {course.modules.map((m) => (
                <ModuleRow key={m.id} module={m} course={course} roadmap={roadmap} onStart={onStart} />
              ))}
              {addingModule && (
                <AddModuleForm
                  roadmapId={roadmap.id}
                  courseId={course.id}
                  existingModules={course.modules}
                  onDone={() => setAddingModule(false)}
                />
              )}
            </tbody>
          </table>
          {!addingModule && (
            <div className="border-t border-gray-700/50">
              <div className="flex">
                <button
                  onClick={() => setAddingModule(true)}
                  className="flex-1 py-2 text-xs text-gray-600 hover:text-gray-400 transition-colors"
                >
                  + Add Module
                </button>
                <button
                  onClick={() => {
                    setImportMode((m) => (m ? null : isYouTubePlaylist(importUrl) ? 'youtube' : 'paste'))
                    setFetchError('')
                    setPreviewModules(null)
                  }}
                  className="px-3 py-2 text-xs text-gray-600 hover:text-blue-400 border-l border-gray-700/50 transition-colors"
                  title="Bulk import modules from URL or pasted text"
                >
                  ⬇ Import
                </button>
              </div>

              {/* Import panel */}
              <AnimatePresence>
                {importMode && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden px-3 pb-3 space-y-2"
                  >
                    <div className="flex gap-2 items-center pt-2">
                      <input
                        value={importUrl}
                        onChange={(e) => {
                          setImportUrl(e.target.value)
                          setFetchError('')
                          setPreviewModules(null)
                        }}
                        placeholder="YouTube playlist URL, or leave blank to paste text below"
                        className="flex-1 bg-gray-700 text-white text-xs rounded px-3 py-1.5 border border-gray-600 focus:outline-none focus:border-blue-500 placeholder-gray-600"
                      />
                      {isYouTubePlaylist(importUrl) ? (
                        <button
                          onClick={async () => {
                            setFetchLoading(true)
                            setFetchError('')
                            setPreviewModules(null)
                            try {
                              const mods = await fetchYouTubePlaylist(importUrl)
                              setPreviewModules(mods)
                            } catch (err) {
                              setFetchError(err.message)
                            } finally {
                              setFetchLoading(false)
                            }
                          }}
                          disabled={fetchLoading}
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs rounded font-semibold whitespace-nowrap flex items-center gap-1"
                        >
                          {fetchLoading ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" /> : '▶'}
                          {fetchLoading ? 'Fetching…' : 'Fetch'}
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setFetchError('')
                            const mods = parseCurriculumText(pasteText)
                            if (!mods.length) { setFetchError('No modules detected'); return }
                            setPreviewModules(mods)
                          }}
                          disabled={!pasteText.trim()}
                          className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-40 text-white text-xs rounded font-semibold whitespace-nowrap"
                        >
                          🔍 Parse
                        </button>
                      )}
                    </div>

                    {!isYouTubePlaylist(importUrl) && (
                      <textarea
                        value={pasteText} onChange={(e) => setPasteText(e.target.value)}
                        placeholder={"01. Video title  05:32\n02. Next video  03:20\n…"}
                        rows={4}
                        className="w-full bg-gray-700 text-white text-xs rounded px-3 py-2 border border-gray-600 focus:outline-none focus:border-blue-500 placeholder-gray-600 resize-none font-mono"
                      />
                    )}

                    {fetchError && (
                      <p className="text-red-400 text-xs">⚠️ {fetchError}</p>
                    )}

                    {previewModules && (
                      <ImportPreview
                        modules={previewModules}
                        onConfirm={(confirmed) => {
                          bulkAddModules(roadmap.id, course.id, confirmed)
                          setImportMode(null)
                          setPreviewModules(null)
                        }}
                        onClear={() => setPreviewModules(null)}
                      />
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main RoadmapDetail ─────────────────────────────────────────────────────────
export default function RoadmapDetail({ roadmap, onClose, onStartModule }) {
  const updateRoadmap = useRoadmapsStore((s) => s.updateRoadmap)
  const setAutoInject = useRoadmapsStore((s) => s.setAutoInject)
  const assignSchedule = useRoadmapsStore((s) => s.assignSchedule)
  const roadmaps = useRoadmapsStore((s) => s.roadmaps)
  const addSuggestion = useAICoachStore((s) => s.addSuggestion)

  const [addingCourse, setAddingCourse] = useState(false)
  const [view, setView] = useState('list') // 'list' | 'tree'
  const [scheduling, setScheduling] = useState(false)
  const [conflicts, setConflicts] = useState([])
  const [editingMeta, setEditingMeta] = useState(false)
  const [metaDraft, setMetaDraft] = useState({})

  const openMetaEdit = () => {
    setMetaDraft({
      emoji: roadmap.emoji || '🗺️',
      name: roadmap.name || '',
      description: roadmap.description || '',
      deadline: roadmap.deadline || '',
      dailyCapMins: roadmap.dailyCapMins ?? 120,
      priority: roadmap.priority || 'medium',
    })
    setEditingMeta(true)
  }

  const saveMetaEdit = () => {
    const patch = {
      emoji: metaDraft.emoji.trim() || '🗺️',
      name: metaDraft.name.trim() || roadmap.name,
      description: metaDraft.description.trim(),
      deadline: metaDraft.deadline || null,
      dailyCapMins: Math.max(15, parseInt(metaDraft.dailyCapMins, 10) || 120),
      priority: metaDraft.priority || 'medium',
    }
    updateRoadmap(roadmap.id, patch)
    setEditingMeta(false)
  }

  const handleReschedule = () => {
    setScheduling(true)
    const { assignments, conflicts: newConflicts } = computeSchedule([roadmap])
    assignSchedule(assignments)

    if (newConflicts.length > 0) {
      setConflicts(newConflicts)
      for (const c of newConflicts) {
        const msg = c.type === 'path'
          ? `⚠️ Path deadline: ${c.message}`
          : `⚠️ Course deadline: "${c.title}" in ${c.courseName} can't fit before ${c.deadline}. Consider reducing daily cap or extending the course deadline.`
        addSuggestion(msg, 'warning')
      }
    } else {
      setConflicts([])
    }
    setScheduling(false)
  }

  const allModules = roadmap.courses.flatMap((c) => c.modules)
  const completedModules = allModules.filter((m) => m.completedAt).length
  const pct = allModules.length ? Math.round((completedModules / allModules.length) * 100) : 0

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 bg-black/70 flex items-stretch justify-end"
      onClick={onClose}
    >
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="w-full max-w-2xl bg-gray-900 flex flex-col h-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-800 shrink-0">
          {editingMeta ? (
            <div className="flex-1 flex flex-col gap-2">
              <div className="flex gap-2">
                <input
                  value={metaDraft.emoji}
                  onChange={(e) => setMetaDraft((d) => ({ ...d, emoji: e.target.value }))}
                  className="w-14 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-center text-lg"
                  maxLength={4}
                />
                <input
                  value={metaDraft.name}
                  onChange={(e) => setMetaDraft((d) => ({ ...d, name: e.target.value }))}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-sm font-bold"
                  placeholder="Path name"
                />
              </div>
              <input
                value={metaDraft.description}
                onChange={(e) => setMetaDraft((d) => ({ ...d, description: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-300 text-xs"
                placeholder="Description (optional)"
              />
              <div className="flex gap-2 items-center">
                <label className="text-gray-500 text-xs shrink-0">Deadline</label>
                <input
                  type="date"
                  value={metaDraft.deadline}
                  onChange={(e) => setMetaDraft((d) => ({ ...d, deadline: e.target.value }))}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-300 text-xs"
                />
                <label className="text-gray-500 text-xs shrink-0">Daily cap</label>
                <input
                  type="number"
                  min="15"
                  max="480"
                  value={metaDraft.dailyCapMins}
                  onChange={(e) => setMetaDraft((d) => ({ ...d, dailyCapMins: e.target.value }))}
                  className="w-20 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-300 text-xs"
                />
                <span className="text-gray-600 text-xs">min/day</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-gray-500 text-xs shrink-0">Task priority</label>
                <div className="flex gap-1">
                  {[['low','🟢'],['medium','🟡'],['high','🔴'],['urgent','⚡']].map(([v, em]) => (
                    <button
                      key={v}
                      onClick={() => setMetaDraft((d) => ({ ...d, priority: v }))}
                      className={`px-2 py-0.5 rounded text-xs font-semibold border transition-colors capitalize ${
                        metaDraft.priority === v
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'bg-gray-700 border-gray-600 text-gray-400 hover:text-white'
                      }`}
                    >
                      {em} {v}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={saveMetaEdit} className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold">Save</button>
                <button onClick={() => setEditingMeta(false)} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-xs">Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <span className="text-2xl">{roadmap.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-white font-bold text-lg truncate">{roadmap.name}</h2>
                  {/* Path level badge */}
                  {(() => {
                    const xp = roadmap.xpEarned || 0
                    const lv = Math.floor(xp / 200) + 1
                    return (
                      <span className="text-xs bg-indigo-900/50 text-indigo-300 border border-indigo-700/50 px-1.5 py-0.5 rounded font-bold">
                        Lv.{lv}
                      </span>
                    )
                  })()}
                  {roadmap.fastMasteryActive && <span className="text-xs bg-yellow-900/30 text-yellow-300 px-1.5 py-0.5 rounded">🌟 Mastery</span>}
                  {roadmap.priority && roadmap.priority !== 'medium' && (() => {
                    const map = { low: ['🟢','text-green-400 bg-green-900/20 border-green-800/40'], high: ['🔴','text-red-400 bg-red-900/20 border-red-800/40'], urgent: ['⚡','text-purple-400 bg-purple-900/20 border-purple-800/40'] }
                    const [em, cls] = map[roadmap.priority] || []
                    return em ? <span className={`text-xs px-1.5 py-0.5 rounded border font-semibold capitalize ${cls}`}>{em} {roadmap.priority}</span> : null
                  })()}
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5 flex-wrap">
                  {roadmap.deadline && <span>📅 {roadmap.deadline}</span>}
                  {roadmap.dailyCapMins && <span>⏱ {roadmap.dailyCapMins}m/day</span>}
                  <span>{allModules.length} modules · {pct}% done</span>
                  {roadmap.streak > 0 && <span className="text-orange-400">🔥 {roadmap.streak}d streak</span>}
                  {(roadmap.xpEarned || 0) > 0 && <span className="text-indigo-400">✨ {roadmap.xpEarned} XP</span>}
                  {(roadmap.studyMinutesTotal || 0) > 0 && (
                    <span className="text-gray-500">
                      📖 {roadmap.studyMinutesTotal >= 60
                        ? `${Math.floor(roadmap.studyMinutesTotal / 60)}h ${roadmap.studyMinutesTotal % 60}m`
                        : `${roadmap.studyMinutesTotal}m`} studied
                    </span>
                  )}
                </div>
                {/* XP bar */}
                {(roadmap.xpEarned || 0) > 0 && (() => {
                  const xp = roadmap.xpEarned || 0
                  const progress = xp % 200
                  return (
                    <div className="mt-1.5 h-1 bg-gray-800 rounded-full overflow-hidden w-full">
                      <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${(progress / 200) * 100}%` }} />
                    </div>
                  )
                })()}
                {roadmap.description && <p className="text-gray-600 text-xs mt-0.5 truncate">{roadmap.description}</p>}
              </div>
              <button onClick={openMetaEdit} title="Edit path details" className="text-gray-500 hover:text-gray-300 w-7 h-7 flex items-center justify-center rounded hover:bg-gray-800 text-base">✎</button>
            </>
          )}
          {!editingMeta && (
            <button onClick={onClose} className="text-gray-500 hover:text-white w-8 h-8 flex items-center justify-center rounded hover:bg-gray-800">✕</button>
          )}
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-800 shrink-0 flex-wrap">
          {/* View toggle */}
          <div className="flex bg-gray-800 rounded-lg p-0.5 mr-auto">
            {[
              { key: 'list',    icon: '☰',  label: 'List'    },
              { key: 'compact', icon: '⊞',  label: 'Compact' },
              { key: 'tree',    icon: '🌳', label: 'Tree'    },
            ].map(({ key, icon, label }) => (
              <button
                key={key}
                onClick={() => setView(key)}
                className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                  view === key ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                {icon} {label}
              </button>
            ))}
          </div>

          {/* Roadmap-level default mode */}
          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-xs">Roadmap mode:</span>
            <ModeSelector
              value={roadmap.defaultMode || 'normal'}
              onChange={(val) => updateRoadmap(roadmap.id, { defaultMode: val })}
            />
          </div>

          {/* Auto-inject toggle */}
          <button
            onClick={() => setAutoInject(roadmap.id, !roadmap.autoInjectTasks)}
            className={`px-3 py-1.5 text-xs rounded-lg border transition-colors font-semibold ${
              roadmap.autoInjectTasks
                ? 'bg-green-700/40 border-green-600 text-green-300'
                : 'bg-gray-800 border-gray-600 text-gray-500 hover:text-white'
            }`}
            title="Auto-create tasks in NovaDo when starting a module"
          >
            {roadmap.autoInjectTasks ? '✓ Auto-tasks ON' : '⊕ Auto-tasks'}
          </button>

          {/* Reschedule */}
          <button
            onClick={handleReschedule}
            disabled={scheduling}
            className="px-3 py-1.5 text-xs bg-purple-700 hover:bg-purple-600 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
          >
            {scheduling ? '⏳' : '📅 Reschedule'}
          </button>
        </div>

        {/* Conflict alerts */}
        {conflicts.length > 0 && (
          <div className="px-5 py-2 space-y-1 shrink-0">
            {conflicts.map((c, i) => (
              <div key={i} className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs border ${
                c.type === 'path'
                  ? 'bg-orange-900/20 border-orange-800/40 text-orange-300'
                  : 'bg-red-900/20 border-red-800/40 text-red-300'
              }`}>
                <span>{c.type === 'path' ? '🗓️' : '⚠️'}</span>
                <span>{c.message}</span>
                <button onClick={() => setConflicts((cs) => cs.filter((_, j) => j !== i))} className="ml-auto text-current opacity-60 hover:opacity-100">✕</button>
              </div>
            ))}
          </div>
        )}

        {/* Body */}
        {view === 'tree' ? (
          /* Tree view fills panel, no scroll */
          <div className="flex-1 px-4 py-3 min-h-0">
            <DependencyTree roadmap={roadmap} />
          </div>
        ) : view === 'compact' ? (
          /* Compact: horizontal kanban — one column per course */
          <div className="flex-1 overflow-x-auto overflow-y-hidden px-4 py-3">
            <div className="flex gap-3 h-full" style={{ minWidth: 'max-content' }}>
              {roadmap.courses.map((course) => {
                const completedCount = course.modules.filter((m) => m.completedAt).length
                const total = course.modules.length
                const pct = total ? Math.round((completedCount / total) * 100) : 0
                const isLocked = (course.prerequisiteCourseIds || []).some(
                  (pid) => !roadmap.courses.find((c) => c.id === pid)?.completed
                )
                return (
                  <div
                    key={course.id}
                    className={`flex flex-col w-52 shrink-0 rounded-xl border ${
                      isLocked ? 'opacity-50 border-gray-700' : 'border-gray-700'
                    } bg-gray-800/40`}
                  >
                    {/* Column header */}
                    <div className="px-3 pt-3 pb-2 border-b border-gray-700/60">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-base leading-none shrink-0">{course.emoji}</span>
                        <span className="text-white text-xs font-semibold truncate">{course.name}</span>
                        {isLocked && <span className="text-gray-600 text-xs shrink-0">🔒</span>}
                      </div>
                      {total > 0 && (
                        <div className="mt-1.5">
                          <div className="flex justify-between text-xs text-gray-500 mb-0.5">
                            <span>{completedCount}/{total}</span>
                            <span>{pct}%</span>
                          </div>
                          <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )}
                      {course.deadline && (
                        <div className="text-xs text-gray-600 mt-1">📅 {course.deadline}</div>
                      )}
                    </div>

                    {/* Module list */}
                    <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1.5">
                      {course.modules.length === 0 && (
                        <div className="text-gray-700 text-xs text-center py-4">No modules</div>
                      )}
                      {course.modules.map((module) => {
                        const isModLocked = (module.prerequisiteModuleIds || []).some(
                          (pid) => !course.modules.find((m) => m.id === pid)?.completedAt
                        )
                        return (
                          <div
                            key={module.id}
                            onClick={() => !module.completedAt && !isModLocked && onStartModule({ module, course, roadmap })}
                            className={`rounded-lg px-2.5 py-2 text-xs border transition-colors ${
                              module.completedAt
                                ? 'bg-green-900/20 border-green-800/30 text-green-500 line-through opacity-60'
                                : isModLocked
                                ? 'bg-gray-800/60 border-gray-700/40 text-gray-600 cursor-not-allowed'
                                : 'bg-gray-800 border-gray-600 text-gray-200 hover:border-blue-600 hover:bg-blue-900/20 cursor-pointer'
                            }`}
                          >
                            <div className="flex items-start gap-1.5">
                              <span className="shrink-0 mt-0.5">
                                {module.completedAt ? '✓' : isModLocked ? '🔒' : '▶'}
                              </span>
                              <span className="leading-tight">{module.title}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-gray-600">
                              <span>{module.durationMins}m</span>
                              {module.scheduledDate && !module.completedAt && (
                                <span className={module.scheduledDate === todayStr() ? 'text-blue-400' : ''}>
                                  📅 {module.scheduledDate === todayStr() ? 'Today' : module.scheduledDate}
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}

              {/* Add course placeholder */}
              {!addingCourse && (
                <button
                  onClick={() => setAddingCourse(true)}
                  className="flex-shrink-0 w-52 rounded-xl border border-dashed border-gray-700 hover:border-gray-500 text-gray-600 hover:text-gray-400 text-sm transition-colors flex items-center justify-center h-24 self-start mt-0"
                >
                  + Course
                </button>
              )}
            </div>

            {addingCourse && (
              <div className="mt-3 max-w-lg">
                <AddCourseForm
                  roadmapId={roadmap.id}
                  existingCourses={roadmap.courses}
                  onDone={() => setAddingCourse(false)}
                />
              </div>
            )}
          </div>
        ) : (
          /* List view */
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {roadmap.courses.map((course) => (
              <CourseSection
                key={course.id}
                course={course}
                roadmap={roadmap}
                onStart={onStartModule}
              />
            ))}

            {addingCourse ? (
              <AddCourseForm
                roadmapId={roadmap.id}
                existingCourses={roadmap.courses}
                onDone={() => setAddingCourse(false)}
              />
            ) : (
              <button
                onClick={() => setAddingCourse(true)}
                className="w-full py-3 border border-dashed border-gray-700 hover:border-gray-500 text-gray-500 hover:text-gray-300 text-sm rounded-xl transition-colors"
              >
                + Add Course
              </button>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}
