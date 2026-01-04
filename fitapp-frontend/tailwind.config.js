/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Legacy colors
        fitblue: "#2D8CFF",
        fitorange: "#FF6B35",
        fitgray: "#F3F4F6",
        
        // New design system colors from JSON
        primary: {
          50: '#eff6ff',
          100: '#dbeafe', 
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#035FC3',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a'
        },
        neutral: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827'
        }
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"]
      },
      spacing: {
        "128": "32rem",
        "144": "36rem"
      },
      fontSize: {
        // Design system typography hierarchy
        'page-title': ['28px', { lineHeight: '1.2', fontWeight: '600' }],
        'section-heading': ['48px', { lineHeight: '1.1', fontWeight: '700' }],
        'body-text': ['14px', { lineHeight: '1.4', fontWeight: '400' }],
        'button-text': ['16px', { lineHeight: '1.3', fontWeight: '500' }],
        'link-text': ['14px', { lineHeight: '1.3', fontWeight: '500' }]
      }
    }
  },
  plugins: []
}