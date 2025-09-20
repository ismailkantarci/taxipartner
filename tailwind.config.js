/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './modules/**/*.{js,ts,html}'
  ],
  safelist: [
    // layout utilities used in modals that might not be present at build time
    'ml-72',
    'fixed', 'absolute', 'relative',
    'inset-0', 'top-0', 'left-0',
    'z-[1100]', 'z-[2000]', 'z-[2100]',
    'flex', 'items-center', 'justify-center',
    'p-4', 'p-6',
    'w-[95%]', 'max-w-[840px]', 'max-w-[520px]', 'max-h-[80vh]',
    'overflow-y-auto',
    'bg-black/40', 'bg-white', 'dark:bg-gray-900',
    'rounded-xl', 'shadow-2xl',
    // dynamic highlight during drag
    'ring-2', 'ring-blue-400',
  ],
  theme: {
    extend: {}
  },
  darkMode: 'class',
  plugins: []
}
