/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{vue,js}'],
  theme: {
    extend: {
      colors: {
        bg: {
          base:    '#0B0F19', 
          surface: '#111827', 
          card:    'rgba(255, 255, 255, 0.04)', 
          border:  'rgba(255, 255, 255, 0.08)',
        },
        text: {
          base:     '#ffffff', 
          secondary: 'rgba(255, 255, 255, 0.7)', 
          muted:    'rgba(255, 255, 255, 0.45)', 
        },
        primary: {
          DEFAULT: '#7C3AED',
          dark:    '#5B21B6',
        },
        accent: {
          purple: '#7C3AED',
          blue:   '#3B82F6',
          cyan:   '#06B6D4',
          pink:   '#EC4899',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Montserrat', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        heading: ['Montserrat', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
        '3d': '0 15px 35px rgba(0,0,0,0.1), 0 5px 15px rgba(0,0,0,0.05)',
        glass: 'inset 0 0 0 1px rgba(255, 255, 255, 0.5)',
      },
      backdropBlur: {
        glass: '12px',
      }
    },
  },
  plugins: [],
}
