/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Original palette — still used by the classic layout.
        primary: {
          50: '#f0f4ff',
          100: '#e0e9ff',
          500: '#3b5bdb',
          600: '#2f4ac5',
          700: '#2440a8',
          800: '#1a328a',
          900: '#12256e',
        },
        slate: {
          750: '#2a3547',
        },
        // Skin-aware aliases. These resolve through the CSS variables in
        // theme/tokens.css, so they follow whichever skin is active.
        surface: 'var(--bp-card)',
        canvas: 'var(--bp-bg)',
        ink: 'var(--bp-fg)',
      },
      fontFamily: {
        // Driven by the active skin: Inter for classic, Instrument Sans for
        // masonsview. tokens.css sets --bp-font.
        sans: ['var(--bp-font)', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
