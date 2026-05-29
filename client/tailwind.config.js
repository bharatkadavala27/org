/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: 'rgb(var(--brand-rgb) / <alpha-value>)',
          dark: 'rgb(var(--brand-dark-rgb) / <alpha-value>)',
          light: '#fef2f2',
        },
        saffron: '#ea580c',
      },
      fontFamily: {
        guj: ['"Noto Sans Gujarati"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
