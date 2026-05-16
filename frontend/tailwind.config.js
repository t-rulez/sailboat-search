/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#050d1a',
          900: '#0a1628',
          800: '#0f2040',
          700: '#162d58',
          600: '#1e3d73',
        },
        rope: {
          300: '#e8d5b0',
          400: '#d4b896',
          500: '#c09a6a',
          600: '#a07848',
        },
        compass: {
          red: '#c0392b',
          gold: '#d4a017',
        }
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        body: ['"Source Serif 4"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
