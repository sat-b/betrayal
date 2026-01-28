/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cooperate: {
          DEFAULT: '#22c55e',
          dark: '#16a34a',
        },
        betray: {
          DEFAULT: '#ef4444',
          dark: '#dc2626',
        },
      },
    },
  },
  plugins: [],
}
