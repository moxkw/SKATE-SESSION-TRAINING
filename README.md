# SKATE SESSION — Ollie & Fakie Ollie

Web app tập skateboard nhẹ nhàng 33 phút, viết bằng HTML/CSS/JS thuần, chạy offline, tối ưu Safari iPhone. Không framework, CDN, API hay backend.

## Cấu trúc

```
skate-session/
├── index.html      giao diện và các phần tử DOM
├── style.css       giao diện tối/sáng, safe-area iPhone
├── app.js          timer theo timestamp, theo dõi trick, nhật ký
├── manifest.json   thông tin cài lên Màn hình chính
├── sw.js           Service Worker cache offline
└── README.md
```

## Lịch tập (33 phút)

Khởi động 10 phút, Ollie 8 phút, Fakie Ollie 8 phút, Hạ nhiệt 7 phút. Bạn có thể tạm dừng, bỏ qua giai đoạn hoặc kết thúc bất kỳ lúc nào.

## Ba cách chạy

| Cách chạy | Giao diện, timer, nhật ký | Offline (Service Worker) |
|---|---|---|
| Mở trực tiếp `file://` | Chạy được | **Không.** Trình duyệt không cho đăng ký Service Worker qua file:// |
| `localhost` | Chạy được | Có, sau lần tải đầu tiên (localhost được coi là an toàn) |
| GitHub Pages (HTTPS) | Chạy được | Có, sau lần tải đầu tiên. **Đây là cách dùng trên iPhone** |

Chạy thử trên máy tính: mở terminal trong thư mục dự án, gõ `python3 -m http.server 8080`, rồi vào `http://localhost:8080`.

## Triển khai lên GitHub Pages

1. Vào github.com, tạo repository mới (ví dụ `skate-session`), để Public.
2. Tải lên cả 5 file `index.html`, `style.css`, `app.js`, `manifest.json`, `sw.js` cùng `README.md` (nút Add file, Upload files, rồi Commit).
3. Vào Settings, Pages. Ở Source chọn "Deploy from a branch", Branch `main`, thư mục `/ (root)`, bấm Save.
4. Chờ 1–2 phút, mở URL dạng `https://TEN-CUA-BAN.github.io/skate-session/` bằng **Safari** trên iPhone.
5. Mở app lần đầu khi **có Internet**, đợi dòng cuối trang báo "Đã cache xong".
6. Kiểm tra offline: bật Chế độ máy bay, đóng hẳn Safari, mở lại URL hoặc icon. App vẫn phải chạy và còn nhật ký.
7. Nếu muốn: nút Chia sẻ, chọn Thêm vào Màn hình chính.

## Kiểm tra offline trên Safari iPhone

- Đảm bảo đã mở app ít nhất một lần khi có mạng.
- Khi đang tập, khóa màn hình rồi mở lại: timer tính theo giờ hệ thống nên vẫn đúng.
- Nếu app không hoạt động offline, mở lại một lần khi có mạng rồi thử lại.

## Cập nhật app

Sau khi sửa file, đổi `CACHE = 'skate-session-v1'` trong `sw.js` thành `v2`, rồi tải lên lại. Mở app hai lần khi có mạng để nhận bản mới.

## Lưu ý

- Dữ liệu nằm trong `localStorage` của Safari trên đúng thiết bị đó. Xóa dữ liệu website hoặc dùng chế độ riêng tư sẽ mất nhật ký. Hãy thỉnh thoảng dùng **Xuất JSON** để sao lưu.
- Buổi tập đang dở khi tải lại trang sẽ hỏi bạn có muốn mở lại không, và luôn ở trạng thái tạm dừng.
- Buổi tập dưới 10 giây không được lưu vào nhật ký. Mỗi buổi chỉ có một bản ghi, bấm nhiều lần không tạo bản trùng.
- iOS dùng icon PNG do app tự vẽ khi tải trang cho Màn hình chính. Nếu icon hiện chưa đúng, hãy mở lại app rồi thêm lại.
- App không dùng camera, âm thanh tự động hay thông báo nền. Chiều cao và cân nặng không được dùng để đánh giá sức khỏe.
- Đội mũ bảo hiểm, tập trên nền phẳng, nghỉ ngay nếu mệt, đau hoặc mất kiểm soát.
