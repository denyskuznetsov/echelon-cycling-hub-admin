module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/ui/**/*.{tsx,ts,js,jsx}"
  ],
  theme: {
    extend: {
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      keyframes: {
        "drawer-in": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        "drawer-out": {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(100%)" },
        },
        "drawer-backdrop-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "drawer-backdrop-out": {
          from: { opacity: "1" },
          to: { opacity: "0" },
        },
      },
      animation: {
        "drawer-in": "drawer-in 300ms ease-out",
        "drawer-out": "drawer-out 250ms ease-in forwards",
        "drawer-backdrop-in": "drawer-backdrop-in 300ms ease-out",
        "drawer-backdrop-out": "drawer-backdrop-out 250ms ease-in forwards",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
  presets: [require("./src/ui/tailwind.config.js")]
}
