/** @type {import('tailwindcss').Config} */
export default {
    content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
    theme: {
        extend: {
            colors: {
                // Default theme colors (can be overridden by CSS variables)
                'km-bg': 'var(--color-background, #4a4a4a)',
                'km-bg-alt': 'var(--color-background-alt, #3a3a3a)',
                'km-text': 'var(--color-text, #e0e0e0)',
                'km-text-muted': 'var(--color-text-muted, #a0a0a0)',
                'km-accent': 'var(--color-accent, #efb600)',
                'km-border': 'var(--color-border, #333333)',
            },
            fontFamily: {
                heading: ['var(--font-heading)', 'sans-serif'],
                body: ['var(--font-body)', 'sans-serif'],
            },
            borderRadius: {
                'km': 'var(--corner-radius, 12px)',
            },
            maxWidth: {
                'content': 'var(--max-content-width, 1400px)',
            }
        },
    },
    plugins: [],
}
