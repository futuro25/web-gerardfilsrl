/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,js}",
    "./node_modules/tailwind-datepicker-react/dist/**/*.js",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Mulish", "sans-serif"],
      },
      minHeight: (theme) => ({
        ...theme("spacing"),
      }),
      transitionProperty: {
        width: "width",
      },
      spacing: {
        8.5: "2.125rem", // 34px
        18: "4.5rem", // 72px
        22: "5.5rem", // 88px
        30: "7.5rem", // 120px
        34: "8.5rem", // 136px
      },
      colors: {
        "black-special": "#282828",
        transparent: "transparent",
        primary: "#3205BE",
        current: "currentColor",
        white: "#FFFFFF",
        "cold-white": "#FAFBFF",
        "gray-lighter": "#EEF0F4",
        danger: {
          dark: "#CC1442",
          DEFAULT: "#E55076",
          light: "#FFCCD9",
        },
        alert: {
          dark: "#663C00",
          DEFAULT: "#FFAA33",
          light: "#FFD778",
          lighter: "#FFEACC",
        },
        success: {
          dark: "#06734E",
          DEFAULT: "#269973",
          light: "#ACE5D3",
        },
        informative: {
          dark: "#002966",
          DEFAULT: "#0066FF",
          light: "#E5F0FF",
        },
        lightblue: {
          100: "#D9F6FF",
          200: "#9DDDF2",
          300: "#79D3F1",
          400: "#48C8F2",
          500: "#16A8D9",
          600: "#1495BF",
          700: "#0E6C8B",
          800: "#094559",
          900: "#052833",
        },
        green: {
          100: "#D7FDF3",
          200: "#9EF2DD",
          300: "#79F1D3",
          400: "#45E5BD",
          500: "#14CC9E",
          600: "#13BF94",
          700: "#0E8B6C",
          800: "#095945",
          900: "#053328",
        },
        indigo: {
          100: "#D9CDFE",
          200: "#B49CFC",
          300: "#8E6AFB",
          400: "#6938FA",
          500: "#3305BE",
          600: "#3605C7",
          700: "#280495",
          800: "#1B0363",
          900: "#0D0132",
        },
        gray: {
          50: "#F6F7FC",
          100: "#DDE1E9",
          200: "#C4C9D4",
          300: "#99A1B3",
          400: "#7A8499",
          500: "#626D84",
          600: "#576075",
          700: "#414858",
          800: "#2D3340",
          900: "#1D2330",
        },
      },
      boxShadow: {
        DEFAULT:
          "0 1px 2px 0 rgba(122, 132, 153, 0.1), 0 1px 3px 0 rgba(122, 132, 153, 0.04)",
        md: "0 2px 6px 0 rgba(122, 132, 153, 0.1), 0 4px 10px 0 rgba(122, 132, 153, 0.04)",
        lg: "0 10px 18px 0 rgba(122, 132, 153, 0.1), 0 4px 12px 0 rgba(122, 132, 153, 0.04)",
        xl: "0 20px 30px 0 rgba(122, 132, 153, 0.1), 0 10px 15px 0 rgba(153, 161, 179, 0.04)",
        "2xl": "0 25px 65px 0 rgba(98, 109, 132, 0.2)",
        inner: "inset 0 2px 4px 0 rgba(122, 132, 153, 0.1)",
        flat: "0 2px 1px 0 rgba(122, 132, 153, 0.1)",
        card: "0px 1px 3px 0px rgba(122, 132, 153, 0.3), 0px 1px 2px 0px rgba(122, 132, 153, 0.6)",
      },
      animation: {
        enter: "enter 200ms ease-out",
        "slide-in": "slide-in 1.2s cubic-bezier(.41,.73,.51,1.02)",
        leave: "leave 150ms ease-in forwards",
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "flow-right": "flow-right 1s infinite linear",
        "pulse-border": "pulse-border 1.2s infinite ease-in-out",
        "pulse-border-compensation":
          "pulse-border-compensation 1.2s infinite ease-in-out",
      },
      keyframes: {
        enter: {
          "0%": { transform: "scale(0.9)", opacity: 0 },
          "100%": { transform: "scale(1)", opacity: 1 },
        },
        leave: {
          "0%": { transform: "scale(1)", opacity: 1 },
          "100%": { transform: "scale(0.9)", opacity: 0 },
        },
        "slide-in": {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(0)" },
        },
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "flow-right": {
          "0%": { transform: "translateX(0) scaleX(0)" },
          "40%": { transform: "translateX(0) scaleX(0.4)" },
          "100%": { transform: "translateX(100%) scaleX(0.5)" },
        },
        "pulse-border": {
          "0%, 100%": {
            transform: "scale(1)",
            opacity: 1,
          },
          "50%": {
            transform: "scale(1.3)",
            opacity: 0.5,
          },
          "100%": {
            transform: "scale(1.3)",
            opacity: 0,
          },
        },
        "pulse-border-compensation": {
          "0%, 100%": {
            transform: " scaleX(1) scaleY(1)",
            opacity: 1,
          },
          "50%": {
            transform: " scaleX(1.2) scaleY(1.3)",
            opacity: 0.5,
          },
          "100%": {
            transform: " scaleX(1.2) scaleY(1.3)",
            opacity: 0,
          },
        },
      },
    },
    fontSize: {
      xs: ["0.75rem", "1.5"],
      "xs-special": ["0.75rem", "1.333"],
      sm: ["0.875rem", "1.571"],
      "sm-special": ["0.875rem", "1.428"],
      base: ["1rem", "1.625"],
      "base-special": ["1rem", "1.5"],
      lg: ["1.125rem", "1.667"],
      "lg-special": ["1.125rem", "1.333"],
      xl: ["1.25rem", "1.4"],
      "xl-special": ["1.25rem", "1.2"],
      "2xl": ["1.5rem", "1.333"],
      "3xl": ["2rem", "1.375"],
      "4xl": ["2.25rem", "1.4"],
      "5xl": ["3rem", "1"],
      "6xl": ["3.75rem", "1"],
      "7xl": ["4.5rem", "1"],
    },
  },
  plugins: [],
  extend: {
    screens: {
      print: { raw: "print" },
      screen: { raw: "screen" },
    },
  },
};
