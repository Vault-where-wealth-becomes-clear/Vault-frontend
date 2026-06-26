/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}", "./electron/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        vault: {
          bg: "#ffffff",
          s1: "#f5f7fb",
          s2: "#edf0f7",
          s3: "#e2e6f0",
          border: "rgba(37,99,235,0.10)",
          border2: "rgba(37,99,235,0.20)",
          accent: "#2563eb",
          green: "#16a34a",
          red: "#dc2626",
          blue: "#2563eb",
          purple: "#7c3aed",
          orange: "#ea580c",
          yellow: "#d97706",
          muted: "#6b7280",
          muted2: "#94a3b8",
          text: "#0f172a",
          navy: "#1e3a8a",
        },
      },
      fontFamily: {
        syne: ["Syne", "sans-serif"],
        mono: ["DM Mono", "monospace"],
        sans: ["DM Sans", "sans-serif"],
      },
      borderRadius: {
        vault: "11px",
        "vault-lg": "16px",
      },
    },
  },
  plugins: [],
};
