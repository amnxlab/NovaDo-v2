import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useCustomizationStore from '../store/customizationStore'

const CustomizationPanel = () => {
  const {
    colorScheme,
    animationIntensity,
    fontSize,
    backgroundPattern,
    highContrast,
    toggleColorScheme,
    setAnimationIntensity,
    setFontSize,
    setBackgroundPattern,
    toggleHighContrast,
  } = useCustomizationStore()
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 z-50 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
        aria-label="Open customization"
      >
        🎨 Customize
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
            <h3 className="text-lg font-bold text-white mb-4">Sensory Customization</h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-white">High Contrast</span>
                <input
                  type="checkbox"
                  checked={highContrast}
                  onChange={toggleHighContrast}
                  className="h-5 w-5"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-white">Color Scheme</span>
                <select
                  value={colorScheme}
                  onChange={(e) => toggleColorScheme()}
                  className="bg-gray-700 text-white px-3 py-1 rounded"
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-white">Animation Intensity</span>
                <select
                  value={animationIntensity}
                  onChange={(e) => setAnimationIntensity(e.target.value)}
                  className="bg-gray-700 text-white px-3 py-1 rounded"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-white">Font Size</span>
                <select
                  value={fontSize}
                  onChange={(e) => setFontSize(e.target.value)}
                  className="bg-gray-700 text-white px-3 py-1 rounded"
                >
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-white">Background</span>
                <select
                  value={backgroundPattern}
                  onChange={(e) => setBackgroundPattern(e.target.value)}
                  className="bg-gray-700 text-white px-3 py-1 rounded"
                >
                  <option value="none">None</option>
                  <option value="geometric">Geometric</option>
                  <option value="nature">Nature</option>
                  <option value="abstract">Abstract</option>
                </select>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export default CustomizationPanel
