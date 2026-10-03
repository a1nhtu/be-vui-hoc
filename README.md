# Bé Vui Học

Web app trò chơi học tập cho bé 5 tuổi chuẩn bị vào lớp 1: **Tiếng Việt, Toán, Tiếng Anh** và **Câu đố vui**.

- 53 bài, 5 kiểu trò chơi: thẻ học, nghe – chọn đáp án, bóng bay, lật thẻ trí nhớ, ghép chữ.
- Mọi câu hỏi đều được đọc thành tiếng (giọng đọc có sẵn của trình duyệt).
- Thưởng sao và sticker, mở khoá bài theo thứ tự.
- Góc bố mẹ: đặt tên bé, nhắc nghỉ mắt, xem tiến độ, mở khoá tất cả.
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

## Lưu ý về giọng đọc

Giọng đọc phụ thuộc thiết bị. Điện thoại và máy tính bảng thường có sẵn giọng tiếng Việt; máy tính Windows có thể phải thêm trong Cài đặt → Thời gian & ngôn ngữ → Giọng nói. Góc bố mẹ có mục kiểm tra máy đang có giọng nào.
