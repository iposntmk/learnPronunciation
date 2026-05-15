# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev                    # Start HTTP dev server on port 5173 (localhost only, no SSL)
npm run dev:mobile             # Start HTTPS dev server accessible on local network (required for mobile testing, TTS, and scoring APIs)
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

- **`src/App.jsx`** — Main app shell. Manages screen routing (word practice, sentence library, admin), global state (settings, auth, word list), and wires hooks/components together.
- **`src/supabaseData.js`** — All Supabase database operations (words, categories, levels, progress, profiles, attempts, sentences).
- **`src/scorer.js`** — Dual-mode pronunciation scoring: Azure Speech SDK (preferred, requires HTTPS) or Hugging Face `wav2vec2-base-960h` transformer (client-side fallback).
- **`src/tts.js`** — Text-to-speech with Azure Neural TTS fallback to browser Web Speech API (both require HTTPS).
- **`src/data.js`** — IPA phoneme data for English, Spanish, Italian, and French (~93KB).
- **`src/utils/dictionaryHelpers.js`** — IPA/dictionary lookup, caching, and word-detail building for the practice screen.
- **`src/commonWords.js`** / **`src/commonWordDetails.js`** — 3000 most common English words with metadata (214KB / 1.2MB static data files). Bundled directly; significant impact on initial load.
- **`src/AdminScreen.jsx`** — Admin panel for content management (user role: `admin`).
- **`src/api-scorers.js`** — API scorer implementations for pronunciation assessment.
- **`src/azureUsage.js`** — Tracks Azure Speech monthly quota in localStorage (5h free tier = 18 000 s/month); exposed via `AzureUsageBadge`.

### Hooks (`src/hooks/`)

| Hook | Responsibility |
|---|---|
| `useAudioRecorder` | Raw MediaRecorder lifecycle — start/stop/cancel, countdown, blob storage, segment playback |
| `useWordPronunciation` | Orchestrates recording → `scoreWord()` → result state for a single word |
| `useSentencePronunciation` | Same flow for full sentences, adds phoneme-row breakdown |
| `useProgress` | Syncs learned-word set and scores between Supabase and localStorage |
| `useSentenceProgress` | Same for sentence attempts |
| `usePracticeSettings` | Loads/persists user settings (recording duration, language, etc.) |

### Components (`src/components/`)

- **`practice/`** — Word practice UI: `WordHeader`, `WordIpaPanel`, `WordPhonemeGrid`, `WordUsagePanel`, `RecordingConsole`, `PracticeStatusMessages`, `PracticeNavigationActions`, `RootWordBadge`
- **`sentence/`** — `SentenceLibraryScreen` (topic browser) and `PracticeSentenceScreen` (recording + scoring)
- **`common/`** — Shared: `ScoreCircle`, `AzureUsageBadge`, `LevelCombobox`
- **`layout/`** — `BottomNav`

### Utilities (`src/utils/`)

- **`scoring/scoreUi.js`** — `scoreBg`, `scoreColor`, `scoreTextBg` helpers for score-based Tailwind classes
- **`scoring/sentenceResult.js`** — Sentence-level result aggregation
- **`storage/`** — localStorage helpers for progress, settings, and incorrect-word reports
- **`words/wordNormalize.js`** — `cleanPracticeWord` strips punctuation before scoring
- **`phonemes/phonemeFormat.js`** — `formatIpa` display helper
- **`constants/languages.js`** — Language ↔ Azure locale ↔ flag/label maps

### Important implementation notes

**HTTPS requirement:** Only `npm run dev:mobile` enables HTTPS (via `@vitejs/plugin-basic-ssl`). This is required for:
- Audio recording (getUserMedia API) on mobile
- Text-to-speech and pronunciation scoring APIs over the network
- Testing on physical devices on the same WiFi

**Large dependencies:** The Hugging Face transformer model (`@huggingface/transformers`) is excluded from Vite's `optimizeDeps` due to its size. It's lazy-loaded only when Azure scoring is unavailable. The static word/phrase data files are bundled directly and contribute significantly to the initial bundle.

**Styling:** Uses Tailwind CSS for all UI components. See `src/index.css` for custom styles.

### Backend

A FastAPI Python backend exists in `/backend/` (`scorer.py`, `main.py`) but is not used by the main app flow — scoring runs client-side or via Azure. There are Supabase utility scripts in `/supabase/` for database updates and migrations.

### Database (Supabase)

Schema defined in `supabase/schema.sql`. Key tables: `profiles`, `categories`, `levels`, `words`, `user_word_progress`, `pronunciation_attempts`, `import_batches`, `sentences`, `sentence_topics`. User roles: `admin`, `teacher`, `student`. Levels (A1–C2 by default) are stored in the `levels` table and can be customised by admins; `LEVELS` in `supabaseData.js` is a mutable module-level array kept in sync at runtime.

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

### Encoding — UTF-8 (quan trọng)

Tất cả file nguồn phải là **UTF-8 không BOM**. Project dùng tiếng Việt đầy đủ dấu.

**Phát hiện mojibake** (chuỗi như `Tá»«`, `Ã‚m` trong source → bị double-encode):
```bash
grep -rn "Ã\|á»\|Ä'\|áº" src/
```

**Fix:** xem `agents.md` để có lệnh PowerShell fix đầy đủ.

Nguyên nhân: editor Windows đọc UTF-8 bằng CP1252 rồi lưu lại → byte bị mã hoá đôi. Không copy-paste từ file đang bị mojibake sang file mới.

# Quy định về Lệnh Shell (Shell Execution Rules)
- KHÔNG TỰ Ý chạy các lệnh: `npm run dev`, `npm run build`, `git commit`, `git push`.
- Nếu cần kiểm tra code, chỉ yêu cầu người dùng tự chạy các lệnh đó bên ngoài terminal hệ thống.
- Chỉ chạy các lệnh đọc file hoặc kiểm tra nhanh (như `ls`, `cat`) khi thực sự cần thiết.
# Môi trường: Vite Webapp

# Quy tắc phản hồi (Tiết kiệm Token)
- Trả lời cực ngắn theo phong cách "caveman" (người tối cổ).
- Không giải thích kiến thức nền tảng về Vite, React, Vue hoặc Bundler.
- Chỉ hiển thị đúng hàm hoặc component cần sửa đổi. Không chép lại cả file.
- Định dạng code: Chỉ hiển thị diff hoặc dòng code thay đổi.


Giới hạn số dòng: "Không file nào được vượt quá 250 dòng".

Chia nhỏ logic: "Tách toàn bộ logic xử lý âm thanh (Azure/Hugging Face) ra khỏi UI".

Quy trình 2 bước: Luôn yêu cầu AI: "Phân tích và đề xuất cấu trúc file trước khi viết code".