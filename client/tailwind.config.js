/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Warm-white canvas system (Sauna-inspired calm light UI).
        // Numbered ink-* keep existing class names but map to light surfaces.
        canvas: '#F6F4F0',
        paper: '#FFFFFF',
        mist: '#EFEEEA',
        line: {
          DEFAULT: '#E4E0D8',
          strong: '#D4CFC5',
        },
        ink: {
          DEFAULT: '#1C1917',
          soft: '#57534E',
          faint: '#A8A29E',
          950: '#F6F4F0',
          900: '#FFFFFF',
          850: '#FAF9F7',
          800: '#EFEEEA',
          700: '#E4E0D8',
          600: '#D4CFC5',
          500: '#A8A29E',
        },
        accent: {
          DEFAULT: '#5C6B52',
          soft: '#7A8A6E',
          dim: '#4A5742',
          mist: '#EEF1EC',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        brand: ['var(--font-brand)', 'ui-serif', 'Georgia', 'serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: {
        xl: '14px',
        '2xl': '16px',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(28, 25, 23, 0.04), 0 4px 16px rgba(28, 25, 23, 0.04)',
        lift: '0 2px 8px rgba(28, 25, 23, 0.06)',
      },
      transitionDuration: {
        calm: '180ms',
      },
    },
  },
  plugins: [],
};
