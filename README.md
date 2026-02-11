<!-- export/README_PUBLIC.md -->
# ArtSiteMaker

A file-based portfolio CMS for artists. Build and manage art portfolio sites with zero database — content lives as YAML files and Git provides versioning.

- **Site builder**: Admin panel + static site generator
- **Content separation**: Your content in a `user-data/` project
- **Themes**: Built-in themes; customizable via CSS variables
- **Storage**: Local files or Cloudflare R2

For simple usage instructions, see [README-ARTIST.md](README-ARTIST.md). For contributing and architecture, see [DEVELOPER_README.md](DEVELOPER_README.md) and [AGENTS.md](AGENTS.md).

## Prerequisites

- Node.js 20+
- pnpm: `npm install -g pnpm`

## Setup

1. **Clone and install**

```bash
git clone https://github.com/your-org/artsitemaker-open.git
cd artsitemaker-open
pnpm install
```

2. **Environment and config**

```bash
cp .env.example .env
cp artis.config.example artis.config.yaml
```

Edit `.env` and set `SITE_PROJECT_PATH` to your art project path (see below). Edit `artis.config.yaml` to point `userDataPath` at that project’s user-data root.

3. **Create a content project (single-repo layout)**

```bash
pnpm init:user-data myproject
```

Then set in `artis.config.yaml`:

```yaml
userDataPath: ./user-data/myproject
```

Or use an absolute path to a separate directory that contains your `user-data` structure.

4. **Run**

```bash
pnpm dev:admin   # Admin panel at http://localhost:4322
pnpm dev:site    # Public site at http://localhost:4321
```

For local image serving during development:

```bash
npx serve files -p 3001 --cors
```

## Commands

| Command | Description |
|--------|-------------|
| `pnpm dev` | Start both admin and site |
| `pnpm build` | Build admin and site |
| `pnpm lint` | Run linting |
| `pnpm test` | Integration tests |
| `pnpm test:e2e` | E2E tests |
| `pnpm init:user-data <name>` | Scaffold a new user-data project |
| `pnpm validate:user-data` | Validate user-data structure |

## Notes

- `artis.config.yaml` and `.env` are local and not committed; copy from the `.example` files.
- This repo contains source only; no private data or credentials.
- Runtime dirs (e.g. `user-data/`, `files/`, `node_modules/`) are created locally or configured via `artis.config.yaml`.
