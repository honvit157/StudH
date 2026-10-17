/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        duo: {
          green: '#58cc02',
          'green-dark': '#46a302',
          red: '#ff4b4b',
          'red-dark': '#ea2b2b',
          blue: '#1cb0f6',
          'blue-dark': '#1899d6',
          yellow: '#ffc800',
          'yellow-dark': '#e5a400',
          gray: '#e5e5e5',
          'gray-dark': '#afafaf',
          dark: '#131f24',
          'dark-card': '#1b2a32',
          'dark-border': '#2a3b45',
        }
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'duo': '0 4px 0 0 rgba(0,0,0,0.2)',
        'duo-pressed': '0 1px 0 0 rgba(0,0,0,0.2)',
        'duo-green': '0 4px 0 0 #46a302',
        'duo-blue': '0 4px 0 0 #1899d6',
        'duo-red': '0 4px 0 0 #ea2b2b',
      }
    },
  },
  plugins: [],
}
