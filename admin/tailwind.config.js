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
        /** Violet tool palette — player app stays blue (#2b4bee). */
        primary: '#7c3aed',
        accent: '#7c3aed',
        'admin-canvas': 'rgb(var(--admin-canvas) / <alpha-value>)',
        'admin-panel': 'rgb(var(--admin-panel) / <alpha-value>)',
        'admin-muted-surface': 'rgb(var(--admin-muted-surface) / <alpha-value>)',
        'admin-sidebar': 'rgb(var(--admin-sidebar) / <alpha-value>)',
        'admin-sidebar-fg': 'rgb(var(--admin-sidebar-fg) / <alpha-value>)',
        'admin-sidebar-muted': 'rgb(var(--admin-sidebar-muted) / <alpha-value>)',
        'admin-sidebar-hover': 'rgb(var(--admin-sidebar-hover) / <alpha-value>)',
        'admin-fg': 'rgb(var(--admin-fg) / <alpha-value>)',
        'admin-muted': 'rgb(var(--admin-muted) / <alpha-value>)',
        'admin-border': 'rgb(var(--admin-border) / <alpha-value>)',
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
