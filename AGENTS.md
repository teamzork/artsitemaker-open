# AGENTS.md

This file provides guidance to coding AI agents when working with code in this repository.

## Browser Agent Usage

The development environment is run on macOS, so the agent needs to use mac keyboard shortcuts when needed (not Windows or Linux).

When agent comes across auth inputs that need user help, prompt for them instead of retrying.

## Development Commands

### Essential Commands
```bash
# Development
pnpm install                  # Install dependencies
pnpm dev                      # Start both admin and site servers
pnpm dev:admin                # Start admin panel (localhost:4322)
pnpm dev:site                 # Start public site (localhost:4321)
pnpm build                    # Build all packages
pnpm build:admin              # Build admin panel
pnpm build:site               # Build public site
pnpm lint                     # Run linting

# Testing
pnpm test                     # Run integration tests
pnpm test:e2e                 # Run E2E tests
pnpm test:all                 # Run all tests (integration + E2E)
pnpm test:coverage            # Run with coverage reports

# Local image server (for development)
npx serve files -p 3001 --cors
```

## Environment Setup
- Development uses `.env` files in each package
- Node.js 20+ required
- pnpm 9+ as package manager

## Architecture Overview

### Application Structure
ArtSiteMaker is an **Astro-based portfolio CMS** with a monorepo structure using pnpm workspaces. The app enables artists to create, edit, and manage their portfolio with a themeable public site.

### Key Architectural Patterns

#### Data Flow
- **File-based storage**: All content stored as YAML files in `user-data/` directory (formerly `content/`)
- **No database**: Git provides versioning and backup
- **pnpm workspaces**: Shared code between `@artsitemaker/site` and `@artsitemaker/admin`
- **Theme system**: Themes stored in `/themes/` with CSS variables for customization
- **Image processing**: Sharp for automatic resizing and WebP conversion

#### Core Data Models
- **Artwork**: Individual artwork entries (`user-data/artworks/[slug].yaml`)
- **Collection**: Grouping of artworks (`user-data/collections/[name].yaml`)
- **Settings**: Site configuration and Identity Kit (`user-data/settings.yaml`)
- **Theme**: Visual styling packages (`/themes/[theme-name]/`)

#### Theme System Architecture
- **Identity Kit**: Persistent artist branding stored in `settings.yaml`
- **Theme packages**: Located in `/themes/` directory
- Each theme provides `theme.yaml`, `styles.css`, and `assets/`
- CSS variables enable runtime customization
- Identity Kit values override theme defaults

#### Modals and Dialogs
- Don't use alert() or confirm() for user interaction
- Use the Modal component instead

### File Organization

#### Package Structure
```
artis/
├── packages/
│   ├── site/                 # Astro public site (static output)
│   │   ├── src/
│   │   │   ├── components/   # UI components
│   │   │   ├── layouts/      # Page layouts
│   │   │   ├── lib/          # Utilities (theme.ts)
│   │   │   └── pages/        # Routes
│   │   └── public/           # Static assets
│   │
│   └── admin/                # Astro SSR admin panel
│       └── src/
│           ├── layouts/      # AdminLayout
│           ├── pages/
│           │   ├── api/      # REST API endpoints
│           │   ├── gallery/  # Gallery management
│           │   ├── content/  # Page & footer editing
│           │   └── settings/ # Site settings
│           └── styles/       # Admin CSS
│
├── user-data/               # User content files (YAML)
│   ├── artworks/            # Individual artwork entries
│   ├── collections/         # Collection definitions
│   ├── pages/               # Static pages
│   └── settings.yaml        # Site configuration
│
├── content/                 # Deprecated: use user-data/ instead
│                            # (still supported for backward compatibility)
│
├── themes/                   # Theme packages
│   └── [theme-name]/
│       ├── theme.yaml       # Theme configuration
│       ├── styles.css       # Theme styles
│       └── assets/          # Fonts, textures, logos
│
└── files/                    # Processed images
    ├── originals/           # Source images
    ├── large/               # 2400px
    ├── medium/              # 1200px
    └── small/               # 600px
```

## UI Implementation Guidelines

