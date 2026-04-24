# English Pronunciation Project Overview

Ứng dụng học phát âm tiếng Anh (English Pronunciation) được xây dựng với React (Frontend), FastAPI (Backend) và Supabase (Database/Auth). Người dùng có thể luyện tập phát âm các từ tiếng Anh, nhận phản hồi từ AI và theo dõi tiến độ học tập.

## Công nghệ chính (Tech Stack)

- **Frontend:** React 18, Vite, Tailwind CSS, Lucide React.
- **Backend:** FastAPI (Python), Faster Whisper, Transformers (wav2vec2), Torch.
- **AI/ML:**
  - Chấm điểm phát âm: Azure Cognitive Services Speech API (Ưu tiên) hoặc mô hình offline Hugging Face (`wav2vec2-base-960h`).
  - Chuyển đổi văn bản thành giọng nói (TTS): Azure Neural TTS hoặc Web Speech API (fallback).
- **Database & Auth:** Supabase.
- **CI/CD:** GitHub Actions.

## Cấu trúc dự án (Architecture)

- `src/`: Mã nguồn Frontend React.
  - `App.jsx`: Thành phần chính quản lý luồng học tập, ghi âm và hiển thị kết quả.
  - `supabaseData.js`: Các thao tác với cơ sở dữ liệu Supabase.
  - `scorer.js`: Logic chấm điểm phát âm (hỗ trợ cả Azure và mô hình chạy trên trình duyệt).
  - `tts.js`: Logic xử lý giọng nói mẫu.
  - `AdminScreen.jsx`: Giao diện quản trị cho nội dung và người dùng.
- `backend/`: Mã nguồn Backend Python (FastAPI).
  - `main.py`: Các API endpoint.
  - `scorer.py`: Logic chấm điểm phát âm sử dụng các thư viện AI.
- `supabase/`: Chứa schema cơ sở dữ liệu (`schema.sql`).
- `scripts/`: Các script hỗ trợ import dữ liệu (common words) vào Supabase.

## Hướng dẫn Phát triển (Development)

### Biến môi trường (Environment Variables)

Cần tạo tệp `.env.local` ở thư mục gốc với các thông số sau:
```env
VITE_AZURE_KEY=your_azure_key
VITE_AZURE_REGION=southeastasia
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Các lệnh quan trọng

**Frontend:**
- `npm run dev`: Chạy server phát triển (HTTPS trên cổng 5173).
- `npm run build`: Xây dựng phiên bản sản xuất.
- `npm run preview`: Xem trước bản build.
- `npm run supabase:seed`: Nạp dữ liệu 3000 từ thông dụng vào Supabase.
- `npm run supabase:check`: Kiểm tra trạng thái nạp dữ liệu.

**Backend:**
- Cài đặt dependency: `pip install -r backend/requirements.txt`
- Chạy server: `cd backend && uvicorn main:app --reload`

## Quy ước Phát triển (Conventions)

- **Mobile First:** Ứng dụng được tối ưu hóa cho thiết bị di động (sử dụng Tailwind CSS).
- **Base Path:** Dự án được cấu hình chạy trên đường dẫn `/learnPronunciation/`.
- **Offline Fallback:** Luôn đảm bảo ứng dụng có thể hoạt động (với độ chính xác thấp hơn) khi không có kết nối tới Azure thông qua các mô hình chạy trực tiếp trên trình duyệt.
- **Quản lý trạng thái:** Sử dụng React Hooks (useState, useEffect, useCallback) trong `App.jsx`.

## Ghi chú khác

- Tệp `src/App.jsx` là tệp lớn nhất và chứa hầu hết logic giao diện người dùng. Khi thay đổi, cần cẩn thận để không làm ảnh hưởng đến các luồng xử lý audio phức tạp.
- Dữ liệu âm thanh (IPA) cho các ngôn ngữ khác (Tây Ban Nha, Ý, Pháp) được lưu trữ trong `src/data.js`.
