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
        brand: {
          50: '#EEF2FF',
          100: '#E0E7FF',
          200: '#C7D2FE',
          300: '#A5B4FC',
          400: '#818CF8',
          500: '#6366F1',
          600: '#4F46E5',
          700: '#4338CA',
          800: '#3730A3',
          900: '#312E81',
          DEFAULT: '#4F46E5',
        },
        pastel: {
          purple: "#6366F1",
          purpleLight: "#818CF8",
          purpleDark: "#4F46E5",
          purpleHover: "#4338CA",
          purpleSubtle: "#EEF2FF",
          bg: "#F8FAFC",
          surface: "#FFFFFF",
        }
      },
      boxShadow: {
        'xs': '0 1px 2px 0 rgba(15, 23, 42, 0.05)',
        'card': '0 1px 3px 0 rgba(15, 23, 42, 0.08), 0 1px 2px -1px rgba(15, 23, 42, 0.04)',
        'card-hover': '0 10px 25px -5px rgba(79, 70, 229, 0.12), 0 4px 10px -2px rgba(15, 23, 42, 0.04)',
        'float': '0 20px 30px -10px rgba(79, 70, 229, 0.18)',
      },
      borderRadius: {
        'custom': '16px',
        '2xl': '16px',
        '3xl': '20px',
        '4xl': '24px',
      }
    },
  },
  plugins: [],
}
