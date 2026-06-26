/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ["./index.html", "./src/**/*.{ts,tsx}", "./electron/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        vault: {
          bg: "#f8fafc",
          s1: "#ffffff",
          s2: "#f1f5f9",
          s3: "#e2e8f0",
          border: "#e2e8f0",
          border2: "#cbd5e1",
          accent: "#1e3a8a",
          green: "#16a34a",
          red: "#dc2626",
          blue: "#1e3a8a",
          purple: "#7c3aed",
          orange: "#ea580c",
          yellow: "#d97706",
          muted: "#94a3b8",
          muted2: "#64748b",
          text: "#0f172a",
          navy: "#1e3a8a",
          dark: {
            bg: "#0d1117",
            s1: "#161b22",
            s2: "#21262d",
            s3: "#30363d",
            border: "#30363d",
            border2: "#484f58",
            text: "#e6edf3",
            muted: "#8b949e",
            muted2: "#8b949e",
          },
        },
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
      borderRadius: {
        vault: "11px",
        "vault-lg": "16px",
      },
    },
  },
  plugins: [],
};
