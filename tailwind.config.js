/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,jsx}",
    "./app/components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "rgb(var(--color-paper) / <alpha-value>)",
        card: "rgb(var(--color-card) / <alpha-value>)",
        ink: "rgb(var(--color-ink) / <alpha-value>)",
        inksoft: "rgb(var(--color-inksoft) / <alpha-value>)",
        inkfaint: "rgb(var(--color-inkfaint) / <alpha-value>)",
        line: "rgb(var(--color-line) / <alpha-value>)",
        linesoft: "rgb(var(--color-linesoft) / <alpha-value>)",
        accent: "rgb(var(--color-accent) / <alpha-value>)",
        sage: "rgb(var(--color-sage) / <alpha-value>)",
        navy: "#16296B",
        navydeep: "#0B1A3D",
      },
      fontFamily: {
        serif: ["'Source Serif 4'", "Georgia", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
