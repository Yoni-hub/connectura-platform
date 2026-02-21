/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Source Sans 3"', '"Helvetica Neue"', 'Arial', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
      },
      fontSize: {
        body: ['1rem', { lineHeight: '1.5rem' }],
        label: ['0.875rem', { lineHeight: '1.25rem' }],
        caption: ['0.75rem', { lineHeight: '1rem' }],
      },
      lineHeight: {
        body: '1.5rem',
        copy: '1.625',
      },
      colors: {
        primary: '#0f766e',
        accent: '#0ea5e9',
        midnight: '#0f172a',
        sand: '#f1f5f9',
      },
    },
  },
  plugins: [],
}
