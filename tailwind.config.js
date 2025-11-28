/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'dim': {
          '100': 'oklch(30.857% 0.023 264.149)',
          '200': 'oklch(28.036% 0.019 264.182)',
          '300': 'oklch(26.346% 0.018 262.177)',
          'content': 'oklch(82.901% 0.031 222.959)',
        }
      }
    },
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: [
      {
        dim: {
          'primary': 'oklch(86.133% 0.141 139.549)',
          'secondary': 'oklch(73.375% 0.165 35.353)',
          'accent': 'oklch(74.229% 0.133 311.379)',
          'neutral': 'oklch(24.731% 0.02 264.094)',
          'base-100': 'oklch(30.857% 0.023 264.149)',
          'base-200': 'oklch(28.036% 0.019 264.182)',
          'base-300': 'oklch(26.346% 0.018 262.177)',
          'base-content': 'oklch(82.901% 0.031 222.959)',
          'info': 'oklch(86.078% 0.142 206.182)',
          'success': 'oklch(86.171% 0.142 166.534)',
          'warning': 'oklch(86.163% 0.142 94.818)',
          'error': 'oklch(82.418% 0.099 33.756)',
        }
      },
      "light", "dark"
    ],
    darkTheme: "dim",
  },
}
