/** @type {import('tailwindcss').Config} */
// Tailwind v4 utilise @theme dans globals.css pour la configuration des couleurs
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./pages/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
}
