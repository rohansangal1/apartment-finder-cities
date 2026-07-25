/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // ---- Nocturne (imported from Claude Design) ----
        // A quiet dark interface: near-neutral blue-grey ground, a single
        // blurple accent used as line and glow rather than flood, and tonal
        // ramps generated in OKLCH on one shared lightness scale. The whole app
        // is themed by re-pointing the semantic scales below, so views authored
        // against slate/brand/ink/paper convert without per-file churn.
        //
        // Source of truth: _ds/nocturne/styles.css in the design project.
        // bg #161826 · surface #232532 · text #e9e9ed · accent #9184d9

        // Brand accent — logo + primary action. Nocturne is a mono scheme, so
        // `forest` and `terracotta` (the old two-accent pair) both resolve into
        // the one accent family rather than introducing a second hue.
        forest: {
          DEFAULT: '#9184d9',
          600: '#9184d9',
          700: '#b5abfc', // brighter on hover, from the accent ramp's 400 step
        },
        terracotta: {
          DEFAULT: '#a7a1db', // --color-accent-2: the same hue, held as one role
          600: '#a7a1db',
          700: '#b5afe8',
        },
        // Deep accent tint — selected / active fill on the dark ground.
        sage: '#2b2741', // --color-accent-900

        paper: {
          DEFAULT: '#e9e9ed', // primary text
          muted: '#9397ab', // muted text (--color-neutral-500)
          canvas: '#161826', // app background (--color-bg)
          cream: '#232532', // raised panel (--color-surface)
        },

        // `ink` = surface family, from app background up through elevated cards.
        ink: {
          DEFAULT: '#232532', // card / nav surface
          950: '#161826', // app background
          900: '#1c1e2c', // subtle raised
          800: '#232532', // card surface (--color-surface)
          700: '#2b2d3c', // hover / elevated / input bg
          600: '#3f424d', // borders / dividers (--color-neutral-800)
        },
        // `slate` neutral scale → the Nocturne neutral ramp, inverted for dark
        // (50 = app bg … 900 = primary text).
        slate: {
          50: '#161826',
          100: '#232532', // subtle surface / hover
          200: '#3f424d', // borders, dividers
          300: '#595d6c',
          400: '#9397ab', // muted text
          500: '#b2b6ca', // secondary muted text
          600: '#cfd3e5', // secondary text
          700: '#dadde9', // strong secondary text
          800: '#e4e7f5',
          900: '#e9e9ed', // primary text (--color-text)
        },
        // `brand` accent → the Nocturne accent ramp. Low steps are the tinted
        // fills for the dark ground; 700 is the step that stays legible as text.
        brand: {
          50: '#2b2741', // selected / active tint (--color-accent-900)
          100: '#423a6a', // focus ring tint (--color-accent-800)
          200: '#5d5294', // --color-accent-700
          300: '#796cbf', // --color-accent-600
          400: '#968ae0', // --color-accent-500
          500: '#968ae0', // light accent / focus border
          600: '#9184d9', // accent fill (buttons, logo) (--color-accent)
          700: '#b5abfc', // hover + legible accent text on dark (--color-accent-400)
        },
        // `teal` (focus rings, old accent) → the accent so focus states match.
        teal: {
          DEFAULT: '#9184d9',
          300: '#b5abfc',
          400: '#968ae0',
          500: '#9184d9',
          600: '#9184d9',
          700: '#b5abfc',
        },
      },
      fontFamily: {
        // Nocturne pairs Inter with Inter — hierarchy is size and space, not a
        // second family. `serif` stays as a name so the ~20 `font-serif` heading
        // call sites keep working; it just resolves to the heading face now.
        serif: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      boxShadow: {
        // Nocturne elevation: on a dark ground, depth is a hairline edge plus
        // ambient darkness — never a stack of heavy shadows.
        soft: '0 0 0 1px #595d6c, 0 6px 18px rgba(0, 0, 0, 0.55)', // --shadow-md
        'soft-lg': '0 0 0 1px #9397ab, 0 16px 40px rgba(0, 0, 0, 0.65)', // --shadow-lg
        edge: '0 0 0 1px #3f424d', // --shadow-sm
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
        // Nocturne's accent-as-glow: a ring that expands and dissolves. Used on
        // empty-state marks, layered at two offsets for a slow double pulse.
        pulsering: {
          '0%': { transform: 'scale(1)', opacity: '0.55' },
          '70%': { transform: 'scale(1.9)', opacity: '0' },
          '100%': { opacity: '0' },
        },
        // The hero's detached fit-score card drifts, so it reads as an overlay
        // above the photograph rather than part of it.
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
      animation: {
        fadein: 'fadein 0.7s ease',
        fadeup: 'fadeup 0.6s cubic-bezier(0.22, 1, 0.36, 1) both',
        growbar: 'growbar 0.7s cubic-bezier(0.22, 1, 0.36, 1) both',
        popin: 'popin 0.28s cubic-bezier(0.22, 1, 0.36, 1) both',
        pulsering: 'pulsering 2.6s ease-out infinite',
        float: 'float 5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
