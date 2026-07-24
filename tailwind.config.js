/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // ---- Dark editorial design system (near-black, warm accents) ----
        // Moody and editorial. The whole app is themed by re-pointing the
        // semantic scales below, so views authored against slate/brand/ink/paper
        // convert without per-file churn.

        // Brand green — logo + primary CTA.
        forest: {
          DEFAULT: '#4C8B67',
          600: '#4C8B67',
          700: '#5FA47C', // brighter on hover for dark surfaces
        },
        // Warm accent, used sparingly (active slider fill, carousel dot).
        terracotta: {
          DEFAULT: '#D98A64',
          600: '#D98A64',
          700: '#E39C78',
        },
        // Deep green tint — selected / active fill on dark.
        sage: '#16281E',

        paper: {
          DEFAULT: '#F4F1EA', // primary text (warm off-white)
          muted: '#A8A199', // muted text
          canvas: '#0B0B0C', // app background (near-black)
          cream: '#141210', // warm-tinted dark panel (hero)
        },

        // ---- Re-pointed semantic scales (near-black dark) ----
        // `ink` = surface family, from app background up through elevated cards.
        ink: {
          DEFAULT: '#161618', // card / nav surface
          950: '#0B0B0C', // app background
          900: '#141210', // subtle raised (warm dark panel)
          800: '#161618', // card surface
          700: '#1E1E21', // hover / elevated / input bg
          600: '#2C2C31', // borders / dividers
        },
        // `slate` neutral scale → dark neutrals (50 = app bg … 900 = light text).
        slate: {
          50: '#0B0B0C',
          100: '#161618', // subtle surface / hover
          200: '#2C2C31', // borders, dividers
          300: '#3A3A40',
          400: '#8B857D', // muted text
          500: '#A8A199', // secondary muted text
          600: '#C4BEB4', // secondary text
          700: '#DAD5CC', // strong secondary text
          800: '#ECE8E0',
          900: '#F4F1EA', // primary text
        },
        // `brand` accent → green (brightened for legibility on black).
        brand: {
          50: '#16281E', // selected / active tint (deep green)
          100: '#1C3327', // focus ring tint
          500: '#5FA47C', // light accent / focus border
          600: '#4C8B67', // accent fill (buttons, logo)
          700: '#6FB78C', // hover + legible accent text on dark
        },
        // `teal` (focus rings, old accent) → green so focus states match brand.
        teal: {
          DEFAULT: '#4C8B67',
          300: '#6FB78C',
          400: '#5FA47C',
          500: '#4C8B67',
          600: '#4C8B67',
          700: '#6FB78C',
        },
      },
      fontFamily: {
        serif: ['Instrument Serif', 'ui-serif', 'Georgia', 'serif'],
        sans: ['Space Grotesk', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      boxShadow: {
        // Deep shadows for separation on near-black, with a faint warm top edge.
        soft: '0 1px 0 rgba(255, 246, 235, 0.03) inset, 0 8px 24px -10px rgba(0, 0, 0, 0.7)',
        'soft-lg': '0 1px 0 rgba(255, 246, 235, 0.04) inset, 0 24px 50px -18px rgba(0, 0, 0, 0.8)',
        thumb: '0 2px 6px rgba(0, 0, 0, 0.6)',
      },
      keyframes: {
        fadein: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        fadeup: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        // Horizontal fill for score-breakdown bars — grows from the left edge.
        growbar: {
          '0%': { transform: 'scaleX(0)' },
          '100%': { transform: 'scaleX(1)' },
        },
        // Dialog entrance: rises and settles into scale. Pair with an origin-*
        // utility to make a panel appear to spring from the button that opened it.
        popin: {
          '0%': { opacity: '0', transform: 'translateY(8px) scale(0.96)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        fadein: 'fadein 0.7s ease',
        fadeup: 'fadeup 0.6s cubic-bezier(0.22, 1, 0.36, 1) both',
        growbar: 'growbar 0.7s cubic-bezier(0.22, 1, 0.36, 1) both',
        popin: 'popin 0.28s cubic-bezier(0.22, 1, 0.36, 1) both',
      },
    },
  },
  plugins: [],
};
