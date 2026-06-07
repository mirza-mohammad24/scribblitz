'use client';

import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  // Prevent Hydration Mismatch FOUC (Flash of Unstyled Content)
  // We only render the UI once the component has mounted on the client
  const [mounted, setMounted] = useState(false);
  // ============================================================================
  // FIX: THE HYDRATION MISMATCH CATCH-22 (Why we break the React rules here)
  // ============================================================================
  // 1. The Next.js Server renders the initial HTML. It has NO access to the
  //    browser's localStorage, so it blindly guesses the theme is "Light".
  // 2. The Browser downloads the HTML. `next-themes` checks localStorage
  //    and realizes the user actually saved "Dark" mode.
  // 3. If React tries to hydrate the Dark icons while the server sent Light
  //    HTML, React panics and throws a massive "Hydration Mismatch" error.
  //
  // SOLUTION: We force React to wait. By setting `mounted` to true inside
  // a useEffect, we skip rendering the icons during the server-side pass
  // and only render them once the browser is 100% in control.
  useEffect(() => {
    // eslint-disable-next-line
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="flex items-center gap-1 p-1 bg-gray-200 dark:bg-gray-900 rounded-lg border border-gray-300 dark:border-gray-800 w-fit">
      <button
        onClick={() => setTheme('light')}
        className={`p-2 rounded-md transition-all duration-200 ${
          theme === 'light'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-500 hover:text-gray-900'
        }`}
        title="Light Mode"
      >
        <Sun className="w-4 h-4" />
      </button>

      <button
        onClick={() => setTheme('system')}
        className={`p-2 rounded-md transition-all duration-200 ${
          theme === 'system'
            ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm'
            : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-100'
        }`}
        title="System Default"
      >
        <Monitor className="w-4 h-4" />
      </button>

      <button
        onClick={() => setTheme('dark')}
        className={`p-2 rounded-md transition-all duration-200 ${
          theme === 'dark'
            ? 'bg-gray-800 text-gray-100 shadow-sm'
            : 'text-gray-500 hover:text-gray-100'
        }`}
        title="Dark Mode"
      >
        <Moon className="w-4 h-4" />
      </button>
    </div>
  );
}
