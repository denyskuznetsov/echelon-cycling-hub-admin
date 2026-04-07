module.exports = {
  // ...

  theme: {
    extend: {
      colors: {
        brand: {
          50: "rgb(255, 251, 235)",
          100: "rgb(254, 243, 199)",
          200: "rgb(253, 230, 138)",
          300: "rgb(252, 211, 77)",
          400: "rgb(251, 191, 36)",
          500: "rgb(245, 158, 11)",
          600: "rgb(217, 119, 6)",
          700: "rgb(180, 83, 9)",
          800: "rgb(146, 64, 14)",
          900: "rgb(120, 53, 15)",
        },
        neutral: {
          0: "rgb(255, 255, 255)",
          50: "rgb(248, 250, 252)",
          100: "rgb(241, 245, 249)",
          200: "rgb(226, 232, 240)",
          300: "rgb(203, 213, 225)",
          400: "rgb(148, 163, 184)",
          500: "rgb(100, 116, 139)",
          600: "rgb(71, 85, 105)",
          700: "rgb(51, 65, 85)",
          800: "rgb(30, 41, 59)",
          900: "rgb(15, 23, 42)",
          950: "rgb(2, 6, 23)",
        },
        error: {
          50: "rgb(254, 242, 242)",
          100: "rgb(254, 226, 226)",
          200: "rgb(254, 202, 202)",
          300: "rgb(252, 165, 165)",
          400: "rgb(248, 113, 113)",
          500: "rgb(239, 68, 68)",
          600: "rgb(220, 38, 38)",
          700: "rgb(185, 28, 28)",
          800: "rgb(153, 27, 27)",
          900: "rgb(127, 29, 29)",
        },
        success: {
          50: "rgb(240, 253, 250)",
          100: "rgb(204, 251, 241)",
          200: "rgb(153, 246, 228)",
          300: "rgb(94, 234, 212)",
          400: "rgb(45, 212, 191)",
          500: "rgb(20, 184, 166)",
          600: "rgb(13, 148, 136)",
          700: "rgb(15, 118, 110)",
          800: "rgb(17, 94, 89)",
          900: "rgb(19, 78, 74)",
        },
        warning: {
          50: "rgb(255, 251, 235)",
          100: "rgb(254, 243, 199)",
          200: "rgb(253, 230, 138)",
          300: "rgb(252, 211, 77)",
          400: "rgb(251, 191, 36)",
          500: "rgb(245, 158, 11)",
          600: "rgb(217, 119, 6)",
          700: "rgb(180, 83, 9)",
          800: "rgb(146, 64, 14)",
          900: "rgb(120, 53, 15)",
        },
        "brand-primary": "rgb(217, 119, 6)",
        "default-font": "rgb(15, 23, 42)",
        "subtext-color": "rgb(100, 116, 139)",
        "neutral-border": "rgb(226, 232, 240)",
        white: "rgb(255, 255, 255)",
        "default-background": "rgb(255, 255, 255)",
      },
      fontSize: {
        caption: [
          "12px",
          {
            lineHeight: "16px",
            fontWeight: "400",
            letterSpacing: "0em",
          },
        ],
        "caption-bold": [
          "12px",
          {
            lineHeight: "16px",
            fontWeight: "500",
            letterSpacing: "0em",
          },
        ],
        body: [
          "14px",
          {
            lineHeight: "20px",
            fontWeight: "400",
            letterSpacing: "0em",
          },
        ],
        "body-bold": [
          "14px",
          {
            lineHeight: "20px",
            fontWeight: "500",
            letterSpacing: "0em",
          },
        ],
        "heading-3": [
          "16px",
          {
            lineHeight: "20px",
            fontWeight: "500",
            letterSpacing: "0em",
          },
        ],
        "heading-2": [
          "20px",
          {
            lineHeight: "24px",
            fontWeight: "500",
            letterSpacing: "0em",
          },
        ],
        "heading-1": [
          "30px",
          {
            lineHeight: "36px",
            fontWeight: "500",
            letterSpacing: "0em",
          },
        ],
        "monospace-body": [
          "14px",
          {
            lineHeight: "20px",
            fontWeight: "400",
            letterSpacing: "0em",
          },
        ],
      },
      fontFamily: {
        caption: "Geist",
        "caption-bold": "Geist",
        body: "Geist",
        "body-bold": "Geist",
        "heading-3": "Geist",
        "heading-2": "Geist",
        "heading-1": "Geist",
        "monospace-body": "monospace",
      },
      boxShadow: {
        sm: "0px 1px 2px 0px rgba(0, 0, 0, 0.05)",
        default: "0px 1px 2px 0px rgba(0, 0, 0, 0.05)",
        md: "0px 4px 16px -2px rgba(0, 0, 0, 0.08), 0px 2px 4px -1px rgba(0, 0, 0, 0.08)",
        lg: "0px 12px 32px -4px rgba(0, 0, 0, 0.08), 0px 4px 8px -2px rgba(0, 0, 0, 0.08)",
        overlay:
          "0px 12px 32px -4px rgba(0, 0, 0, 0.08), 0px 4px 8px -2px rgba(0, 0, 0, 0.08)",
      },
      borderRadius: {
        sm: "4px",
        md: "8px",
        DEFAULT: "8px",
        lg: "12px",
        full: "9999px",
      },
      container: {
        padding: {
          DEFAULT: "16px",
          sm: "calc((100vw + 16px - 640px) / 2)",
          md: "calc((100vw + 16px - 768px) / 2)",
          lg: "calc((100vw + 16px - 1024px) / 2)",
          xl: "calc((100vw + 16px - 1280px) / 2)",
          "2xl": "calc((100vw + 16px - 1536px) / 2)",
        },
      },
      spacing: {
        112: "28rem",
        144: "36rem",
        192: "48rem",
        256: "64rem",
        320: "80rem",
      },
      screens: {
        mobile: {
          max: "767px",
        },
      },
    },
  },
};
