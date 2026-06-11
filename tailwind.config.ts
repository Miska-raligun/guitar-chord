import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      // Replace cold zinc with warm brown tones (photo-picker inspired)
      colors: {
        zinc: {
          50:  '#faf7f5',
          100: '#f2ede8',
          200: '#e2d9d2',
          300: '#c8bab2',
          400: '#9b8880',
          500: '#6e5d55',
          600: '#51433c',
          700: '#362c26',
          800: '#261e19',
          900: '#1b1510',
          950: '#11100d',
        },
        // Warm coral / terra cotta replacing yellow amber
        amber: {
          50:  '#fdf5f0',
          100: '#fae7db',
          200: '#f5ccb5',
          300: '#eca885',
          400: '#e07e52',
          500: '#c5622f',
          600: '#a34e24',
          700: '#7e3b1a',
          800: '#5a2a12',
          900: '#371a0c',
          950: '#1e0e06',
        },
      },
    },
  },
  plugins: [],
} satisfies Config
