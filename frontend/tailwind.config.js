/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        dark: {
          900: '#0a0e1a',
          800: '#0f1629',
          700: '#151d36',
          600: '#1a2440',
          500: '#1e2b4a',
          400: '#253356',
        },
        accent: {
          green: '#00d4aa',
          red: '#ff4757',
          blue: '#4dabf7',
          yellow: '#ffd43b',
          purple: '#cc5de8',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}
