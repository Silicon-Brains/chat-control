import type { Config } from 'tailwindcss';

/** Tokens mirror docs/design.md — update there first, then here. */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { 300: '#8FBFBF', 500: '#3E8C8F', 600: '#2F7378' },
        ink: {
          400: 'var(--color-ink-400, #8A9A99)',
          600: 'var(--color-ink-600, #5A6B6A)',
          900: 'var(--color-ink-900, #1E2B2A)',
        },
        mint: '#CFE3E1',
        sky: '#BED3DB',
        lavender: '#C7C2EA',
        lemon: '#E7EBC9',
        accent: { purple: '#8E7CE6', pink: '#F06AA8', orange: '#F4A55B', slate: '#5E9CA6' },
        danger: '#E8707A',
        warning: '#F4A55B',
        success: '#3E8C8F',
        lime: '#B6D84A',
      },
      fontFamily: { sans: ['var(--font-jakarta)', 'Inter', 'system-ui', 'sans-serif'] },
      borderRadius: {
        card: '24px',
        tile: '16px',
        field: '14px',
        icon: '12px',
        bubble: '20px',
        modal: '28px',
      },
      boxShadow: {
        glass: '0 10px 30px rgba(47,115,120,0.12), inset 0 1px 0 rgba(255,255,255,0.8)',
        lift: '0 16px 40px rgba(47,115,120,0.20)',
      },
      backgroundImage: {
        'primary-gradient': 'linear-gradient(135deg, #3E8C8F, #2F7378)',
      },
      keyframes: {
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
        'fade-up': { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'none' } },
      },
      animation: {
        shimmer: 'shimmer 1.6s infinite',
        float: 'float 6s ease-in-out infinite',
        'fade-up': 'fade-up 220ms ease-out both',
      },
      maxWidth: { content: '1360px' },
    },
  },
  plugins: [],
};

export default config;
