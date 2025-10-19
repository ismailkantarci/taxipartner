/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    './modules/**/*.module.{js,ts}',
    './frontend/index.html',
    './frontend/src/**/*.{js,ts,jsx,tsx}',
    './frontend/src/**/*.html',
    './frontend/modules/**/*.module.{js,ts}'
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
    extend: {
      colors: {
        brand: {
          50: '#f4f8ff',
          100: '#e6efff',
          200: '#c7dbff',
          300: '#9fbfff',
          400: '#6e9bff',
          500: '#3b75ff',
          600: '#285be0',
          700: '#2149b1',
          800: '#1e3f90',
          900: '#1b376f'
        }
      }
    }
  },
  darkMode: 'class',
  plugins: []
}
