'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useToastStore, ToastType } from '@/store/toastStore';

const toastConfig: Record<ToastType, { icon: React.ReactNode; styles: string }> = {
  success: {
    icon: (
      <CheckCircle2 className="text-green-500 dark:text-neon-blue" size={24} strokeWidth={2.5} />
    ),
    styles:
      'border-green-500 dark:border-neon-blue bg-green-50 dark:bg-discord-card text-green-800 dark:text-green-400',
  },
  error: {
    icon: <AlertCircle className="text-red-500 dark:text-neon-pink" size={24} strokeWidth={2.5} />,
    styles:
      'border-red-500 dark:border-neon-pink bg-red-50 dark:bg-discord-card text-red-800 dark:text-red-400',
  },
  info: {
    icon: <Info className="text-blue-500 dark:text-blue-400" size={24} strokeWidth={2.5} />,
    styles:
      'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-discord-card text-blue-800 dark:text-blue-300',
  },
};

export const ToastManager = () => {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-100 flex flex-col gap-3 w-full max-w-sm pointer-events-none px-4">
      <AnimatePresence>
        {toasts.map((toast) => {
          const config = toastConfig[toast.type];

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -50, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
              layout
              className={`pointer-events-auto flex items-center justify-between gap-3 p-4 rounded-2xl border-2 shadow-xl backdrop-blur-md transition-colors ${config.styles}`}
            >
              <div className="flex items-center gap-3 font-bold">
                {config.icon}
                <p className="dark:text-gray-100">{toast.message}</p>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
              >
                <X size={20} strokeWidth={3} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
