/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0a0b0e',
          900: '#0e1014',
          850: '#13161c',
          800: '#181c24',
          700: '#212632',
          600: '#2c3340',
          500: '#3a4252',
        },
        accent: {
          DEFAULT: '#6366f1',
          soft: '#818cf8',
          dim: '#4f46e5',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
