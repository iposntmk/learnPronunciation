# Agent Instructions — learnPronunciation

Tài liệu này dành cho **tất cả AI coding agents** (Claude Code, OpenAI Codex CLI, DeepSeek, Cursor, Copilot...).  
Đọc toàn bộ trước khi bắt đầu bất kỳ task nào.

---

## 1. Project Overview

React + Vite web app học phát âm tiếng Anh. Người dùng thu âm giọng nói → nhận phản hồi AI về phát âm.  
Deploy lên GitHub Pages tại `/learnPronunciation/`. Stack: React 18, Vite 5, Tailwind CSS, Supabase, Azure Cognitive Services.

---

## 2. Quy tắc Shell — KHÔNG tự động chạy

**Cấm tự ý chạy** các lệnh sau mà không được người dùng yêu cầu rõ ràng:

```
npm run dev      npm run build     git commit      git push
```

Chỉ chạy lệnh đọc/kiểm tra nhanh khi thực sự cần (`ls`, `git status`, `git diff`...).  
Nếu cần build để kiểm tra → yêu cầu người dùng tự chạy.

---

## 3. Quy tắc viết code

- **Chỉ hiển thị hàm/component cần sửa** — không chép lại cả file.
- **Ưu tiên diff** hoặc dòng thay đổi, không viết lại nguyên file.
- **Không file nào vượt quá 250 dòng** — tách logic nếu cần.
- **Không thêm feature ngoài yêu cầu**, không refactor khi không được hỏi.
- **Không comment** trừ khi lý do không rõ từ code.
- Phân tích và đề xuất cấu trúc trước, code sau (với task lớn).

---

## 4. Architecture

### Luồng dữ liệu chính

```
src/main.jsx → AuthGate.jsx (Supabase auth) → App.jsx
App.jsx → supabaseData.js (fetch words/progress)
User thu âm → scorer.js → Azure Speech API (fallback: HuggingFace wav2vec2)
Text-to-speech → tts.js → Azure Neural TTS (fallback: Web Speech API)
```

### File quan trọng

| File | Vai trò |
|---|---|
| `src/App.jsx` | Shell chính: routing, global state, wiring hooks/components |
| `src/supabaseData.js` | Tất cả DB operations (words, categories, levels, progress, sentences) |
| `src/scorer.js` | Dual-mode scoring: Azure (ưu tiên) hoặc HuggingFace (offline fallback) |
| `src/tts.js` | TTS: Azure Neural → Web Speech API fallback |
| `src/data.js` | IPA phoneme data 4 ngôn ngữ (~93KB) |
| `src/utils/dictionaryHelpers.js` | IPA lookup, caching, word-detail building |
| `src/azureUsage.js` | Theo dõi quota Azure tháng (5h free = 18 000s) |
| `src/AdminScreen.jsx` | Admin panel: CRUD words/categories, import Excel |

### Hooks (`src/hooks/`)

| Hook | Trách nhiệm |
|---|---|
| `useAudioRecorder` | MediaRecorder lifecycle, countdown, blob |
| `useWordPronunciation` | record → score → result state (word) |
| `useSentencePronunciation` | record → score → result state (sentence) |
| `useProgress` | Sync learned words Supabase ↔ localStorage |
| `useSentenceProgress` | Same cho sentences |
| `usePracticeSettings` | Load/persist user settings |

### Components (`src/components/`)

- `practice/` — WordHeader, WordIpaPanel, WordPhonemeGrid, WordUsagePanel, RecordingConsole, PracticeStatusMessages, PracticeNavigationActions, RootWordBadge
- `sentence/` — SentenceLibraryScreen, PracticeSentenceScreen
- `common/` — ScoreCircle, AzureUsageBadge, LevelCombobox
- `layout/` — BottomNav

### Utilities (`src/utils/`)

- `scoring/scoreUi.js` — Tailwind class helpers theo score
- `scoring/sentenceResult.js` — Aggregate sentence results
- `storage/` — localStorage cho progress/settings/reports
- `words/wordNormalize.js` — `cleanPracticeWord` strip punctuation
- `phonemes/phonemeFormat.js` — `formatIpa` display
- `constants/languages.js` — Language ↔ Azure locale ↔ flag/label

---

## 5. Database (Supabase)

Schema: `supabase/schema.sql`

| Table | Nội dung |
|---|---|
| `profiles` | User roles: `admin`, `teacher`, `student` |
| `words` | Từ vựng + IPA + category + level |
| `categories` | Danh mục từ |
| `levels` | A1–C2 (customizable, sync vào `LEVELS` array runtime) |
| `user_word_progress` | Tiến độ học từng từ |
| `pronunciation_attempts` | Lịch sử chấm điểm |
| `sentences` | Câu luyện tập |
| `sentence_topics` | Chủ đề câu |

---

## 6. Environment Variables

**Bắt buộc** (`.env.local`):
```
VITE_AZURE_KEY=
VITE_AZURE_REGION=southeastasia
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

**Tuỳ chọn** (ảnh từ vựng):
```
VITE_POLLINATIONS_API_KEY=
VITE_POLLINATIONS_IMAGE_MODEL=
VITE_GOOGLE_IMAGE_SEARCH_API_KEY=
VITE_GOOGLE_IMAGE_SEARCH_CX=
```

---

## 7. Encoding — UTF-8 BẮT BUỘC

> **Đây là lỗi đã xảy ra thực tế trong project.** Đọc kỹ.

### Quy tắc

- Tất cả file nguồn: **UTF-8 không BOM**
- Project dùng tiếng Việt đầy đủ dấu — không escape sang HTML entity
- Không copy-paste từ file đang bị mojibake sang file mới
- PowerShell 5.1 mặc định ghi UTF-16 LE → luôn chỉ định encoding

### Phát hiện mojibake

Chuỗi như `Tá»«`, `Ã‚m`, `KhÃ´ng` trong source = file bị double-encode.

```bash
# Kiểm tra trước khi commit
grep -rn "Ã\|á»\|Ä'\|áº" src/
```

Nếu có kết quả → fix trước khi push.

### Fix bằng PowerShell

```powershell
$path = "src\App.jsx"   # đổi sang file cần fix
$enc1252  = [System.Text.Encoding]::GetEncoding(1252)
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
$garbled  = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
$rawBytes = $enc1252.GetBytes($garbled)
$fixed    = [System.Text.Encoding]::UTF8.GetString($rawBytes)
[System.IO.File]::WriteAllBytes($path, $utf8NoBom.GetBytes($fixed))
```

### Khi ghi file bằng PowerShell

```powershell
# ĐÚNG
[System.IO.File]::WriteAllText($path, $content, (New-Object System.Text.UTF8Encoding $false))
# SAI — PowerShell 5.1 mặc định ghi UTF-16 LE
Set-Content $path $content
```

### Nguyên nhân gốc

Editor Windows (Notepad, VS Code cài sai) đọc UTF-8 file bằng encoding CP1252 → lưu lại → UTF-8 bytes bị double-encode. Fix: lệnh PowerShell trên sẽ khôi phục lại đúng.

---

## 8. Notes quan trọng

- **HTTPS**: Chỉ `npm run dev:mobile` mới bật SSL. `npm run dev` là HTTP only.
- **HuggingFace**: excluded khỏi `optimizeDeps`, lazy-load chỉ khi Azure không có.
- **commonWords.js / commonWordDetails.js**: file tĩnh 214KB/1.2MB, ảnh hưởng bundle size.
- **Backend `/backend/`**: FastAPI Python, KHÔNG dùng trong app flow chính.
- **No tests**: Kiểm tra bằng manual browser testing.
