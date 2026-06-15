'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal = ({
  isOpen,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmModalProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={onCancel}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ type: 'spring', duration: 0.3, bounce: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white dark:bg-discord-card rounded-3xl border-4 border-gray-200 dark:border-discord-main p-6 shadow-2xl flex flex-col gap-4"
          >
            {/*  DYNAMIC ALERT ICON: Red for Light, Neon Pink for Dark */}
            <div className="flex items-center gap-3 text-red-500 dark:text-neon-pink">
              <div className="bg-red-100 dark:bg-neon-pink/20 p-2 rounded-xl">
                <AlertTriangle size={28} strokeWidth={2.5} />
              </div>
              <h2 className="text-2xl font-black text-gray-900 dark:text-gray-100 tracking-tight">
                {title}
              </h2>
            </div>

            <p className="text-gray-500 dark:text-gray-400 font-bold leading-relaxed">
              {description}
            </p>

            <div className="flex flex-col-reverse sm:flex-row gap-3 mt-4">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={onCancel}
                className="flex-1 py-3 rounded-xl font-black text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-discord-main hover:bg-gray-200 dark:hover:bg-[#383A40] transition-colors"
              >
                {cancelText}
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  onConfirm();
                  onCancel();
                }}
                //  DYNAMIC DANGER BUTTON: Red for Light, Neon Pink for Dark
                className="flex-1 py-3 rounded-xl font-black text-white bg-red-500 dark:bg-neon-pink hover:bg-red-600 dark:hover:bg-neon-pink-hover border-b-4 border-red-700 dark:border-neon-pink-border active:border-b-0 active:translate-y-1 transition-all"
              >
                {confirmText}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
