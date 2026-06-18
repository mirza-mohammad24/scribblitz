'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dices, Play, ArrowRightCircle } from 'lucide-react';
import { FaGithub, FaLinkedin } from 'react-icons/fa';
import { v4 as uuidv4 } from 'uuid';
import { createRoomSchema, joinRoomSchema } from '@scribblitz/validation';
import { Footer } from '../Footer';

const AVATAR_STORAGE_KEY = 'scribblitz_avatar_seed';
const USERNAME_STORAGE_KEY = 'scribblitz_username';

interface HomeScreenProps {
  onActionCreate: (username: string, avatarSeed: string) => void;
  onActionJoin: (username: string, roomCode: string, avatarSeed: string) => void;
}

export const HomeScreen = ({ onActionCreate, onActionJoin }: HomeScreenProps) => {
  const [username, setUsername] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [avatarSeed, setAvatarSeed] = useState('');
  const [mounted, setMounted] = useState(false);
  const [imageError, setImageError] = useState(false); //Tracks Dicebear API errors (e.g. rate limits) to show fallback avatar and avoid broken image icons

  const [nameError, setNameError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);

  const [nameShake, setNameShake] = useState(false);
  const [codeShake, setCodeShake] = useState(false);

  // Track keyboard state to push the bottom-sheet up
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [showMobileCard, setShowMobileCard] = useState(false);

  useEffect(() => {
    const hydrationTimer = setTimeout(() => {
      let saveSeed = localStorage.getItem(AVATAR_STORAGE_KEY);
      if (!saveSeed) {
        saveSeed = uuidv4(); // Generate a new seed if none exists
        localStorage.setItem(AVATAR_STORAGE_KEY, saveSeed);
      }
      setAvatarSeed(saveSeed);

      const savedName = localStorage.getItem(USERNAME_STORAGE_KEY);
      if (savedName) setUsername(savedName);

      setMounted(true);
    }, 0);
    return () => clearTimeout(hydrationTimer);
  }, []);

  const avatarUri = useMemo(() => {
    if (!avatarSeed) return '';
    const baseUrl = 'https://api.dicebear.com/10.x/micah/svg';
    return `${baseUrl}?seed=${avatarSeed}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf,f2c2e0,b4e2b9,ffeab6&radius=50&glassesProbability=30&facialHairProbability=20&earringsProbability=30`;
  }, [avatarSeed]);

  const handleRandomize = () => {
    const newSeed = uuidv4();
    setAvatarSeed(newSeed);
    setImageError(false); // Reset image error state when randomizing
    localStorage.setItem(AVATAR_STORAGE_KEY, newSeed);
  };

  const handleNameChange = (val: string) => {
    setUsername(val);
    if (nameError) setNameError(null);
  };

  const handleCodeChange = (val: string) => {
    setJoinCode(val.toUpperCase());
    if (codeError) setCodeError(null);
  };

  const triggerNameShake = () => {
    setNameShake(true);
    setTimeout(() => setNameShake(false), 400);
  };

  const triggerCodeShake = () => {
    setCodeShake(true);
    setTimeout(() => setCodeShake(false), 400);
  };

  const handleCreate = () => {
    const result = createRoomSchema.safeParse({
      username: username.trim(),
      avatarSeed,
    });
    if (!result.success) {
      const err = result.error.errors.find((e) => e.path.includes('username'));
      if (err) {
        setNameError(err.message);
        triggerNameShake();
      }
      return;
    }
    setNameError(null);

    localStorage.setItem(USERNAME_STORAGE_KEY, username.trim());

    onActionCreate(username.trim(), avatarSeed);
  };

  const handleJoin = () => {
    const result = joinRoomSchema.safeParse({
      username: username.trim(),
      roomCode: joinCode.trim(),
      avatarSeed,
    });

    let hasError = false;

    if (!result.success) {
      const nameErr = result.error.errors.find((e) => e.path.includes('username'));
      const codeErr = result.error.errors.find((e) => e.path.includes('roomCode'));

      if (nameErr) {
        setNameError(nameErr.message);
        triggerNameShake();
        hasError = true;
      }
      if (codeErr) {
        setCodeError(codeErr.message);
        triggerCodeShake();
        hasError = true;
      }
      if (hasError) return;
    }

    localStorage.setItem(USERNAME_STORAGE_KEY, username.trim());

    onActionJoin(username.trim(), joinCode.trim(), avatarSeed);
  };

  return (
    <div className="flex-1 w-full flex flex-col overflow-y-auto overflow-x-hidden hide-scrollbar relative">
      <div className="w-full flex flex-col items-center relative p-4 flex-1 justify-center md:flex-none md:justify-start md:my-auto md:py-8 shrink-0">
        {/* HEADER: Stays static on mobile & desktop */}
        <div
          className={`text-center transition-all duration-500 z-10 relative ${showMobileCard ? 'mb-2 md:mb-8' : 'mb-8'}`}
        >
          <div className="text-2xl lg:text-3xl font-bold text-gray-700 dark:text-gray-200 mb-2 flex items-center justify-center gap-2">
            <span className="relative inline-block">
              Skribbl.io
              <motion.span
                initial={{ width: 0 }}
                animate={{ width: '110%' }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  repeatType: 'loop',
                  repeatDelay: 3,
                  ease: 'easeInOut',
                }}
                className="absolute top-1/2 left-[-5%] h-1 bg-red-500 -translate-y-1/2 -rotate-2 rounded-full z-10 opacity-90"
              />
            </span>
            <span className="text-gray-500 dark:text-gray-400">grew up.</span>
          </div>

          <h1 className="text-5xl lg:text-7xl font-black tracking-tight drop-shadow-sm flex items-center justify-center flex-wrap gap-x-4">
            <motion.span
              className="flex flex-wrap justify-center gap-x-4 lg:gap-x-6"
              initial="hidden"
              animate="visible"
              variants={{
                hidden: { opacity: 1 },
                visible: { transition: { staggerChildren: 0.05, delayChildren: 0.2 } },
              }}
            >
              <span className="flex">
                {'Welcome to'.split('').map((letter, index) => (
                  <motion.span
                    key={`welcome-${index}`}
                    variants={{
                      hidden: { y: 20, opacity: 0 },
                      visible: {
                        y: 0,
                        opacity: 1,
                        transition: { type: 'spring', damping: 12, stiffness: 200 },
                      },
                    }}
                    className="text-gray-900 dark:text-gray-100 inline-block"
                  >
                    {letter === ' ' ? '\u00A0' : letter}
                  </motion.span>
                ))}
              </span>

              <span className="flex">
                {'Scribblitz.'.split('').map((letter, index) => (
                  <motion.span
                    key={`brand-${index}`}
                    variants={{
                      hidden: { y: 20, opacity: 0 },
                      visible: {
                        y: 0,
                        opacity: 1,
                        transition: { type: 'spring', damping: 12, stiffness: 200 },
                      },
                    }}
                    whileHover={{ y: -10, scale: 1.1, transition: { type: 'spring', bounce: 0.6 } }}
                    // Added whileTap for mobile screens to provide tactile feedback on tap
                    whileTap={{ y: -15, scale: 1.25, transition: { type: 'spring', bounce: 0.6 } }}
                    className="text-green-600 dark:text-neon-blue hover:text-red-600 dark:hover:text-neon-pink active:text-red-600 dark:active:text-neon-pink inline-block cursor-default transition-colors duration-75"
                  >
                    {letter}
                  </motion.span>
                ))}
              </span>
            </motion.span>
          </h1>
        </div>

        {/* MOBILE ONLY: Initial Play Button */}
        <AnimatePresence>
          {!showMobileCard && (
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20, scale: 0.9 }}
              onClick={() => setShowMobileCard(true)}
              className="md:hidden z-10 mt-8 flex items-center justify-center gap-3 bg-green-500 dark:bg-neon-blue hover:bg-green-600 dark:hover:bg-neon-blue-hover text-white px-10 py-5 rounded-full font-black text-2xl shadow-lg border-b-[6px] border-green-700 dark:border-neon-blue-border active:border-b-0 active:translate-y-1.5 transition-all w-full max-w-xs mx-auto"
            >
              <Play fill="currentColor" size={28} /> PLAY NOW
            </motion.button>
          )}
        </AnimatePresence>

        {/* The Dark Background Overlay for Mobile */}
        <AnimatePresence>
          {showMobileCard && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMobileCard(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 md:hidden"
            />
          )}
        </AnimatePresence>

        {/* RESPONSIVE CARD: Bottom Sheet on Mobile, Centered on Desktop */}
        <div
          className={`
          fixed bottom-0 left-0 w-full z-40 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
          md:relative md:w-full md:max-w-md md:translate-y-0
          ${showMobileCard ? 'translate-y-0' : 'translate-y-[120%]'}
        `}
        >
          <motion.div
            animate={{ paddingBottom: isKeyboardOpen ? '2.5rem' : '1.5rem' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="bg-white/95 dark:bg-discord-card/95 backdrop-blur-xl md:backdrop-blur-none p-6 lg:p-8 rounded-t-[2.5rem] md:rounded-4xl border-t-4 border-l-4 border-r-4 md:border-b-4 border-gray-200 dark:border-discord-main shadow-[0_-10px_40px_rgba(0,0,0,0.1)] md:shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)] dark:shadow-[0_-10px_40px_rgba(0,0,0,0.5)] md:dark:shadow-[8px_8px_0px_0px_rgba(0,0,0,0.5)] flex flex-col gap-6"
          >
            {/* Mobile swipe-down drag handle */}
            <div
              onClick={() => setShowMobileCard(false)}
              className="w-12 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto -mb-2 md:hidden cursor-pointer hover:bg-gray-400 transition-colors"
            />

            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                {!mounted ? (
                  <div className="w-32 h-32 rounded-full border-4 border-gray-200 dark:border-discord-main bg-gray-100 dark:bg-discord-main shadow-sm animate-pulse" />
                ) : imageError ? (
                  <motion.div
                    className="w-32 h-32 rounded-full border-4 border-gray-200 dark:border-discord-main shadow-sm flex items-center justify-center bg-linear-to-br from-green-400 to-red-500 dark:from-neon-blue dark:to-neon-pink text-white text-5xl font-black uppercase"
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    {username ? username.charAt(0) : '?'}
                  </motion.div>
                ) : (
                  <motion.img
                    src={avatarUri}
                    alt="Your Avatar"
                    onError={() => setImageError(true)}
                    className="w-32 h-32 rounded-full border-4 border-gray-200 dark:border-discord-main shadow-sm bg-gray-50 dark:bg-discord-main"
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  />
                )}

                <motion.button
                  onClick={handleRandomize}
                  whileHover={{ scale: 1.1, rotate: 15 }}
                  whileTap={{ scale: 0.9 }}
                  className="absolute -bottom-2 -right-2 bg-yellow-400 text-yellow-900 p-3 rounded-full border-4 border-white dark:border-discord-card shadow-md hover:bg-yellow-300 transition-colors z-10"
                  title="Randomize Avatar"
                >
                  <Dices size={24} strokeWidth={3} />
                </motion.button>
              </div>
            </div>

            <hr className="border-2 border-gray-100 dark:border-discord-main rounded-full" />

            <div className="flex flex-col gap-1">
              <motion.div
                animate={{ x: nameShake ? [-10, 10, -10, 10, 0] : 0 }}
                transition={{ duration: 0.4 }}
              >
                <input
                  suppressHydrationWarning
                  type="text"
                  placeholder="Your Username"
                  value={username}
                  onChange={(e) => handleNameChange(e.target.value)}
                  onFocus={() => setIsKeyboardOpen(true)}
                  onBlur={() => setIsKeyboardOpen(false)}
                  maxLength={20}
                  className={`w-full p-4 border-4 rounded-2xl font-black text-xl text-center focus:outline-none transition-colors bg-gray-50 dark:bg-discord-main ${
                    nameError
                      ? 'border-red-500 focus:border-red-600 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400'
                      : 'border-gray-200 dark:border-discord-main dark:text-gray-100 focus:border-green-500 dark:focus:border-neon-blue'
                  }`}
                />
              </motion.div>
              {nameError && (
                <span className="text-red-500 font-bold text-sm text-center">{nameError}</span>
              )}
            </div>

            <motion.button
              onClick={handleCreate}
              whileTap={{ scale: 0.97 }}
              className="w-full flex items-center justify-center gap-2 bg-green-500 dark:bg-neon-blue hover:bg-green-600 dark:hover:bg-neon-blue-hover text-white p-4 rounded-2xl font-black text-xl border-b-4 border-green-700 dark:border-neon-blue-border active:border-b-0 active:translate-y-1 transition-all"
            >
              <Play fill="currentColor" size={24} /> Create Room
            </motion.button>

            <div className="flex items-center gap-4 py-2">
              <hr className="flex-1 border-2 border-gray-100 dark:border-discord-main rounded-full" />
              <span className="font-black text-gray-300 dark:text-gray-500 uppercase tracking-widest text-sm">
                Or Join
              </span>
              <hr className="flex-1 border-2 border-gray-100 dark:border-discord-main rounded-full" />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex gap-3">
                <motion.div
                  className="flex-1"
                  animate={{ x: codeShake ? [-10, 10, -10, 10, 0] : 0 }}
                  transition={{ duration: 0.4 }}
                >
                  <input
                    suppressHydrationWarning
                    type="text"
                    placeholder="XXXXXX"
                    value={joinCode}
                    onChange={(e) => handleCodeChange(e.target.value)}
                    onFocus={() => setIsKeyboardOpen(true)}
                    onBlur={() => setIsKeyboardOpen(false)}
                    maxLength={6}
                    className={`w-full p-4 border-4 rounded-2xl font-black text-xl text-center tracking-[0.2em] uppercase focus:outline-none transition-colors bg-gray-50 dark:bg-discord-main ${
                      codeError
                        ? 'border-red-500 focus:border-red-600 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400'
                        : 'border-gray-200 dark:border-discord-main dark:text-gray-100 focus:border-red-600 dark:focus:border-neon-pink'
                    }`}
                  />
                </motion.div>
                <motion.button
                  onClick={handleJoin}
                  whileTap={{ scale: 0.95 }}
                  className="bg-red-600 dark:bg-neon-pink hover:bg-red-700 dark:hover:bg-neon-pink-hover text-white px-6 rounded-2xl font-black text-xl flex items-center justify-center border-b-4 border-red-800 dark:border-neon-pink-border active:border-b-0 active:translate-y-1 transition-all"
                >
                  <ArrowRightCircle size={28} strokeWidth={2.5} />
                </motion.button>
              </div>
              {codeError && (
                <span className="text-red-500 font-bold text-sm text-center">{codeError}</span>
              )}
            </div>

            {/* Mobile Footer Links */}
            <div className="md:hidden mt-2 flex justify-center gap-6 text-gray-400 dark:text-gray-500">
              <a
                href="https://github.com/mirza-mohammad24/scribblitz/"
                target="_blank"
                rel="noreferrer"
                className="hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <FaGithub size={24} />
              </a>
              <a
                href="https://www.linkedin.com/in/mirza-mohammad-abbas/"
                target="_blank"
                rel="noreferrer"
                className="hover:text-blue-500 dark:hover:text-neon-blue transition-colors"
              >
                <FaLinkedin size={24} />
              </a>
            </div>
          </motion.div>
        </div>
      </div>

      {/*Our footer*/}
      <Footer />
    </div>
  );
};
