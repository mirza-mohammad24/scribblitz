'use client';

/**
 * @module WhyScribblitzModal
 * @description An animated marketing modal that highlights the core reasons
 * Scribblitz feels responsive and polished, including the backend FSM, synced
 * timers, custom word support, and mobile-first layout.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, Server, Gamepad2, Smartphone, ShieldCheck, WifiOff } from 'lucide-react';

interface WhyScribblitzModalProps {
  isOpen: boolean;
  onClose: (action?: 'play') => void; //if play intent received it will help in triggering the animation
}

/**
 * Renders the informational modal that explains the product's key technical
 * and UX advantages through an animated feature grid and dismissible backdrop.
 * @param {WhyScribblitzModalProps} props - The component props.
 * @param {boolean} props.isOpen - Whether the modal is visible.
 * @param {() => void} props.onClose - Callback fired when the user dismisses the modal.
 * @returns {React.JSX.Element} The animated "Why Scribblitz" modal JSX.
 */
export const WhyScribblitzModal = ({ isOpen, onClose }: WhyScribblitzModalProps) => {
  const features = [
    {
      icon: <Server size={18} />,
      badgeStyle:
        'bg-blue-50 dark:bg-blue-900/20 text-blue-500 border-blue-200 dark:border-blue-800',
      title: 'State-Machine Backend',
      description:
        'A server-authoritative Finite State Machine (FSM) guarantees deterministic game flow and prevents race conditions during every round.',
    },
    {
      icon: <Zap size={18} />,
      badgeStyle:
        'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-500 border-yellow-200 dark:border-yellow-800',
      title: 'Zero-Latency Canvas',
      description:
        'Drawing strokes are streamed in real time with an event-sourced pipeline, keeping every canvas smooth and perfectly synchronized.',
    },
    {
      icon: <WifiOff size={18} />,
      badgeStyle:
        'bg-cyan-50 dark:bg-neon-blue/20 text-cyan-600 dark:text-neon-blue border-cyan-200 dark:border-neon-blue-border',
      title: 'Smart Reconnect',
      description:
        'Lost your connection? Scribblitz automatically reserves your seat for 60 seconds, letting you rejoin the same match without disrupting the game and preserving your progress.',
    },
    {
      icon: <ShieldCheck size={18} />,
      badgeStyle:
        'bg-purple-50 dark:bg-purple-900/20 text-purple-500 border-purple-200 dark:border-purple-800',
      title: 'Absolute Time Sync',
      description:
        'Timers run on absolute server timestamps, meaning browser tab-throttling will never desync your game clock.',
    },
    {
      icon: <Gamepad2 size={18} />,
      badgeStyle:
        'bg-green-50 dark:bg-green-900/20 text-green-500 border-green-200 dark:border-green-800',
      title: 'Strict Custom Words',
      description:
        'Play with your own custom word packs only, giving every lobby a unique theme without relying on the default dictionary.',
    },
    {
      icon: <Smartphone size={18} />,
      badgeStyle:
        'bg-orange-50 dark:bg-orange-900/20 text-orange-500 border-orange-200 dark:border-orange-800',
      title: 'Mobile-First Design',
      description:
        'Unlike legacy drawing games, the UI was engineered from day one to look and feel like a native mobile app.',
    },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop layer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onClose()} //should not trigger the animation
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm cursor-pointer"
          />

          {/* Modal Wrapper */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-2xl bg-white dark:bg-discord-card rounded-4xl border-4 border-gray-200 dark:border-discord-main p-6 md:p-8 shadow-2xl flex flex-col gap-6 relative pointer-events-auto max-h-[90vh]"
            >
              <button
                onClick={() => onClose()} //should not trigger the animation
                className="absolute top-6 right-6 text-gray-400 hover:text-red-500 dark:hover:text-neon-pink transition-colors bg-gray-100 dark:bg-discord-main p-2 rounded-full active:scale-95"
              >
                <X size={20} strokeWidth={3} />
              </button>

              {/* Header */}
              <div className="flex items-center gap-3 border-b-2 border-gray-100 dark:border-discord-main pb-4 mt-2 shrink-0">
                <div className="bg-green-100 dark:bg-neon-blue/20 p-2.5 rounded-xl text-green-600 dark:text-neon-blue">
                  <Zap size={24} strokeWidth={2.5} />
                </div>
                <div>
                  <h2 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-gray-100 tracking-tight leading-none">
                    Why Scribblitz?
                  </h2>
                  <p className="text-xs font-bold text-gray-500 mt-1">
                    Next-generation architecture built for pure chaos.
                  </p>
                </div>
              </div>

              {/* Feature Grid */}
              <div className="overflow-y-auto custom-scrollbar -mr-2 pr-2 flex-1 min-h-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {features.map((feature, idx) => (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-2xl bg-gray-50 dark:bg-discord-main border-2 border-gray-100 dark:border-gray-800/80 flex gap-3.5 items-start`}
                    >
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center font-black shrink-0 border-2 shadow-xs ${feature.badgeStyle}`}
                      >
                        {feature.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-black text-sm text-gray-800 dark:text-gray-200">
                          {feature.title}
                        </h4>
                        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => onClose('play')} //will trigger the animation on the card which shows create/join buttons
                className="w-full mt-2 bg-green-500 dark:bg-neon-blue hover:bg-green-600 dark:hover:bg-neon-blue-hover text-white py-3.5 rounded-xl font-black text-lg border-b-4 border-green-700 dark:border-neon-blue-border active:border-b-0 active:translate-y-1 transition-all shadow-sm shrink-0"
              >
                Awesome! Let&apos;s Play
              </button>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};
