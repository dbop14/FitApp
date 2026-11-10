/**
 * FitApp design system (v3, "UI overhaul")
 * =========================================
 *
 * Where things live
 *  - Color tokens:      src/index.css  (:root = light, .dark = dark; RGB triplets)
 *  - Tailwind mapping:  tailwind.config.js  (semantic names + gray/tint remapping)
 *  - Component classes: src/index.css  @layer components (.card, .btn, .input, .chip, .callout, ...)
 *  - Theme state:       src/context/ThemeContext.jsx  (system / light / dark, stored per device)
 *  - Icons:             src/components/ui/Icon.jsx  (one stroke icon set, no emojis)
 *  - App shell:         src/layout/MainLayout.jsx  (bottom tabs on phones, icon rail on md, sidebar on lg)
 *  - Page header:       src/components/ui/PageHeader.jsx  (sticky brand gradient)
 *
 * Brand colors (unchanged from earlier versions)
 *  - Brand gradient:  bg-gradient-to-r from-blue-500 to-blue-800  (#3b82f6 -> #1e40af)
 *  - Blues:           blue-50 ... blue-900, primary action blue-600 (#2563eb)
 *  - Accent:          teal #14b8a6 (goal met, connected, weight loss)
 *  - Neutrals:        Tailwind grays (light) / navy slate (dark)
 *
 * Gradients are used as accents only: page headers, the steps hero card,
 * selected-day cards and bot chat cards. Everything else is a neutral card.
 *
 * Scoring numbers never live in the UI; they come from the backend.
 */

export const brand = {
  gradient: 'bg-gradient-to-r from-blue-500 to-blue-800',
  gradientHex: ['#3b82f6', '#1e40af'],
  blue: {
    50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd', 400: '#60a5fa',
    500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8', 800: '#1e40af', 900: '#1e3a8a',
  },
  teal: '#14b8a6',
}

// Semantic Tailwind color names (work in light and dark)
export const tokens = {
  canvas: 'bg-canvas',          // page background
  surface: 'bg-surface',        // cards
  surface2: 'bg-surface-2',     // insets, chips, inputs on cards
  ink: 'text-ink',              // primary text
  inkMuted: 'text-ink-muted',   // secondary text
  inkSubtle: 'text-ink-subtle', // tertiary text, axis labels
  line: 'border-line',          // dividers and card borders
  brandSoft: 'bg-brand-soft',   // selected / active backgrounds
  brandInk: 'text-brand-ink',   // brand-colored text that stays readable in dark mode
}

export const unifiedDesignSystem = { brand, tokens }
export default unifiedDesignSystem
