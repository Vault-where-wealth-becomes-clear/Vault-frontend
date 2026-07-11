/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}", "./electron/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        vault: {
          // Punto medio: más claro que la pasada anterior, pero no blanco puro.
          bg: "#d0d7e0",
          s1: "#e1e6ec",
          s2: "#c5ced8",
          s3: "#b8c2cf",
          border: "#b0bbca",
          border2: "#929fb2",
          accent: "#1e3a8a",
          green: "#16a34a",
          red: "#dc2626",
          blue: "#1e3a8a",
          purple: "#7c3aed",
          orange: "#ea580c",
          yellow: "#d97706",
          muted: "#7c8aa0",
          muted2: "#526074",
          text: "#0f172a",
          navy: "#1e3a8a",
          dark: {
            // Mezcla elegida: fondo = sub-fondo de D1, card = sub-fondo de D4.
            bg: "#383d46",
            s1: "#474e58",
            s2: "#505862",
            s3: "#5c6672",
            border: "#68727f",
            border2: "#7c8795",
            text: "#e6eaf0",
            muted: "#99a3b0",
            muted2: "#99a3b0",
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
