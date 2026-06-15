'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Dices, Play, ArrowRightCircle } from 'lucide-react';
import { createRoomSchema, joinRoomSchema } from '@scribblitz/validation';

const AVATAR_STORAGE_KEY = 'scribblitz_avatar_seed';
const USERNAME_STORAGE_KEY = 'scribblitz_username';

interface SplashScreenProps {
  onActionCreate: (username: string, avatarSeed: string) => void;
  onActionJoin: (username: string, roomCode: string, avatarSeed: string) => void;
}

export const SplashScreen = ({ onActionCreate, onActionJoin }: SplashScreenProps) => {
  const [username, setUsername] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [avatarSeed, setAvatarSeed] = useState('');
  const [mounted, setMounted] = useState(false);
  const [imageError, setImageError] = useState(false); //Tracks Dicebear API errors (e.g. rate limits) to show fallback avatar and avoid broken image icons

  const [nameError, setNameError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);

  const [nameShake, setNameShake] = useState(false);
  const [codeShake, setCodeShake] = useState(false);

  useEffect(() => {
    const hydrationTimer = setTimeout(() => {
      let saveSeed = localStorage.getItem(AVATAR_STORAGE_KEY);
      if (!saveSeed) {
        saveSeed = crypto.randomUUID(); // Generate a new seed if none exists
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
    const newSeed = crypto.randomUUID();
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
    <div className="flex-1 w-full flex flex-col items-center justify-center p-4 min-h-0">
      <div className="text-center mb-8">
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
              className="absolute top-1/2 -left-[5%] h-[4px] bg-red-500 -translate-y-1/2 -rotate-2 rounded-full z-10 opacity-90"
            />
          </span>
          <span className="text-gray-500 dark:text-gray-400">grew up.</span>
        </div>

        <h1 className="text-5xl lg:text-7xl font-black tracking-tight drop-shadow-sm flex items-center justify-center flex-wrap gap-x-4">
          <motion.span
            className="flex flex-wrap justify-center gap-x-[1rem] lg:gap-x-[1.5rem]"
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
                  whileHover={{
                    y: -10,
                    scale: 1.1,
                    transition: { type: 'spring', bounce: 0.6 },
                  }}
                  className="text-green-600 dark:text-neon-blue hover:text-red-600 dark:hover:text-neon-pink inline-block cursor-default transition-colors duration-75"
                >
                  {letter}
                </motion.span>
              ))}
            </span>
          </motion.span>
        </h1>
      </div>

      <div className="bg-white dark:bg-discord-card p-6 lg:p-8 rounded-[2rem] border-4 border-gray-200 dark:border-discord-main shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)] dark:shadow-[8px_8px_0px_0px_rgba(0,0,0,0.5)] w-full max-w-md flex flex-col gap-6">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            {!mounted ? (
              <div className="w-32 h-32 rounded-full border-4 border-gray-200 dark:border-discord-main bg-gray-100 dark:bg-discord-main shadow-sm animate-pulse" />
            ) : imageError ? (
              // THE FALLBACK: If DiceBear fails we show a simple colored circle with the user's initial.
              <motion.div
                className="w-32 h-32 rounded-full border-4 border-gray-200 dark:border-discord-main shadow-sm flex items-center justify-center bg-gradient-to-br from-green-400 to-red-500 dark:from-neon-blue dark:to-neon-pink text-white text-5xl font-black uppercase"
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              >
                {username ? username.charAt(0) : '?'}
              </motion.div>
            ) : (
              // The DiceBear Avatar
              <motion.img
                src={avatarUri}
                alt="Your Avatar"
                onError={() => setImageError(true)} // If this fails to load it instantly switches to the Fallback
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
              type="text"
              placeholder="Your Username"
              value={username}
              onChange={(e) => handleNameChange(e.target.value)}
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
                type="text"
                placeholder="XXXXXX"
                value={joinCode}
                onChange={(e) => handleCodeChange(e.target.value)}
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
              //
              className="bg-red-600 dark:bg-neon-pink hover:bg-red-700 dark:hover:bg-neon-pink-hover text-white px-6 rounded-2xl font-black text-xl flex items-center justify-center border-b-4 border-red-800 dark:border-neon-pink-border active:border-b-0 active:translate-y-1 transition-all"
            >
              <ArrowRightCircle size={28} strokeWidth={2.5} />
            </motion.button>
          </div>
          {codeError && (
            <span className="text-red-500 font-bold text-sm text-center">{codeError}</span>
          )}
        </div>
      </div>
    </div>
  );
};
