'use client';

/**
 * @file ArenaLeaderboard.tsx — Animated, auto-sorting player leaderboard sidebar.
 *
 * Displays all players ranked by score (descending) with rich visual feedback
 * for rank changes, podium status, and player state (drawing, guessed, offline).
 *
 * ## Rank-Change Tracking
 * A `useEffect` keyed on the serialised player order (`orderKey`) compares the
 * current rank of each player against their previous rank (stored in a ref).
 * Two types of transitions are detected:
 * - Overtake (promotion): A player moved to a lower (better) index. Triggers
 *   an 800 ms scale-pulse "boost" animation on their card.
 * - Podium entry: A player entered the top 3 for the first time (or returned
 *   from outside). Triggers a 1100 ms expanding ring + glow "celebration" burst.
 * Both effect sets are managed via `Set<string>` state and auto-cleared by timers
 * that are cleaned up on unmount.
 *
 * ## Podium Beam Animation
 * Top-3 player cards display a sweeping light beam effect. Rather than running
 * independent CSS animations (which can drift or desync across cards), a single
 * Framer Motion `useAnimationFrame` loop writes a `--beam-progress` CSS custom
 * property (0 → 1, looping over {@link BEAM_DURATION_MS}) to the leaderboard's
 * root element via direct DOM mutation (zero React re-renders). Each podium card
 * reads this inherited variable in its `backgroundPosition`, guaranteeing
 * mathematical lockstep across Gold, Silver, and Bronze beams.
 *
 * ## Visual Tiers
 * - Gold (rank 1): Yellow gradient, trophy icon, warm beam glow.
 * - Silver (rank 2): Slate gradient, medal icon, neutral beam.
 * - Bronze (rank 3): Orange/amber gradient, award icon, warm beam.
 * - Rank 3+: Plain card with `#index` label.
 * - Offline players: Dashed border, grey scale avatar, dimmed opacity.
 *
 * @see {@link ArenaOrchestrator} — parent that renders this component
 */

import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { motion, AnimatePresence, useAnimationFrame } from 'framer-motion';
import { Trophy, Medal, Award, Pencil, WifiOff, CheckCircle2 } from 'lucide-react';
import Image from 'next/image';

/**
 * Animated player leaderboard with live rank sorting, podium beam effects,
 * and rank-change celebration animations.
 *
 * Reads players and the current drawer ID from the Zustand game store, sorts
 * by score descending, and renders each player as a spring-animated list item.
 * Rank changes trigger short-lived visual effects (overtake pulse, podium burst).
 *
 * @returns The leaderboard sidebar element with header and scrollable player list.
 */
