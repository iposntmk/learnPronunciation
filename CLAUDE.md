# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start HTTPS dev server on port 5173 (accessible on local network)
npm run build        # Production build
npm run preview      # Preview production build
npm run supabase:seed   # Seed Supabase with 3000 common English words
npm run supabase:check  # Check seeding status
```

There are no automated tests.

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

- **`src/App.jsx`** — Large single-component main app (~138KB). Contains all learning flow UI: word cards, phoneme display, recording, scoring, progress, settings.
- **`src/supabaseData.js`** — All Supabase database operations (words, categories, progress, profiles, attempts).
- **`src/scorer.js`** — Dual-mode pronunciation scoring: Azure Speech SDK (preferred) or Hugging Face transformer.
- **`src/tts.js`** — Text-to-speech with Azure Neural TTS fallback to browser Web Speech API.
- **`src/data.js`** — IPA phoneme data for English, Spanish, Italian, and French (~93KB).
- **`src/commonWords.js`** / **`src/commonWordDetails.js`** — 3000 most common English words with metadata (214KB / 1.2MB static data files).
- **`src/AdminScreen.jsx`** — Admin panel for content management.

### Backend

A FastAPI Python backend exists in `/backend/` (`scorer.py`, `main.py`) but is not used by the main app flow — scoring runs client-side or via Azure.

### Database (Supabase)

Schema defined in `supabase/schema.sql`. Key tables: `profiles`, `categories`, `words`, `user_word_progress`, `pronunciation_attempts`, `import_batches`. User roles: `admin`, `teacher`, `student`.

### Environment variables

Required in `.env.local`:
```
VITE_AZURE_KEY=
VITE_AZURE_REGION=southeastasia
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Supabase client is initialized in `src/supabaseClient.js`.
