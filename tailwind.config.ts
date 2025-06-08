import type { Config } from 'tailwindcss'

const config: Config = {
    darkMode: 'class',
    content: [
        './app/**/*.{js,ts,jsx,tsx}',     // for App Router
        './pages/**/*.{js,ts,jsx,tsx}',   // for Pages Router
        './components/**/*.{js,ts,jsx,tsx}',
    ],
    theme: {
        extend: {},
    },
    plugins: [],
}

export default config
