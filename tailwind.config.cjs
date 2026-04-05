/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        background: "#FFFFFF",
        foreground: "#111111",
        card: "#FFFFFF",
        "card-foreground": "#111111",
        primary: "#6F92E8",
        "primary-foreground": "#FFFFFF",
        muted: "#F4F8FF",
        "muted-foreground": "#4F5B6F",
        accent: "#8FB0FF",
        "accent-foreground": "#FFFFFF",
        border: "#DBE4F2",
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
};
