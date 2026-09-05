/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: "#0f172a",
          slate: "#1e293b",
          border: "#e2e8f0",
          muted: "#64748b",
          accent: "#0284c7",
          "accent-hover": "#0369a1",
        },
        risk: {
          low: "#16a34a",
          "low-bg": "#f0fdf4",
          "low-border": "#bbf7d0",
          medium: "#d97706",
          "medium-bg": "#fffbeb",
          "medium-border": "#fde68a",
          high: "#dc2626",
          "high-bg": "#fef2f2",
          "high-border": "#fecaca",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          '"Helvetica Neue"',
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
}
