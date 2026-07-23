// tailwind.config.js
import flattenColorPalette from 'tailwindcss/lib/util/flattenColorPalette';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        'accent': '#4f46e5',
        'accent-hover': '#4338ca',
        'bg-base': '#0B0B0D',
        'surface': '#16161A',
        'surface-raised': '#1D1D22',
        'border-color': '#2A2A30',
        'accent-gold': '#F5B301',
        'accent-green': '#22A559',
        'text-primary': '#F5F5F7',
        'text-muted': '#9A9AA2',
      },
      fontFamily: {
        'display': ['Clash Display', 'General Sans', 'Inter', 'sans-serif'],
        'body': ['Inter', 'Satoshi', 'sans-serif'],
        'mono': ['JetBrains Mono', 'IBM Plex Mono', 'monospace'],
      }
    },
  },
  plugins: [
    // Bu fonksiyon, bg-grid-* gibi sınıfları oluşturmamızı sağlar.
    ({ matchUtilities, theme }) => {
      matchUtilities(
        {
          'bg-grid': (value) => ({
            backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' width='32' height='32' fill='none' stroke='${value}'%3e%3cpath d='M0 .5H31.5V32'/%3e%3c/svg%3e")`,
          }),
        },
        { values: flattenColorPalette(theme('backgroundColor')), type: 'color' }
      );
    },
  ],
};