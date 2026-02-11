# Developer Guide: ArtSiteMaker

## Project Overview
**ArtSiteMaker** is a portfolio CMS designed for artists to manage and showcase their work. It is built as a **monorepo** using **Astro** for both the admin interface and the public-facing site.

**Key Features:**
*   **No Database:** All content is stored as YAML files in a version-controlled `user-data/` directory.
*   **Themeable:** Decoupled content and design via a robust theming system.
*   **Static & SSR:** The public site is statically generated (SSG) for performance, while the admin panel uses Server-Side Rendering (SSR).

## Tech Stack
*   **Framework:** [Astro](https://astro.build/) (v5)
*   **Language:** TypeScript
*   **Styling:** Tailwind CSS + CSS Variables (for themes)
*   **Package Manager:** pnpm (Workspaces)
*   **Image Processing:** Sharp (local resizing & optimization)
*   **Storage:** Local Filesystem (Prod: can be mapped to R2/S3)

## Repository Structure

The project is organized as a **pnpm workspace**.

```
artis/
├── packages/
│   ├── admin/           # Admin Dashboard (Astro SSR)
│   │   └── src/pages/   # Auth, Content editing, Uploads
│   └── site/            # Public Website (Astro SSG)
│       └── src/themes/  # Logic to load themes
│
├── user-data/             # The "Database" (YAML files)
│   ├── artworks/        # One YAML per artwork
│   ├── collections/     # Groupings
│   └── settings.yaml    # Site config & Identity Kit
│
├── themes/              # Visual Themes
│   └── [theme-name]/    # e.g., 'minimalist', 'kazya-mazya'
│       ├── theme.yaml   # Config
│       └── styles.css   # CSS Variables & overrides
│
├── files/               # Image storage
│   ├── originals/       # Master files
│   └── [size]/          # Generated variations (large, medium, thumb)
│
└── package.json         # Workspace scripts
```

## Data Flow & Architecture

1.  **Content Separation:**
    *   **Data** lives in `user-data/` (YAML).
    *   **Assets** live in `files/` (Images) or `themes/` (Fonts/Textures).
    *   **Logic** lives in `packages/`.

2.  **Theming Engine:**
    *   The **Identity Kit** (`settings.yaml`) defines core brand elements (fonts, colors).
    *   Themes (`themes/`) provide template structure and default styles.
    *   The site package dynamically loads the active theme's CSS and configuration.

3.  **Image Pipeline:**
    *   Uploads in Admin -> Saved to `files/originals`.
    *   Background process (using `sharp`) generates responsive sizes (WebP).
    *   Public site references generated paths.

## Development Workflow

### Prerequisites
*   Node.js 20+
*   pnpm 9+

### Commands
| Command | Description |
| :--- | :--- |
| `pnpm dev` | Starts **both** Admin (:4322) and Site (:4321) |
| `pnpm build` | Builds both packages for production |
| `pnpm lint` | Runs linting across workspace |

### Deployment Strategy (Current)
*   **Admin:** Hosted on a Node.js server (VPS) to allow file writing.
*   **Site:** Generated as static files and deployed to a CDN (e.g., Cloudflare Pages, Netlify), or served alongside Admin.
*   **GitOps:** Content changes in Admin can be committed/pushed to Git for versioning/backup.

## Future Restructuring Goals
*   **Separation of Concerns:** clearer boundary between the "Engine" (ArtSiteMaker) and the "Instance" (Data/Theme).
*   **Deployment:** Streamlining the "Admin writes to Git -> Trigger Build -> Deploy Site" pipeline.
