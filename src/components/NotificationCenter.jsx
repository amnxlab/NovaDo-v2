import { motion, AnimatePresence } from 'framer-motion'
import useNotificationStore from '../store/notificationStore'

const TYPE_STYLES = {
  success: 'bg-green-900/95 border-green-700/60 text-green-100',
  warning: 'bg-yellow-900/95 border-yellow-700/60 text-yellow-100',
  error:   'bg-red-900/95 border-red-700/60 text-red-100',
  info:    'bg-gray-800/95 border-gray-600/60 text-gray-100',
}

const NotificationCenter = () => {
  const { notifications, clearNotification } = useNotificationStore()

  return (
    <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 w-80 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {notifications.map((n) => (
          <motion.div
            key={n.id}
            layout
            initial={{ x: 80, opacity: 0, scale: 0.95 }}
            animate={{ x: 0, opacity: 1, scale: 1 }}
            exit={{ x: 80, opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className={`relative flex items-start gap-3 px-4 py-3 rounded-xl border shadow-xl text-sm pointer-events-auto ${
              TYPE_STYLES[n.type] ?? TYPE_STYLES.info
            }`}
          >
            <span className="flex-1 pr-5 leading-snug break-words">{n.message}</span>
            <button
              onClick={() => clearNotification(n.id)}
              className="absolute top-2.5 right-3 text-current opacity-50 hover:opacity-100 text-base leading-none transition-opacity"
              aria-label="Dismiss"
            >
              ×
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

export default NotificationCenter