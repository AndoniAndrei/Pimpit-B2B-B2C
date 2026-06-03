import type { Config } from "tailwindcss";

const config = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        /* pimpit.ro design system — premium light automotive.
           Near-black text on white, shiny gold accents, Inter throughout. */
        pimpit: {
          bg: "#FFFFFF",
          surface: "#FFFFFF",
          "surface-2": "#F7F7F5",     /* warm stone wash */
          border: "#E5E5E0",           /* subtle warm border */
          accent: "#B8860B",           /* darkgoldenrod — pops on white, premium */
          "accent-hover": "#9A6F08",   /* deeper hover */
          "accent-light": "#E5B95A",   /* light highlight (used in gradients) */
          text: "#0A0A0A",             /* near-black for body copy */
          "text-muted": "#525252",     /* zinc-600 — still very readable */
          "text-subtle": "#737373",    /* zinc-500 — labels, captions */
          success: "#16A34A",
          error: "#DC2626",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
      fontFamily: {
        /* All non-mono UI uses Inter (loaded via next/font). Drop Barlow Condensed
           in favour of a simple, highly readable sans-serif per user request. */
        sans: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      backgroundImage: {
        /* Premium shiny gold — used on primary CTAs to give a metallic shine. */
        "gold-shine":
          "linear-gradient(135deg, #E5B95A 0%, #C9A227 35%, #B8860B 65%, #8B6914 100%)",
        "gold-shine-hover":
          "linear-gradient(135deg, #F0C674 0%, #D4AF37 35%, #C9A227 65%, #9A6F08 100%)",
      },
      boxShadow: {
        /* Premium card depth — barely-there, but enough to lift cards off the page. */
        premium: "0 1px 2px 0 rgba(0,0,0,0.04), 0 4px 12px -2px rgba(0,0,0,0.06)",
        "premium-hover": "0 4px 8px -2px rgba(0,0,0,0.08), 0 12px 24px -4px rgba(0,0,0,0.10)",
        gold: "0 1px 2px 0 rgba(184,134,11,0.20), 0 4px 12px -2px rgba(184,134,11,0.18)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;

export default config;
