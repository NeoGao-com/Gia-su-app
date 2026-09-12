/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        pastel: {
          purple: "#9382f6",
          purpleLight: "#b8acf8",
          purpleDark: "#6c5ce7",
          bg: "#f8f9fe",
        }
      },
      borderRadius: {
        'custom': '22px',
      }
    },
  },
  plugins: [],
}
