import forms from '@tailwindcss/forms';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0d1018',
        panel: '#151923',
        muted: '#969eaf',
        accent: '#a998ff',
        mint: '#91e4c5'
      },
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'] }
    }
  },
  plugins: [forms]
};
