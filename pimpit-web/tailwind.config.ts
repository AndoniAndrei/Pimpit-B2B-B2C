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
           Pure black text on white, shiny luxury gold, native system font. */
        pimpit: {
          bg: "#FFFFFF",
          surface: "#FFFFFF",
          "surface-2": "#F7F7F5",     /* warm stone wash for catalog pages */
          border: "#E5E5E0",
          accent: "#A8841D",           /* rich saturated gold, 5.2:1 contrast */
          "accent-hover": "#876715",
          "accent-light": "#F5D06B",   /* bright shine highlight */
          text: "#000000",             /* PURE BLACK for max readability */
          "text-muted": "#404040",     /* zinc-700 — still very readable */
          "text-subtle": "#737373",    /* zinc-500 — small captions */
          success: "#16A34A",
          error: "#DC2626",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        /* Native system stack — each OS renders in its flagship sans
           (SF Pro on Mac, Segoe UI on Windows, Roboto on Android).
           Simplest, most readable, most premium. */
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI Variable"',
          '"Segoe UI"',
          "Roboto",
          '"Helvetica Neue"',
          "Arial",
          "sans-serif",
        ],
        display: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI Variable"',
          '"Segoe UI"',
          "Roboto",
          '"Helvetica Neue"',
          "Arial",
          "sans-serif",
        ],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      backgroundImage: {
        /* Premium metallic gold — brighter peak, deeper shadow for a real
           "shine" feel on white backgrounds. Used on primary CTAs. */
        "gold-shine":
          "linear-gradient(135deg, #F5D06B 0%, #D4AF37 25%, #B8860B 55%, #876715 100%)",
        "gold-shine-hover":
          "linear-gradient(135deg, #FFE08A 0%, #E5C257 25%, #C9A227 55%, #9A7919 100%)",
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
        /* Slow continuous shimmer for premium gold buttons. */
        "gold-shimmer": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "gold-shimmer": "gold-shimmer 6s ease-in-out infinite",
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
