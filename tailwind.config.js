/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}", "./electron/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        vault: {
          bg: "#07090f",
          s1: "#0d0f18",
          s2: "#13161f",
          s3: "#1a1d28",
          border: "rgba(255,255,255,0.07)",
          border2: "rgba(255,255,255,0.13)",
          accent: "#c8f135",
          green: "#4fffb0",
          red: "#ff6b6b",
          blue: "#5b9cf6",
          purple: "#a78bfa",
          orange: "#fb923c",
          yellow: "#fbbf24",
          muted: "#535970",
          muted2: "#828ca8",
          text: "#edf0f8",
          navy: "#2d3a8c",
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
