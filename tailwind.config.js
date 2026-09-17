/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Plus Jakarta Sans",
          "Inter",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
        display: [
          "Plus Jakarta Sans",
          "Inter",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
        serif: ["Instrument Serif", "Times New Roman", "Times", "serif"],
      },
      colors: {
        brand: "#3D81E3",
        ink: {
          950: "#000000",
          900: "#0a0a0a",
          800: "#141414",
          700: "#1c1c1c",
          500: "#9a9a9a",
          400: "#9a9a9a",
          300: "#d8d8d8",
          100: "#ffffff",
        },
        beam: {
          300: "#e8e8e8",
          400: "#f3f3f3",
          500: "#cfcfcf",
        },
        sea: {
          400: "#c8d4e8",
          500: "#9aadc8",
        },
      },
      boxShadow: {
        card: "0 18px 40px -28px rgba(0,0,0,0.65)",
      },
    },
  },
  plugins: [],
};
