import animate from 'tailwindcss-animate';

/** @type {import('tailwindcss').Config} */
export default {
    content: [
        './src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}',
        '../site/src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'
    ],
    theme: {
        extend: {
            colors: {
                // Admin theme colors
                'admin-bg': '#1a1a2e',
                'admin-sidebar': '#16213e',
                'admin-card': '#0f3460',
                'admin-text': '#eaeaea',
                'admin-muted': '#82829b',
                'admin-accent': '#e94560',
                'admin-success': '#4ade80',
                'admin-warning': '#fbbf24',
                'admin-border': '#2a2a4a',
                'admin-primary': '#1a73e8',
                'admin-primary-light': '#4285f4',
                'admin-primary-bright': '#01edf9',
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
            },
        },
    },
    plugins: [animate],
}