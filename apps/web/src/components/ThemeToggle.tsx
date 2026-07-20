/**
 * This component is a theme toggle button that allows users to switch between light and dark modes.
 * The button also updates the favicon based on the current theme.
 */
'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { useGameStore } from '../store/gameStore';
import { GameState } from '@scribblitz/types';

/**
 * ThemeToggle component for switching between light and dark modes.
 */
export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const gameState = useGameStore((state) => state.gameState);

  useEffect(() => {
    // Avoid the synchronous state update warning during hydration
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  //Sync the Favicon with the theme state!
  useEffect(() => {
    if (!mounted) return;

    const faviconHref = resolvedTheme === 'dark' ? '/icon-dark.svg' : '/icon-light.svg';

    // Find the existing favicon link tag, or create one if it doesn't exist
    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }

    // Swap the image source dynamically
    link.href = faviconHref;
  }, [resolvedTheme, mounted]);

  const handleToggle = (e: React.MouseEvent) => {
    // Determine what we are switching to based on the current state
    const isCurrentlyDark = resolvedTheme === 'dark';
    const newTheme = isCurrentlyDark ? 'light' : 'dark';

    const isMobile = window.innerWidth < 768;
    //Evaluate the FSM
    const isGameInProgress = gameState !== null && gameState !== GameState.LOBBY;

    // Fallback for older browsers without View Transitions and to avoid the transition effect during mobile gameplay
    if (!document.startViewTransition || (isMobile && isGameInProgress)) {
      setTheme(newTheme);
      return;
    }

    //animation only for desktop (for all states even in game in progress) and for mobile only in lobby state and landing page
    const x = e.clientX;
    const y = e.clientY;
    const endRadius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const dpr = window.devicePixelRatio || 1;

    // Calculate dynamic speed: 0.75ms per pixel of distance
    // Clamped between 400ms (fastest for tiny phones) and 1000ms (slowest for huge ultra-wides)
    const baseDuration = Math.min(Math.max(endRadius * 0.75, 400), 1000);
    const dynamicDuration = baseDuration * dpr; // Adjust for device pixel ratio

    document.documentElement.style.setProperty('--click-x', `${x * dpr}px`);
    document.documentElement.style.setProperty('--click-y', `${y * dpr}px`);
    document.documentElement.style.setProperty('--click-radius', `${endRadius * dpr}px`);

    document.documentElement.style.setProperty('--transition-duration', `${dynamicDuration}ms`);

    document.startViewTransition(() => {
      flushSync(() => {
        document.documentElement.classList.toggle('dark', newTheme === 'dark');
        setTheme(newTheme);
      });
    });
  };

  if (!mounted) {
    //Placeholder matches the button size to prevent layout shift during hydration, but is invisible and non-interactive
    return (
      <div className="w-12 h-12 bg-gray-200 dark:bg-discord-card rounded-full border-2 border-gray-300 dark:border-discord-main animate-pulse" />
    );
  }

  const isDark = resolvedTheme === 'dark';

  return (
    <button
      onClick={handleToggle}
      className="w-12 h-12 flex items-center justify-center rounded-full bg-white dark:bg-discord-card border-2 border-gray-200 dark:border-discord-main text-gray-500 dark:text-gray-300 shadow-sm hover:text-green-500 dark:hover:text-neon-blue hover:scale-105 active:scale-95 transition-all duration-200"
      title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
    >
      {/* Shows the current state's icon */}
      {isDark ? <Moon size={22} strokeWidth={2.5} /> : <Sun size={22} strokeWidth={2.5} />}
    </button>
  );
}
