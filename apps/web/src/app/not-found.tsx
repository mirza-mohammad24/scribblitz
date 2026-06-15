import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
      {/* 🎨 A playful, broken pencil or eraser vibe */}
      <div className="text-[100px] leading-none mb-4 animate-bounce">✏️💨</div>
      <h2 className="text-4xl font-black text-gray-800 dark:text-gray-100 mb-2 tracking-tight">
        Page Erased!
      </h2>
      <p className="text-xl font-bold text-gray-500 dark:text-gray-400 mb-8 max-w-md">
        Looks like this page was rubbed out of existence, or the room code is invalid.
      </p>

      <Link
        href="/"
        className="bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white px-8 py-4 rounded-2xl font-black text-xl border-b-4 border-blue-700 active:border-b-0 active:translate-y-[4px] transition-all shadow-sm"
      >
        Return to Lobby
      </Link>
    </div>
  );
}
