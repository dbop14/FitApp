/** @type {import('tailwindcss').Config} */
//
// FitApp theme
// ------------
// Colors that must change between light and dark mode are CSS variables
// (RGB triplets defined in src/index.css under :root and .dark). Light values
// equal Tailwind's defaults, so existing classes look the same in light mode.
//
// The gray scale, `bg-white` surfaces and the pale status tints are remapped
// per utility (background / text / border) so that, for example,
// `bg-blue-50 text-blue-800` becomes a dark blue tint with light text in dark
// mode, while `bg-blue-600 text-white` buttons and the
// `from-blue-500 to-blue-800` brand gradient stay exactly the same.
//
// New code should prefer the semantic tokens: canvas, surface, surface-2,
// ink, ink-muted, ink-subtle, line, brand, accent.

const v = (name) => `rgb(var(--${name}) / <alpha-value>)`

const scale = (prefix, shades) =>
  Object.fromEntries(shades.map((s) => [s, v(`${prefix}-${s}`)]))

const ALL = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]
const TINT_HUES = ['blue', 'red', 'green', 'yellow', 'amber', 'orange', 'purple', 'indigo', 'teal', 'emerald', 'pink']

const semantic = {
  canvas: v('canvas'),
  surface: v('surface'),
  'surface-2': v('surface-2'),
  'surface-3': v('surface-3'),
  ink: v('ink'),
  'ink-muted': v('ink-muted'),
  'ink-subtle': v('ink-subtle'),
  line: v('line'),
  'line-strong': v('line-strong'),
  brand: {
    DEFAULT: '#2563eb',
    50: '#eff6ff',
    100: '#dbeafe',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
  },
  'brand-ink': v('brand-ink'),
  'brand-soft': v('brand-soft'),
  accent: { DEFAULT: '#14b8a6', soft: v('accent-soft'), ink: v('accent-ink') },
}

const bgTints = Object.fromEntries(TINT_HUES.map((h) => [h, scale(`bg-${h}`, [50, 100, 200])]))
const textTints = Object.fromEntries(TINT_HUES.map((h) => [h, scale(`tx-${h}`, [500, 600, 700, 800, 900])]))
const borderTints = Object.fromEntries(TINT_HUES.map((h) => [h, scale(`bd-${h}`, [100, 200, 300])]))

module.exports = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ...semantic,
        // Legacy names kept for existing markup
        fitblue: '#2D8CFF',
        fitorange: '#FF6B35',
        fitgray: v('canvas'),
        primary: {
          50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd', 400: '#60a5fa',
          500: '#3b82f6', 600: '#035FC3', 700: '#1d4ed8', 800: '#1e40af', 900: '#1e3a8a',
        },
        neutral: scale('bg-gray', ALL),
      },
      backgroundColor: {
        white: v('surface'),
        gray: scale('bg-gray', ALL),
        ...bgTints,
      },
      textColor: {
        gray: scale('tx-gray', ALL),
        ...textTints,
      },
      borderColor: {
        white: v('surface'),
        gray: scale('bd-gray', ALL),
        ...borderTints,
      },
      divideColor: {
        gray: scale('bd-gray', ALL),
      },
      placeholderColor: {
        gray: scale('tx-gray', ALL),
      },
      ringOffsetColor: {
        white: v('surface'),
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      spacing: {
        128: '32rem',
        144: '36rem',
        sidebar: '15rem',
        'sidebar-rail': '4.5rem',
      },
      boxShadow: {
        card: '0 1px 2px rgb(15 23 42 / 0.04), 0 1px 3px rgb(15 23 42 / 0.06)',
        lift: '0 4px 16px -4px rgb(15 23 42 / 0.12), 0 2px 6px -2px rgb(15 23 42 / 0.08)',
        brand: '0 10px 30px -12px rgb(30 64 175 / 0.55)',
      },
      fontSize: {
        'page-title': ['28px', { lineHeight: '1.2', fontWeight: '600' }],
        'section-heading': ['48px', { lineHeight: '1.1', fontWeight: '700' }],
        'body-text': ['14px', { lineHeight: '1.4', fontWeight: '400' }],
        'button-text': ['16px', { lineHeight: '1.3', fontWeight: '500' }],
        'link-text': ['14px', { lineHeight: '1.3', fontWeight: '500' }],
      },
    },
  },
  plugins: [],
}
