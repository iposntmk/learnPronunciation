# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev                    # Start HTTPS dev server on port 5173 (accessible on local network)
npm run build                  # Production build
npm run preview                # Preview production build
npm run supabase:seed          # Seed Supabase with 3000 common English words
npm run supabase:check         # Check word seeding status
npm run supabase:seed-sentences    # Seed Supabase with English speaking guide sentences
npm run supabase:check-sentences   # Check sentence seeding status
```

There are no automated tests. The app is developed and tested via manual browser testing.

## Architecture

This is a React + Vite English pronunciation learning web app. Users record themselves pronouncing English words and receive AI-based pronunciation feedback. The app supports Spanish, Italian, and French UI translations.

**Base URL path:** `/learnPronunciation/` (configured in `vite.config.js`)

### Core data flow

1. `src/main.jsx` → `src/AuthGate.jsx` (Supabase auth) → `src/App.jsx` (main app)
2. `App.jsx` fetches words/progress from Supabase via `src/supabaseData.js`
3. Users record audio → `src/scorer.js` scores pronunciation via Azure Cognitive Services Speech API (or falls back to Hugging Face `wav2vec2-base-960h` offline model)
4. Text-to-speech for word examples uses Azure Neural TTS API (`src/tts.js`), falling back to Web Speech API
5. Admin users access `src/AdminScreen.jsx` for word/category CRUD, user management, and Excel import

### Key files

- **`src/App.jsx`** — Large single-component main app (~138KB). Contains all learning flow UI: word cards, phoneme display, recording, scoring, progress, settings. Handles state for all user interactions.
- **`src/supabaseData.js`** — All Supabase database operations (words, categories, progress, profiles, attempts).
- **`src/scorer.js`** — Dual-mode pronunciation scoring: Azure Speech SDK (preferred, requires HTTPS) or Hugging Face `wav2vec2-base-960h` transformer (client-side fallback).
- **`src/tts.js`** — Text-to-speech with Azure Neural TTS fallback to browser Web Speech API (both require HTTPS).
- **`src/data.js`** — IPA phoneme data for English, Spanish, Italian, and French (~93KB).
- **`src/commonWords.js`** / **`src/commonWordDetails.js`** — 3000 most common English words with metadata (214KB / 1.2MB static data files). These are bundled directly and can impact initial load time.
- **`src/AdminScreen.jsx`** — Admin panel for content management (user role: `admin`).
- **`src/api-scorers.js`** — API scorer implementations for pronunciation assessment.

### Important implementation notes

**HTTPS requirement:** The app runs HTTPS by default (via `@vitejs/plugin-basic-ssl`). This is required for:
- Audio recording (getUserMedia API)
- Text-to-speech and pronunciation scoring APIs
- Mobile network access during development

**Large dependencies:** The Hugging Face transformer model (`@huggingface/transformers`) is excluded from Vite's `optimizeDeps` due to its size. It's lazy-loaded only when Azure scoring is unavailable. The static word/phrase data files are bundled directly and contribute significantly to the initial bundle.

**Styling:** Uses Tailwind CSS for all UI components. See `src/index.css` for custom styles.

### Backend

A FastAPI Python backend exists in `/backend/` (`scorer.py`, `main.py`) but is not used by the main app flow — scoring runs client-side or via Azure. There are Supabase utility scripts in `/supabase/` for database updates and migrations.

### Database (Supabase)

Schema defined in `supabase/schema.sql`. Key tables: `profiles`, `categories`, `words`, `user_word_progress`, `pronunciation_attempts`, `import_batches`. User roles: `admin`, `teacher`, `student`.

### Environment variables

**Required** in `.env.local`:
```
VITE_AZURE_KEY=
VITE_AZURE_REGION=southeastasia
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

**Optional** (for practice word images):
```
VITE_POLLINATIONS_API_KEY=         # Pollinations publishable key only
VITE_POLLINATIONS_IMAGE_MODEL=
VITE_GOOGLE_IMAGE_SEARCH_API_KEY=  # Google Custom Search JSON API key
VITE_GOOGLE_IMAGE_SEARCH_CX=       # Custom Search engine ID
```

Supabase client is initialized in `src/supabaseClient.js`. The dev server runs on HTTPS by default (via `@vitejs/plugin-basic-ssl`).
