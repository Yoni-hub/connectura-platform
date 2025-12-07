/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
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
