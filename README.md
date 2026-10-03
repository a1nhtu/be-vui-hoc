# Bé Vui Học

Web app trò chơi học tập cho bé 5 tuổi chuẩn bị vào lớp 1: **Tiếng Việt, Toán, Tiếng Anh** và **Câu đố vui**.

- 82 bài, 7 kiểu trò chơi: thẻ học, nghe – chọn đáp án, bóng bay, đập chuột, lật thẻ trí nhớ, ghép chữ / xếp số, nhớ dãy màu.
- Mọi câu hỏi đều được đọc thành tiếng: cả tiếng Việt và tiếng Anh đều bằng giọng thu sẵn.
- Thưởng sao và sticker, mở khoá bài theo thứ tự.
- Mỗi bé một hồ sơ riêng (tên, hình đại diện); mỗi bài chấm điểm thang 10, có tổng điểm và bảng điểm.
- Góc bố mẹ: quản lý hồ sơ các bé, bảng điểm từng bài, nhắc nghỉ mắt, mở khoá tất cả.
- Không đăng nhập, không quảng cáo, không thu thập dữ liệu: tiến độ lưu ngay trên máy của bé.
- Cài được ra màn hình chính như một ứng dụng (PWA), chạy được khi mất mạng sau lần mở đầu.

## Chạy thử trên máy

Web tĩnh thuần HTML/CSS/JS, không cần cài gì thêm:

```bash
python -m http.server 5177
```

Rồi mở http://localhost:5177

## Đưa lên Vercel

1. Đẩy thư mục này lên một repo GitHub.
2. Vào https://vercel.com/new, chọn repo, **Framework Preset: Other**, để trống Build Command và Output Directory, bấm Deploy.
3. Từ đó mỗi lần push lên nhánh `main`, Vercel tự cập nhật.

## Sửa / thêm nội dung

Toàn bộ nội dung bài học nằm trong `js/data.js`:

- `VI` – 29 chữ cái tiếng Việt, cách đọc âm, từ mẫu.
- `EN_ABC`, `EN_ANIMALS`, `EN_FRUITS`… – từ vựng tiếng Anh.
- `RIDDLES` – câu đố vui.
- `SUBJECTS` – danh sách môn và thứ tự bài.

Phần máy chạy trò chơi nằm trong `js/app.js`, giao diện trong `css/style.css`.

## Giọng đọc

- Giọng đọc là file mp3 thu sẵn bằng Edge-TTS: **tiếng Việt giọng HoaiMy** (`audio/vi/`), **tiếng Anh giọng Jenny** (`audio/en/`). Máy nào cũng nghe giống nhau, không phụ thuộc giọng của thiết bị.
- Tên bé không được đọc thành tiếng (chỉ hiện trên màn hình) vì giọng là file thu sẵn.
- Câu nào chưa có file mp3 thì app tự dùng giọng của máy.

Sau khi sửa nội dung trong `js/data.js`, thu lại giọng cho các câu mới:

```bash
node tools/gen-audio.mjs collect
```

```bash
python tools/gen_audio.py
```

```bash
node tools/gen-audio.mjs index
```

Bước giữa cần `pip install edge-tts` và có mạng; chỉ những câu chưa có file mới được thu.

---

Gia đình Tú – Nhung – Su – Thỏ · P. Vĩnh Hưng, Hà Nội