export const ArenaLeaderboard = () => {
  const { players, currentDrawerId } = useGameStore();

  // Sort players dynamically by score (descending)
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  const podiumStyles = {
    0: {
      // GOLD
      border: 'border-yellow-500 dark:border-yellow-500',
      bg: 'bg-gradient-to-br from-yellow-300 to-yellow-500 dark:from-yellow-900/30 dark:to-yellow-800/20',
      text: 'text-yellow-900 dark:text-yellow-400',
      ring: 'ring-yellow-400 dark:ring-yellow-500',
      icon: <Trophy size={18} className="text-yellow-700 dark:text-yellow-500 drop-shadow-sm" />,
      beamGlow: 'rgba(250, 204, 21, 0.55)',
      glowShadow: 'rgba(234, 179, 8, 0.55)',
      celebrationColor: 'rgba(250, 204, 21, 0.9)',
    },
    1: {
      // SILVER
      border: 'border-slate-400 dark:border-gray-400',
      bg: 'bg-gradient-to-br from-slate-200 to-slate-400 dark:from-gray-800/40 dark:to-gray-700/40',
      text: 'text-slate-900 dark:text-gray-300',
      ring: 'ring-slate-400 dark:ring-gray-400',
      icon: <Medal size={18} className="text-slate-700 dark:text-gray-500 drop-shadow-sm" />,
      beamGlow: 'rgba(226, 232, 240, 0.55)',
      glowShadow: 'rgba(156, 163, 175, 0.5)',
      celebrationColor: 'rgba(226, 232, 240, 0.9)',
    },
    2: {
      // BRONZE
      border: 'border-orange-500 dark:border-amber-600',
      bg: 'bg-gradient-to-br from-orange-300 to-orange-500 dark:from-amber-900/30 dark:to-amber-800/20',
      text: 'text-orange-950 dark:text-amber-500',
      ring: 'ring-amber-600 dark:ring-amber-600',
      icon: <Award size={18} className="text-orange-800 dark:text-amber-600 drop-shadow-sm" />,
      beamGlow: 'rgba(217, 119, 6, 0.55)',
      glowShadow: 'rgba(180, 83, 9, 0.5)',
      celebrationColor: 'rgba(217, 119, 6, 0.9)',
    },
  };

  // --- Rank-change tracking: powers the overtake boost + podium-entry celebration ---
  const prevRankRef = useRef<Map<string, number>>(new Map());
  const timersRef = useRef<number[]>([]);
  const [boostedIds, setBoostedIds] = useState<Set<string>>(new Set());
  const [celebratingIds, setCelebratingIds] = useState<Set<string>>(new Set());

  // Stable key that only changes when the actual ORDER of players changes
  const orderKey = sortedPlayers.map((p) => p.id).join('|');

  useEffect(() => {
    const prevRank = prevRankRef.current;
    const promoted = new Set<string>();
    const enteredPodium = new Set<string>();

    sortedPlayers.forEach((player, index) => {
      const prevIndex = prevRank.get(player.id);

      // Moved to a numerically lower (better) index than before => overtook someone
      if (prevIndex !== undefined && index < prevIndex) {
        promoted.add(player.id);
      }

      // Newly inside the top 3
      if (prevRank.size > 0 && index <= 2 && (prevIndex === undefined || prevIndex > 2)) {
        enteredPodium.add(player.id);
      }
    });

    if (promoted.size > 0) {
      setBoostedIds((prev) => new Set([...prev, ...promoted]));
      const t = window.setTimeout(() => {
        setBoostedIds((prev) => {
          const next = new Set(prev);
          promoted.forEach((id) => next.delete(id));
          return next;
        });
      }, 800); // cinematic overtake window
      timersRef.current.push(t);
    }

    if (enteredPodium.size > 0) {
      setCelebratingIds((prev) => new Set([...prev, ...enteredPodium]));
      const t = window.setTimeout(() => {
        setCelebratingIds((prev) => {
          const next = new Set(prev);
          enteredPodium.forEach((id) => next.delete(id));
          return next;
        });
      }, 1100); // one-time celebration burst duration
      timersRef.current.push(t);
    }

    const nextRank = new Map<string, number>();
    sortedPlayers.forEach((p, i) => nextRank.set(p.id, i));
    prevRankRef.current = nextRank;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderKey]);

  // Clean up any pending timers if the component unmounts mid-animation.
  useEffect(() => {
    const currentTimers = timersRef.current;
    return () => {
      currentTimers.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  // --- Synchronized podium beam clock ---
  // One Framer Motion rAF loop writes a single progress value (0 -> 1, looping)
  // onto a CSS custom property on this component's root element. Every podium
  // card's beam reads that same inherited variable in its own backgroundPosition,
  // so Gold/Silver/Bronze are mathematically guaranteed to be in lockstep --
  // no per-card timelines, no drift, no desync on remount.
  const leaderboardRef = useRef<HTMLDivElement>(null);
  const BEAM_DURATION_MS = 4800;

  useAnimationFrame((time) => {
    if (!leaderboardRef.current) return;
    const progress = (time % BEAM_DURATION_MS) / BEAM_DURATION_MS;
    // Direct DOM mutation, not React state -- runs every frame with zero re-renders.
    leaderboardRef.current.style.setProperty('--beam-progress', progress.toString());
  });

  return (
    <div
      ref={leaderboardRef}
      className="w-full h-full bg-gray-50/50 dark:bg-discord-main border-4 border-gray-200 dark:border-discord-card rounded-2xl md:rounded-3xl p-3 md:p-4 flex flex-col gap-3 overflow-hidden shadow-inner"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-2 shrink-0 border-b-2 border-gray-200 dark:border-discord-card pb-2">
        <h2 className="font-black text-gray-800 dark:text-gray-100 uppercase tracking-widest text-sm flex items-center gap-2">
          <Trophy size={16} className="text-green-500 dark:text-neon-blue" />
          Leaderboard
        </h2>
        <span className="text-xs font-bold text-gray-400 dark:text-gray-500 bg-gray-200 dark:bg-discord-card px-2 py-0.5 rounded-full">
          {players.length} Players
        </span>
      </div>

      {/* The Smooth Scrolling and Auto-Sorting List */}
      <div className="flex-1 overflow-y-auto hide-scrollbar -mx-2 px-2 pb-2 pt-4 md:pt-5">
        <ul className="flex flex-col gap-2 relative">
          <AnimatePresence>
            {sortedPlayers.map((player, index) => {
              const isDrawer = player.id === currentDrawerId;
              const isPodium = index <= 2;
              const style = podiumStyles[index as keyof typeof podiumStyles];

              const isOffline = !player.isConnected;
              const hasGuessed = player.hasGuessedCorrectly;

              const isBoosted = boostedIds.has(player.id);
              const isCelebrating = celebratingIds.has(player.id);

              return (
                <motion.li
                  key={player.id}
                  layout="position"
                  transition={{
                    type: 'spring',
                    stiffness: 110,
                    damping: 18,
                    mass: 1.1,
                  }}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
                  className="relative z-10 hover:z-20 group"
                >
                  <motion.div
                    animate={isBoosted ? { scale: [1, 1.07, 1] } : { scale: 1 }}
                    transition={isBoosted ? { duration: 0.8, ease: 'easeOut' } : { duration: 0.3 }}
                  >
                    <div
                      className={`
                        relative overflow-hidden w-full rounded-2xl p-2.5 flex items-center gap-3 transition-all duration-300 border-2
                        ${
                          isOffline
                            ? 'border-dashed border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800/50 opacity-60'
                            : isPodium
                              ? `${style.border} ${style.bg} -translate-y-0.5`
                              : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-discord-card'
                        }
                      `}
                      style={
                        isPodium && !isOffline
                          ? {
                              boxShadow: `0 10px 22px -6px rgba(0,0,0,0.35), 0 0 0 1px ${style.glowShadow}, 0 0 26px -4px ${style.glowShadow}`,
                            }
                          : undefined
                      }
                    >
                      {/* PODIUM ENERGY SYSTEM */}
                      {isPodium && !isOffline && (
                        <>
                          <div
                            className="absolute inset-0 rounded-2xl ring-2 pointer-events-none opacity-60 animate-pulse"
                            style={{ boxShadow: `inset 0 0 0 1px ${style.glowShadow}` }}
                          />

                          {/*LIGHT MODE BEAM*/}
                          <div
                            className="absolute inset-0 pointer-events-none podium-beam opacity-100 mix-blend-normal dark:hidden"
                            style={{
                              backgroundImage: `linear-gradient(135deg, transparent 35%, rgba(255,255,255,0.8) 45%, #ffffff 50%, rgba(255,255,255,0.8) 55%, transparent 65%)`,
                              backgroundSize: '300% 300%',
                              backgroundPosition:
                                'calc(var(--beam-progress, 0) * 100%) calc((1 - var(--beam-progress, 0)) * 100%)',
                              filter: 'blur(1px)',
                            }}
                          />

                          {/*DARK MODE BEAM*/}
                          <div
                            className="absolute inset-0 pointer-events-none podium-beam hidden dark:block opacity-80 mix-blend-screen"
                            style={{
                              backgroundImage: `linear-gradient(135deg, transparent 45%, ${style.beamGlow} 47.5%, #ffffff 50%, ${style.beamGlow} 52.5%, transparent 55%)`,
                              backgroundSize: '300% 300%',
                              backgroundPosition:
                                'calc(var(--beam-progress, 0) * 100%) calc((1 - var(--beam-progress, 0)) * 100%)',
                              filter: 'blur(3px)',
                            }}
                          />
                        </>
                      )}
                      {/* Podium entry celebration */}
                      <AnimatePresence>
                        {isCelebrating && (
                          <motion.div
                            key="celebration"
                            className="absolute inset-0 rounded-2xl pointer-events-none"
                            initial={{ opacity: 0, scale: 0.88 }}
                            animate={{ opacity: [0, 0.85, 0], scale: [0.88, 1.12, 1.28] }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 1.1, ease: 'easeOut' }}
                            style={{
                              boxShadow: `0 0 0 3px ${style.celebrationColor}, 0 0 36px 8px ${style.celebrationColor}`,
                            }}
                          />
                        )}
                      </AnimatePresence>

                      {/* Rank Number / Podium Icon */}
                      <div className="w-6 flex justify-center shrink-0">
                        {isPodium && !isOffline ? (
                          style.icon
                        ) : (
                          <span className="font-black text-gray-400 dark:text-gray-500 text-sm">
                            #{index + 1}
                          </span>
                        )}
                      </div>

                      {/* Avatar */}
                      <div className="relative shrink-0">
                        <Image
                          src={`https://api.dicebear.com/10.x/micah/svg?seed=${player.avatarSeed || player.username}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf,f2c2e0,b4e2b9,ffeab6&radius=50&glassesProbability=30&facialHairProbability=20&earringsProbability=30`}
                          alt={player.username}
                          width={40}
                          height={40}
                          unoptimized
                          className={`w-10 h-10 rounded-full border-2 bg-gray-50 dark:bg-discord-main
                            ${
                              isOffline
                                ? 'border-gray-400 grayscale'
                                : isPodium
                                  ? style.border
                                  : 'border-gray-200 dark:border-gray-600'
                            }
                          `}
                        />
                        {isDrawer && !isOffline && (
                          <div className="absolute -bottom-1 -right-1 bg-white dark:bg-discord-main p-1 rounded-full shadow-sm border border-gray-200 dark:border-gray-700 animate-bounce z-20">
                            <Pencil size={10} className="text-gray-800 dark:text-gray-200" />
                          </div>
                        )}
                        {isOffline && (
                          <div className="absolute -bottom-1 -right-1 bg-red-100 dark:bg-red-900/50 p-1 rounded-full shadow-sm border border-red-200 dark:border-red-800 z-20">
                            <WifiOff size={10} className="text-red-500 dark:text-neon-pink" />
                          </div>
                        )}
                      </div>

                      {/* Player Details */}
                      <div className="flex flex-col flex-1 min-w-0 z-10">
                        <span
                          className={`font-black truncate text-sm transition-colors
                            ${
                              isOffline
                                ? 'text-gray-500 dark:text-gray-500'
                                : isPodium
                                  ? style.text
                                  : 'text-gray-700 dark:text-gray-200'
                            }
                          `}
                        >
                          {player.username}
                        </span>

                        <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 mt-0.5 shrink-0">
                          {isOffline ? (
                            <span className="text-gray-400 dark:text-gray-500">Disconnected</span>
                          ) : hasGuessed ? (
                            <span className="text-green-600 dark:text-neon-blue flex items-center gap-1 bg-green-100/80 dark:bg-blue-900/50 px-1.5 py-0.5 rounded-md w-fit shadow-sm">
                              <CheckCircle2 size={10} strokeWidth={3} /> Guessed
                            </span>
                          ) : isDrawer ? (
                            <span className="text-purple-500 dark:text-neon-pink">Drawing</span>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500">Guessing</span>
                          )}
                        </span>
                      </div>

                      {/* Score */}
                      <div className="shrink-0 flex items-center justify-end min-w-13.75 z-10">
                        <motion.span
                          key={player.score}
                          initial={{ scale: 1.5, y: -5 }}
                          animate={{ scale: 1, y: 0 }}
                          className={`font-black text-lg ${isOffline ? 'text-gray-400' : 'text-gray-800 dark:text-white'}`}
                        >
                          {player.score}
                        </motion.span>
                      </div>
                    </div>
                  </motion.div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      </div>
    </div>
  );
};
