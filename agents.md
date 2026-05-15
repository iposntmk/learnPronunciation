# Agent Instructions

## Encoding — UTF-8 Bắt buộc

Tất cả file nguồn (JS, JSX, JSON, HTML, CSS, MD) phải là **UTF-8 không BOM**.  
Project dùng tiếng Việt đầy đủ dấu — không chuyển sang HTML entity hay escape.

### Phát hiện mojibake

Nếu thấy chuỗi như `Tá»«`, `Ã‚m`, `Äiá»ƒn`, `KhÃ´ng` trong source code → file bị double-encode.

```bash
# Kiểm tra nhanh toàn bộ src/
grep -rn "Ã\|á»\|Ä'\|áº" src/
```

### Fix mojibake bằng PowerShell

```powershell
# Chạy cho từng file bị lỗi
$path = "src\App.jsx"
$enc1252 = [System.Text.Encoding]::GetEncoding(1252)
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
$garbled  = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
$rawBytes = $enc1252.GetBytes($garbled)
$fixed    = [System.Text.Encoding]::UTF8.GetString($rawBytes)
[System.IO.File]::WriteAllBytes($path, $utf8NoBom.GetBytes($fixed))
```

### Nguyên nhân thường gặp

Một editor Windows (Notepad, VS Code sai cài đặt) đọc file UTF-8 bằng encoding mặc định (Windows-1252), rồi lưu lại → byte gốc bị mã hoá đôi.

### Quy tắc khi viết code

- Không dùng `Get-Content` / `Set-Content` mà thiếu `-Encoding utf8NoBOM`
- PowerShell mặc định (5.1) ghi file UTF-16 LE — luôn chỉ định encoding
- Dùng `[System.IO.File]::WriteAllBytes` hoặc `WriteAllText(path, content, utf8NoBomEncoding)` cho file quan trọng
- Khi tạo component/hook mới: gõ trực tiếp tiếng Việt, không copy-paste từ file bị mojibake

### Kiểm tra trước khi commit

```bash
# Nếu có kết quả → cần fix trước khi push
grep -rn "Ã\|á»\|Ä'\|áº" src/
```
