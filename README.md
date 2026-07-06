# Lucid Browser

An open-source, AI-native desktop browser built with Electron, React, and TypeScript. Lucid combines everyday browsing with built-in search, chat, document editing, and voice tools — all in one app.

> Side project status: actively developed, APIs and UX may change.

## Features

### Browsing
- Multi-tab web browsing with persistent session state
- Built-in ad blocker (Ghostery)
- Download manager with pause, resume, and cancel
- Picture-in-picture for any tab
- Zen mode for distraction-free reading
- Per-site permission prompts (camera, mic, location, notifications, screen share)
- Import bookmarks and history from Chrome, Edge, Firefox, and Safari
- Customizable keyboard shortcuts
- Print and save-page support

### AI assistant
- Per-tab AI chat powered by **Anthropic Claude** (via LangChain)
- Web, image, video, map, shopping, and YouTube search through **SerpAPI**
- Page scraping and context injection with Playwright
- YouTube transcript extraction
- Reverse image search and product analysis
- Map results rendered with **Mapbox**
- File and folder upload — PDF, Office docs, code, images, and archives are converted to text for context
- Speech-to-text and text-to-speech via **ElevenLabs**

### Asterisk (workspace tab)
- Rich note and document editor with LaTeX, code blocks, and file attachments
- Drag-and-drop folders and zip archives

### Account
- Sign up / sign in with **Supabase**
- Profile and avatar management
- Session persisted locally through encrypted electron-store

## Tech stack

| Layer | Tools |
|---|---|
| Desktop shell | Electron 31, electron-vite, electron-builder |
| UI | React 18, Tailwind CSS, Radix UI, Framer Motion |
| AI | LangChain, Anthropic SDK |
| Search | SerpAPI |
| Auth | Supabase |
| Maps | Mapbox GL |
| Voice | ElevenLabs |
| Scraping | Playwright |
| Storage | electron-store, SQLite |

## Prerequisites

- **Node.js** 18+ and npm
- **Python 3** on your PATH (used for Windows geolocation; packaged builds bundle an embedded runtime)
- **Playwright browsers** (installed on first scrape/search use):

  ```bash
  npx playwright install chromium
  ```

- On **Windows**, for GPS-based location during dev:

  ```bash
  pip install winsdk
  ```

  Packaged Windows builds run `setup-python.cjs` automatically via `prebuild`.

## Getting started

### 1. Clone and install

```bash
git clone https://github.com/ashf03/lucid-browser.git
cd lucid-browser
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Fill in the keys you need. Nothing works without at least the Anthropic and SerpAPI keys for AI features.

| Variable | Required for | Notes |
|---|---|---|
| `VITE_ANTHROPIC_API_KEY` | AI chat | Primary LLM |
| `VITE_SERPAPI_API_KEY` | Search, maps, YouTube | Also accepts `SERPAPI_API_KEY` in main process |
| `VITE_MAPBOX_ACCESS_TOKEN` | Map display & geocoding | |
| `ELEVEN_LABS_API_KEY` | Voice input/output | |
| `VITE_SUPABASE_URL` | Auth | |
| `VITE_SUPABASE_ANON_KEY` | Auth | |
| `VITE_OPENAI_API_KEY` | Optional fallback LLM | |
| `AUTH_STORE_ENCRYPTION_KEY` | Optional | Encrypts local auth cache |

Never commit `.env` — it is gitignored.

### 3. Run in development

```bash
npm run dev
```

### 4. Build for production

```bash
# Windows (runs setup-python.cjs first)
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

Installers are written to `release/<version>/`.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Electron with hot reload |
| `npm run build` | Typecheck and compile |
| `npm run build:win` / `:mac` / `:linux` | Platform installers |
| `npm run lint` | ESLint with auto-fix |
| `npm run format` | Prettier |
| `npm run typecheck` | TypeScript check (main + renderer) |

## Project structure

```
lucid-browser/
├── src/
│   ├── main/           # Electron main process (IPC, APIs, file I/O)
│   ├── preload/        # contextBridge → window.electronAPI
│   └── renderer/       # React UI
│       └── src/
│           ├── ai/           # Chat, search, maps, voice
│           ├── Auth/           # Supabase auth context
│           ├── components/   # Browser shell, editor, webviews
│           └── settings/     # Preferences and shortcuts
├── python/             # Location service scripts
├── public/             # Icons and build assets
├── electron.vite.config.ts
└── electron-builder.yml
```

IPC between renderer and main is namespaced (`history:add`, `search-serp`, `auth:saveSession`, etc.) and exposed through `src/preload/index.ts`.

## Troubleshooting

**`sqlite3` install errors**

```bash
npm remove sqlite3
npm install sqlite3
```

**Playwright not found**

```bash
npx playwright install chromium
```

**Location unavailable on Windows**

Ensure Python is installed and `winsdk` is available, or use a packaged build that includes `python-embed/`.

## Contributing

Contributions are welcome. Open an issue or PR on GitHub. Keep secrets out of the repo — use `.env` locally and `.env.example` for documentation only.

## License

No license file is included yet. Treat as source-available until one is added. If you plan to fork or distribute builds, open an issue to clarify licensing intent.

## Author

[ashf03](https://github.com/ashf03) — open-source side project, formerly internal tooling rebranded as **Lucid**.
