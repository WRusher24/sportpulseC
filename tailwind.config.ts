import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--c-bg) / <alpha-value>)",
        surface: "rgb(var(--c-surface) / <alpha-value>)",
        surface2: "rgb(var(--c-surface2) / <alpha-value>)",
        line: "rgb(var(--c-line) / <alpha-value>)",
        fg: "rgb(var(--c-fg) / <alpha-value>)",
        muted: "rgb(var(--c-muted) / <alpha-value>)",
        accent: "rgb(var(--c-accent) / <alpha-value>)",
        "accent-fg": "rgb(var(--c-accent-fg) / <alpha-value>)",
        live: "rgb(var(--c-live) / <alpha-value>)",
        hot: "rgb(var(--c-hot) / <alpha-value>)",
        good: "rgb(var(--c-good) / <alpha-value>)",
        bad: "rgb(var(--c-bad) / <alpha-value>)"
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Heebo", "Arial", "sans-serif"]
      },
      keyframes: {
        pulseDot: { "0%,100%": { opacity: "1", transform: "scale(1)" }, "50%": { opacity: ".35", transform: "scale(.7)" } },
        fadeUp: { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "translateY(0)" } }
      },
      animation: { pulseDot: "pulseDot 1.4s ease-in-out infinite", fadeUp: ".35s ease-out both" }
    }
  },
  plugins: []
};

export default config;
