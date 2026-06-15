'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Avoid the synchronous state update warning during hydration
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  const handleToggle = (e: React.MouseEvent) => {
    // Determine what we are switching to based on the current state
    const isCurrentlyDark = resolvedTheme === 'dark';
    const newTheme = isCurrentlyDark ? 'light' : 'dark';

    // Fallback for older browsers without View Transitions
    if (!document.startViewTransition) {
      setTheme(newTheme);
      return;
    }

    const x = e.clientX;
    const y = e.clientY;
    const endRadius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));

    // We need to know if the DESTINATION is dark for the animation direction
    const isDestinationDark = newTheme === 'dark';

    const transition = document.startViewTransition(() => {
      setTheme(newTheme);
    });

    transition.ready.then(() => {
      const clipPath = [`circle(0px at ${x}px ${y}px)`, `circle(${endRadius}px at ${x}px ${y}px)`];

      document.documentElement.animate(
        { clipPath: isDestinationDark ? clipPath.reverse() : clipPath },
        {
          duration: 800,
          easing: 'ease-in-out',
          pseudoElement: isDestinationDark
            ? '::view-transition-old(root)'
            : '::view-transition-new(root)',
          fill: 'forwards',
        },
      );
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
