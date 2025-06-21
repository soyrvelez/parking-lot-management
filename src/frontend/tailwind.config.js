/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        parking: {
          entry: '#10b981',
          exit: '#f59e0b',
          paid: '#3b82f6',
          error: '#ef4444',
        }
      },
      fontSize: {
        'operator': ['1.25rem', { lineHeight: '1.75rem' }],
        'display': ['2rem', { lineHeight: '2.5rem' }],
        'amount': ['1.5rem', { lineHeight: '2rem' }],
      },
      spacing: {
        'touch': '44px',
        'operator': '60px',
      }
    },
  },
  plugins: [],
};