### Styling Approach
- **Tailwind CSS** for styling with custom color schemes
- **CSS variables** for theme-aware colors (defined in theme's `styles.css`)
- **Always refer to theme CSS variables** instead of using arbitrary color values
- Use **semantic HTML** structures: `<header>`, `<main>`, `<section>`, `<article>`

### Component Guidelines
- **Always check existing components first** before creating new UI elements
- **Use existing shared components** instead of duplicating functionality
- **Introduce reusable components** when the pattern will be used in 2+ locations
- **Extract common patterns** into shared components proactively
- **Use `Button` component** for all action elements to ensure consistent styling, disabled states, and tooltip behavior
- **Use `Toast` component** for user notifications (success, error, info).
  - Trigger via custom event: `window.dispatchEvent(new CustomEvent('artsitemaker:toast', { detail: { title: 'Message', variant: 'success' } }))`
  - Variants: `default`, `success`, `destructive`, `warning`
- **Create explicit prop typings** for Astro components (or cast `Astro.props`) to prevent implicit `any` errors in map callbacks.

### HTML Semantic Structure and Class Naming Conventions

When creating HTML elements, follow these guidelines:

1. **Use semantic HTML elements** whenever possible (`header`, `nav`, `main`, `section`, `article`, etc.)
2. **Apply descriptive class names** that indicate purpose
3. **Use single dash as separator** for improved readability
4. **Keep class names simple and intuitive**

**Class Naming Pattern:**
- `{component}-{element}`
- `{purpose}-{variant}`

**Examples:**
- `sidebar-nav`, `sidebar-item`, `sidebar-header`
- `gallery-grid`, `gallery-item`, `gallery-thumbnail`
- `card-featured`, `card-compact`

## Linting

- Always run linting first with `pnpm lint` before proceeding to build
- Never run a build automatically — instead, suggest "Run `pnpm build` to build the project."

## Development Workflow

### Public repo (export)
- **Always use the export command** when committing or pushing to the public repo. Never commit directly in the public repo.
- Workflow: commit changes in this (private) repo, then run `./export/export.sh --public-repo /path/to/public-repo --release "description"`, then push from the public repo.
- See `export/EXPORT.md` for details.

### Commit Message Guidelines
- After modifying code, provide a concise commit message for the changes. Do not execute the commit.
- For follow-up requests, provide two types of commit messages: one including all changes and another for only the changes from the last request.
- Do not include "🤖 Generated with [Claude Code](https://claude.ai/code)" or similar signatures

### Testing a Change
After each response that results in code changes, **always** provide clear, actionable testing instructions:
- Specific steps to verify the change works as intended
- Expected behavior or output
- Any prerequisites (e.g., "ensure dev server is running")
- Relevant URLs or UI paths to test

Keep instructions concise but complete enough for immediate verification.

## Module Resolution & Imports

- Prefer relative imports for all code
- Keep import statements grouped at the top of files
- Do not interleave function declarations or constants between import lines

## Utility Function Guidelines

When requested to create a utility function, evaluate its reusability potential:
- **Create reusable utilities** in `src/lib/` if the function could be used in more than one place
- **Include proper TypeScript types** and documentation for reusable utilities
- **Follow existing naming conventions** and file organization patterns
- **Consider edge cases** and error handling for shared utilities

## Optimized Queries & Tools

Use this section for fast, reliable searching and data querying.

### Never Use (Slow)
- `grep` or `grep -r` — use `rg` instead
- `find` — use `rg --files` or `fd` (respects .gitignore)
- `ls -R` — use `rg --files`
- `cat file | grep` — use `rg pattern file`

### ✅ Use These (Fast)
```bash
# ripgrep (rg) - content search
rg "search_term"              # Search in all files
rg -i "case_insensitive"      # Case-insensitive
rg "pattern" -t yaml          # Only YAML files
rg "pattern" -g "*.astro"     # Only Astro files
rg -l "pattern"               # Filenames with matches
rg -n "pattern"               # Show line numbers

# ripgrep (rg) - file listing
rg --files                    # List files (respects .gitignore)
rg --files | rg "pattern"     # Find files by name

# fd - file finding
fd -e astro                   # All .astro files
fd -e yaml                    # All .yaml files
fd -x command {}              # Exec per-file
```

### Search Strategy
1. Start broad, then narrow: `rg "partial" | rg "specific"`
2. Filter by type early: `rg -t yaml "title"`
3. Batch patterns: `rg "(pattern1|pattern2|pattern3)"`
4. Limit scope: `rg "pattern" packages/site/`

### Missing Commands
Install on mac using `brew` if missing commands/tools.

## Maintaining Project Documentation

### Agent Guidelines
Update AGENTS.md as new patterns, preferences, and workflows emerge during development. Add new guidelines when:
- New component patterns are established
- Development workflow changes are introduced
- Code style preferences are clarified
- Project-specific conventions are defined

### User Documentation
Do not create feature or enhancement documentation automatically. Always ask first: "Would you like me to document this feature/change in a markdown file?"

## Important Implementation Notes

### Content Management
- All content is YAML-based in `user-data/` directory (formerly `content/`)
- Artwork slugs are URL-safe identifiers
- Images are processed into multiple sizes automatically
- Thumbnails are generated for gallery views

### Migration: content/ → user-data/
As of this version, the `content/` directory has been renamed to `user-data/` for better semantic clarity:
- **Old naming**: `content/` directory with `contentPath` config option
- **New naming**: `user-data/` directory with `userDataPath` config option
- **Backward compatibility**: Both names are fully supported during the migration period
- **Asset URLs**: `/user-assets/*` URL paths work (`/content-assets/*` removed)

**Function aliases available:**
- `getContentPath()` → `getUserDataPath()` (deprecated)
- Content-assets aliases (`getContentAssetsPath()`, `getContentAssetsBaseUrl()`, `resolveContentAssetUrl()`) have been removed

**Configuration:**
```yaml
# artis.config.yaml - New preferred format
userDataPath: /path/to/user-data

# Old format (still works)
# contentPath: /path/to/content
```

### Theme Development
- Follow theme.yaml structure for configuration
- Use CSS variables for all customizable properties
- Include preview.png for admin theme selection
- Test themes with Identity Kit overrides

### Pure Theme Architecture

As of v1.1, themes are **pure styling packages** containing no content assets.

#### What Themes Contain
- ✅ Design tokens (colors, spacing, layout rules)
- ✅ Component styles (CSS classes, hover effects)
- ✅ Theme configuration (theme.yaml)
- ✅ Preview image (for admin UI)
- ❌ No fonts, logos, or textures

#### Using Recommended Assets

For the authentic theme appearance, install recommended assets:

```bash
pnpm migrate:theme-assets
```

This copies theme assets to `user-data/assets/` and configures Identity Kit.

#### Theme Configuration Example

```yaml
# themes/kazya-mazya/theme.yaml
fonts:
  heading:
    family: sans-serif  # Generic fallback
    weight: 900
    recommendedFont: Aziu  # Optional, for documentation

logo:
  file: null  # No default, use Identity Kit
```

Users configure actual fonts in Identity Kit:

```yaml
# user-data/settings.yaml
identityKit:
  fonts:
    heading:
      family: "Aziu"
      file: "fonts/Aziu-Black.woff2"
      weight: 900
```

#### Theme Development Workflow

Themes are automatically synced from `/themes/` to `/packages/site/public/themes/`:

```bash
# Manual sync (if needed)
pnpm sync:themes

# Automatic sync happens in:
pnpm dev        # Before starting dev servers
pnpm build      # Before building
```

**Theme files synced:**
- ✅ `theme.yaml` - Configuration
- ✅ `styles.css` - Component styles
- ✅ `assets/preview.png` - Admin preview image
- ❌ Not synced: fonts, logos, textures (use user-data instead)

**Making theme changes:**
1. Edit files in `/themes/[theme-name]/`
2. Restart dev server (auto-syncs)
3. Changes appear immediately

**Important:** `/packages/site/public/themes/` is generated. Don't edit directly.

### Authentication (Admin)
- GitHub OAuth is the recommended auth method
- Session cookies are secure and httpOnly
- Only whitelisted GitHub users can access admin

## Testing Guidelines

### Testing Philosophy
- **Integration tests first**: Write tests for existing behavior before refactoring
- **Test critical paths**: Focus on API routes and business logic
- **Coverage target**: 30% minimum for new features
- **Safety net approach**: Tests should catch regressions, not achieve 100% coverage

### Test Structure
```
packages/admin/
├── test/
│   ├── setup.ts              # Global test configuration
│   ├── helpers/              # Test utilities
│   │   ├── mock-astro.ts    # Astro APIContext mocking
│   │   └── test-utils.ts    # Filesystem & data helpers
│   └── integration/          # Integration tests
│       ├── collections.test.ts
│       ├── pages.test.ts
│       └── upload.test.ts
└── vitest.config.ts
```

### Test Commands

Run tests from project root:
```bash
# Integration tests (Vitest)
pnpm test              # Run all integration tests
pnpm test:watch        # Watch mode (all packages)
pnpm test:coverage     # Generate coverage reports

# E2E tests (Playwright)
pnpm test:e2e          # Run all E2E tests (site + admin)
pnpm test:e2e:ui       # Run from package dir: cd packages/admin && pnpm test:e2e:ui

# All tests
pnpm test:all          # Run integration + E2E tests
```

Run tests from package directories:
```bash
# packages/admin/
pnpm test              # Integration tests
pnpm test:watch        # Watch mode
pnpm test:coverage     # With coverage
pnpm test:e2e          # Admin E2E tests
pnpm test:e2e:ui       # Interactive E2E UI

# packages/site/
pnpm test:e2e          # Site E2E tests
pnpm test:e2e:ui       # Interactive E2E UI
pnpm test:e2e:debug    # Debug with breakpoints
```

### Writing Tests
- Use **memfs** for filesystem mocking (configured in setup.ts)
- Use **mock-astro.ts** helpers for creating Astro APIContext
- Test the full request/response cycle (integration style)
- Mock external dependencies (image processing, git, storage providers)
- Keep tests isolated - each test should work independently
