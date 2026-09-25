/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./*.html",
    "./tools/**/*.html",
    "./about/**/*.html",
    "./resources/**/*.html",
    "./free-hosting/**/*.html",
    "./assets/js/**/*.js"
  ],
  theme: {
    extend: {
      fontFamily: {
        'source-sans-pro': ['"Source Sans Pro"', 'Roboto', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        roboto: ['Roboto', '"Source Sans Pro"', 'Inter', 'system-ui', 'sans-serif'],
        inter: ['Inter', 'Roboto', '"Source Sans Pro"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        tor: {
          violet: '#7c3aed',
          'violet-light': '#8b5cf6',
          'violet-dark': '#5b21b6',
          'violet-deep': '#4c1d95',
          'violet-soft': '#ede9fe',
          accent: '#68B030',
          'accent-cyan': '#06b6d4',
          'accent-amber': '#f59e0b',
        },
        surface: {
          light: '#faf9fe',
          card: '#ffffff',
          border: '#ede9f0',
          muted: '#f5f3fa',
          dark: '#0f0e1a',
        },
        text: {
          primary: '#0f0e1a',
          secondary: '#52506e',
          muted: '#9492ae',
          inverse: '#f8f7fc',
        }
      },
      boxShadow: {
        'elevated': '0 1px 3px rgba(0,0,0,0.02), 0 8px 40px rgba(124,58,237,0.06), 0 20px 80px rgba(124,58,237,0.04)',
        'elevated-lg': '0 1px 3px rgba(0,0,0,0.02), 0 16px 64px rgba(124,58,237,0.08), 0 32px 120px rgba(124,58,237,0.04)',
        'glow': '0 0 60px rgba(124,58,237,0.06)',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-14px)' }
        },
      }
    }
  },
  plugins: [],
};
