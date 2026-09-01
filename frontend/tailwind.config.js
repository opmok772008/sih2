/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        apple: {
          bg: "#F5F5F7",
          card: "#FFFFFF",
          cardHover: "#FAFAFC",
          ink: "#1D1D1F",
          secondary: "#86868B",
          tertiary: "#A1A1A6",
          hairline: "rgba(0, 0, 0, 0.08)",
          hairlineDark: "rgba(255, 255, 255, 0.12)",
          blue: "#0071E3",
          blueHover: "#0077ED",
          blueLight: "rgba(0, 113, 227, 0.08)",
          green: "#34C759",
          greenLight: "rgba(52, 199, 89, 0.10)",
          orange: "#FF9500",
          orangeLight: "rgba(255, 149, 0, 0.10)",
          red: "#FF3B30",
          redLight: "rgba(255, 59, 48, 0.10)",
        }
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"SF Pro Text"',
          '"Inter"',
          'system-ui',
          'sans-serif'
        ],
        mono: [
          '"SF Mono"',
          '"JetBrains Mono"',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace'
        ],
      },
      letterSpacing: {
        tightest: '-0.035em',
        tighter: '-0.025em',
        tight: '-0.015em',
      },
      boxShadow: {
        'apple-card': '0 2px 12px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.02)',
        'apple-hover': '0 8px 24px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.04)',
        'apple-modal': '0 20px 40px rgba(0, 0, 0, 0.12), 0 1px 4px rgba(0, 0, 0, 0.05)',
      }
    },
  },
  plugins: [],
}
