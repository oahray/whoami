/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#2b4bee',
        'background-light': '#f6f6f8',
        'background-dark': '#101322',
        'app-bg': 'rgb(var(--color-app-bg) / <alpha-value>)',
        surface: {
          DEFAULT: 'rgb(var(--color-surface) / <alpha-value>)',
          muted: 'rgb(var(--color-surface-muted) / <alpha-value>)',
          elevated: 'rgb(var(--color-surface-elevated) / <alpha-value>)',
        },
        foreground: {
          DEFAULT: 'rgb(var(--color-foreground) / <alpha-value>)',
          muted: 'rgb(var(--color-foreground-muted) / <alpha-value>)',
        },
        edge: 'rgb(var(--color-edge) / <alpha-value>)',
      },
      fontFamily: {
        display: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0.5rem',
        lg: '1rem',
        xl: '1.5rem',
        '2xl': '2rem',
        '3xl': '2.5rem',
        full: '9999px',
      },
      keyframes: {
        'loading-dot': {
          '0%, 70%, 100%': { opacity: '0.2' },
          '35%': { opacity: '1' },
        },
      },
      animation: {
        'loading-dot': 'loading-dot 1.1s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
