import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { 950: "#09090f", 900: "#0d0d15", 850: "#12121c", 800: "#171725", 700: "#232336", 600: "#2e2e45", 500: "#3d3d59" },
        accent: { DEFAULT: "#6366f1", hover: "#818cf8", soft: "#312e81" },
      },
      fontFamily: { sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"], mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"] },
    },
  },
  plugins: [],
};
export default config;
