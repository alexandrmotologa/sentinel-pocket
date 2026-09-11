/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        tg: {
          bg: 'var(--tg-theme-bg-color, #0e1621)',
          text: 'var(--tg-theme-text-color, #ffffff)',
          hint: 'var(--tg-theme-hint-color, #708499)',
          link: 'var(--tg-theme-link-color, #64b5f6)',
          button: 'var(--tg-theme-button-color, #2b5278)',
          buttonText: 'var(--tg-theme-button-text-color, #ffffff)',
          secondaryBg: 'var(--tg-theme-secondary-bg-color, #17212b)',
          headerBg: 'var(--tg-theme-header-bg-color, #17212b)',
          accent: 'var(--tg-theme-accent-text-color, #64b5f6)',
          destructive: 'var(--tg-theme-destructive-text-color, #e53935)',
        },
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};
