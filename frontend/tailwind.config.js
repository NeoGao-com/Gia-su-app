/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      colors: {
        pastel: {
          purple: "#9382f6",
          purpleLight: "#b8acf8",
          purpleDark: "#6c5ce7",
          purpleHover: "#5a48e4",
          purpleSubtle: "#f3f0ff",
          bg: "#f8f9fe",
          surface: "#ffffff",
        }
      },
      boxShadow: {
        'xs': '0 1px 2px 0 rgba(0, 0, 0, 0.04)',
        'card': '0 2px 12px -2px rgba(108, 92, 231, 0.07), 0 1px 4px 0 rgba(0, 0, 0, 0.03)',
        'card-hover': '0 14px 28px -6px rgba(108, 92, 231, 0.14), 0 4px 10px -2px rgba(0, 0, 0, 0.04)',
        'float': '0 20px 40px -10px rgba(108, 92, 231, 0.22)',
      },
      borderRadius: {
        'custom': '22px',
        '3xl': '24px',
        '4xl': '32px',
      }
    },
  },
  plugins: [],
}
